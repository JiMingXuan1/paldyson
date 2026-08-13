// DOM-based UI layer (pixel-styled). The root is pointer-events:none so the
// Phaser canvas receives clicks everywhere except on actual widgets.

import { ITEMS, itemName } from "../data/items";
import { BUILDINGS, RECIPES } from "../data/buildings";
import { PALS } from "../data/pals";
import { DYSON_NEEDED } from "../config";
import { Sfx } from "../utils/sound";

export interface UICallbacks {
  onSelectBuild: (id: string | null) => void;
  onRotate: () => void;
  onTechStart: (id: string) => void;
  onPalRelease: (type: string) => void;
  onPalJob: (palUid: number, job: unknown) => void;
  onPalFeed: (palUid: number) => void;
  onPalFree: (palUid: number) => void;
  onPanelTake: (uid: number, which: "inB" | "outB", itemId: string) => void;
  onPanelDeposit: (uid: number) => void;
  onPanelRecipe: (uid: number, recipeId: string) => void;
  onPanelDeconstruct: (uid: number) => void;
  onPanelDyson: (uid: number) => void;
  onPanelPalAssign: (uid: number, palUid: number | null) => void;
  onNewGame: () => void;
  onContinue: () => void;
  onSave: () => void;
  onToggleMute: () => void;
  onResetSave: () => void;
  onBackToTitle: () => void;
}

function el(html: string): HTMLElement {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild as HTMLElement;
}

function bar(percent: number, color: string): string {
  const p = Math.max(0, Math.min(100, Math.round(percent * 100)));
  return `<div class="bar"><div class="bar-fill" style="width:${p}%;background:${color}"></div></div>`;
}

interface PalListEntry {
  uid: number;
  name: string;
  type: string;
  typeName: string;
  hunger: number;
  mood: number;
  job: { kind: string; targetUid?: number };
  affinity: string[];
}

export class UI {
  private cb: UICallbacks;
  private root!: HTMLElement;
  private invChips = new Map<string, HTMLElement>();
  private hotbarSlots: HTMLElement[] = [];
  private selectedBuild: string | null = null;
  private _panelUid: number | null = null;
  private modalOpen = false;
  private muted = false;

  private topTime!: HTMLElement;
  private topPower!: HTMLElement;
  private topDyson!: HTMLElement;
  private buildMenuEl!: HTMLElement;
  private hotbarEl!: HTMLElement;

  constructor(cb: UICallbacks) {
    this.cb = cb;
  }

  init(): void {
    this.root = document.getElementById("ui-root")!;
    this.root.innerHTML = `
      <div id="topbar">
        <div class="chip" id="top-time">☀️ 第1天 06:00</div>
        <div class="chip" id="top-power">⚡ 0/0</div>
        <div class="chip" id="top-dyson">🪐 0/${DYSON_NEEDED}</div>
        <div class="spacer"></div>
        <button class="btn" id="btn-tech">🧪 科技</button>
        <button class="btn" id="btn-pals">🟣 帕鲁</button>
        <button class="btn" id="btn-help">❓</button>
        <button class="btn" id="btn-menu">☰</button>
      </div>
      <div id="inventory-bar"></div>
      <div id="hotbar-wrap"><div id="hotbar"></div></div>
      <div id="build-menu" class="hidden"></div>
      <div id="toasts"></div>
      <div id="panel" class="hidden"></div>
      <div id="modal" class="hidden"></div>
      <div id="start" class="overlay"></div>
      <div id="victory" class="overlay hidden"></div>
    `;

    document.getElementById("btn-tech")!.onclick = () => {
      Sfx.click();
      this.openModal("科技树", this.renderTechTree());
      this.wireTechModal(document.getElementById("modal")!);
    };
    document.getElementById("btn-pals")!.onclick = () => {
      Sfx.click();
      this.openModal("帕鲁管理", this.renderPals());
      this.wirePalModal(document.getElementById("modal")!);
    };
    document.getElementById("btn-help")!.onclick = () => {
      Sfx.click();
      this.openModal("操作说明", this.renderHelp());
    };
    document.getElementById("btn-menu")!.onclick = () => {
      Sfx.click();
      this.openModal("菜单", this.renderMenu());
      this.wireMenu();
    };

    this.topTime = document.getElementById("top-time")!;
    this.topPower = document.getElementById("top-power")!;
    this.topDyson = document.getElementById("top-dyson")!;
    this.buildMenuEl = document.getElementById("build-menu")!;
    this.hotbarEl = document.getElementById("hotbar")!;

    this.renderInventoryBar();
    this.renderHotbar();
    this.renderBuildMenu();
  }

  // ---- Top bar ----

  setTime(day: number, hour: number, isNight: boolean): void {
    const hh = String(Math.floor(hour)).padStart(2, "0");
    const mm = String(Math.floor((hour % 1) * 60)).padStart(2, "0");
    this.topTime.textContent = `${isNight ? "🌙" : "☀️"} 第${day}天 ${hh}:${mm}`;
  }

  setPower(gen: number, use: number): void {
    const low = gen < use;
    this.topPower.textContent = `⚡ ${Math.round(gen)}/${Math.round(use)}`;
    this.topPower.classList.toggle("warn", low);
    this.topPower.title = low ? "电力不足！生产速度下降" : "电力充足";
  }

  setDyson(fed: number): void {
    this.topDyson.textContent = `🪐 ${fed}/${DYSON_NEEDED}`;
  }

  // ---- Inventory ----

  private renderInventoryBar(): void {
    const barEl = document.getElementById("inventory-bar")!;
    barEl.innerHTML = "";
    this.invChips.clear();
    for (const id of ["wood", "stone", "iron_ore", "coal", "berries", "iron_ingot", "gear", "circuit", "red_science", "pal_sphere", "dyson_component"]) {
      const chip = el(
        `<div class="inv-chip" title="${ITEMS[id].desc}"><span class="dot" style="background:${ITEMS[id].color}"></span><span class="cnt" id="inv-${id}">0</span><span class="lbl">${ITEMS[id].name}</span></div>`,
      );
      barEl.appendChild(chip);
      this.invChips.set(id, chip.querySelector(".cnt")!);
    }
  }

  setInventory(inv: Record<string, number>): void {
    this.invLast = inv;
    for (const [id, elm] of this.invChips) {
      elm.textContent = String(inv[id] ?? 0);
    }
    const sc = document.getElementById("sphere-cnt");
    if (sc) sc.textContent = String(inv["pal_sphere"] ?? 0);
  }

  // ---- Hotbar & build menu ----

  /** Re-render hotbar/menu with an updated lock set. */
  refreshBuilds(locked: Set<string>): void {
    this.locked = locked;
    this.renderHotbar();
    this.renderBuildMenu();
  }

  locked = new Set<string>();

  private renderHotbar(): void {
    this.hotbarEl.innerHTML = "";
    this.hotbarSlots = [];
    const order = ["wind_turbine", "mining_drill", "furnace", "assembler", "research_lab", "belt", "chest", "coal_generator", "pal_terminal", "dyson_core"];
    order.forEach((id, i) => {
      const def = BUILDINGS[id];
      const locked = this.locked.has(id);
      const slot = el(`
        <div class="hslot ${locked ? "locked" : ""} ${this.selectedBuild === id ? "sel" : ""}" data-id="${id}" title="${def.name}\n${def.desc}\n造价：${this.costText(id)}">
          <div class="h-icon">${def.icon}</div>
          <div class="h-num">${i + 1}</div>
        </div>
      `);
      slot.onclick = () => {
        Sfx.click();
        if (locked) return;
        this.selectBuild(this.selectedBuild === id ? null : id);
      };
      this.hotbarEl.appendChild(slot);
      this.hotbarSlots.push(slot);
    });
    // Pal sphere tool button.
    const sphere = el(`
      <div class="hslot sphere-slot ${this.selectedBuild === "sphere" ? "sel" : ""}" id="sphere-btn" title="帕鲁球\n选中后左键投掷，捕获野生帕鲁（稀有度越高越难）">
        <div class="h-icon">🔮</div>
        <div class="h-num">S</div>
        <div class="sphere-cnt" id="sphere-cnt">0</div>
      </div>
    `);
    sphere.onclick = () => {
      Sfx.click();
      this.selectBuild(this.selectedBuild === "sphere" ? null : "sphere");
    };
    this.hotbarEl.appendChild(sphere);
  }

  private renderBuildMenu(): void {
    this.buildMenuEl.innerHTML = `<div class="menu-title">建造菜单 <span class="hint">(B 开关)</span></div>`;
    for (const id of Object.keys(BUILDINGS)) {
      const def = BUILDINGS[id];
      const locked = this.locked.has(id);
      const item = el(`
        <div class="bmenu-item ${locked ? "locked" : ""} ${this.selectedBuild === id ? "sel" : ""}" data-id="${id}">
          <span class="b-icon">${def.icon}</span>
          <span class="b-name">${def.name}${locked ? " 🔒" : ""}</span>
          <span class="b-cost">${this.costText(id)}</span>
        </div>
      `);
      item.onclick = () => {
        Sfx.click();
        if (locked) return;
        this.selectBuild(this.selectedBuild === id ? null : id);
      };
      this.buildMenuEl.appendChild(item);
    }
  }

  private costText(id: string): string {
    const cost = BUILDINGS[id].cost;
    return Object.entries(cost)
      .map(([iid, n]) => `${itemName(iid)}×${n}`)
      .join(" ");
  }

  /** Apply selection visuals only (no callback — used by the scene). */
  applySelection(id: string | null): void {
    this.selectedBuild = id;
    this.hotbarSlots.forEach((s) => s.classList.toggle("sel", s.dataset.id === id));
    const sphere = document.getElementById("sphere-btn");
    if (sphere) sphere.classList.toggle("sel", id === "sphere");
    this.buildMenuEl.querySelectorAll(".bmenu-item").forEach((s) => {
      s.classList.toggle("sel", (s as HTMLElement).dataset.id === id);
    });
    this.buildMenuEl.classList.toggle("hidden", !id);
  }

  selectBuild(id: string | null): void {
    this.applySelection(id);
    this.cb.onSelectBuild(id);
  }

  toggleBuildMenu(show?: boolean): void {
    const target = show ?? this.buildMenuEl.classList.contains("hidden");
    this.buildMenuEl.classList.toggle("hidden", !target);
    if (target && !this.selectedBuild) this.selectBuild(Object.keys(BUILDINGS)[0]);
  }

  // ---- Toasts ----

  toast(text: string, kind: "info" | "warn" | "good" = "info"): void {
    const box = document.getElementById("toasts")!;
    const t = el(`<div class="toast ${kind}">${text}</div>`);
    box.appendChild(t);
    setTimeout(() => {
      t.classList.add("out");
      setTimeout(() => t.remove(), 400);
    }, 2600);
  }

  // ---- Modals ----

  private openModal(title: string, body: string): void {
    const m = document.getElementById("modal")!;
    m.innerHTML = `
      <div class="modal-box">
        <div class="modal-head"><span>${title}</span><button class="btn close">✕</button></div>
        <div class="modal-body">${body}</div>
      </div>
    `;
    m.classList.remove("hidden");
    this.modalOpen = true;
    m.querySelector(".close")!.addEventListener("click", () => this.closeModal());
    m.querySelector(".modal-box")!.addEventListener("click", (e) => e.stopPropagation());
    m.onclick = () => this.closeModal();
  }

  closeModal(): void {
    document.getElementById("modal")!.classList.add("hidden");
    this.modalOpen = false;
  }

  get isModalOpen(): boolean {
    return this.modalOpen;
  }

  private renderTechTree(): string {
    const rows = this.techLast.map((t) => {
      const done = t.researched;
      const current = t.current;
      const can = t.canStart;
      const btn = done
        ? `<span class="tag good">✅ 已解锁</span>`
        : current
          ? `<span class="tag prog">⏳ 研究中 ${Math.round(t.progress * 100)}%</span>`
          : can
            ? `<button class="btn small" data-tech="${t.id}">研究（红瓶×${t.cost}）</button>`
            : `<span class="tag locked">🔒 ${t.reason ?? "未解锁"}</span>`;
      return `<div class="tech-row ${done ? "done" : ""}">
        <div class="tech-icon">${t.icon}</div>
        <div class="tech-info">
          <div class="tech-name">${t.name} ${done ? "✅" : ""}</div>
          <div class="tech-desc">${t.desc}</div>
        </div>
        <div class="tech-btn">${btn}</div>
      </div>`;
    });
    return rows.join("");
  }

  private renderPals(): string {
    // Pal items in inventory.
    const items = Object.entries(this.invLast ?? {})
      .filter(([id]) => id.startsWith("pal_"))
      .map(([id, n]) => ({ id, type: id.slice(4), n }));
    let html = `<div class="pal-sec-title">📦 帕鲁球（背包）</div>`;
    if (items.length === 0) {
      html += `<div class="empty">还没有帕鲁球。在组装机中制造，或投掷到野生帕鲁身上。</div>`;
    } else {
      html += `<div class="pal-item-list">` + items
        .map((it) => `<div class="pal-item">
          <span class="dot" style="background:${PALS[it.type]?.color ?? "#888"}"></span>
          <span>${PALS[it.type]?.name ?? it.type} ×${it.n}</span>
          <button class="btn small" data-release="${it.type}">释放</button>
        </div>`)
        .join("") + `</div>`;
    }
    html += `<div class="pal-sec-title">🟣 已驯化帕鲁（${this.palsLast?.length ?? 0}）</div>`;
    if ((this.palsLast?.length ?? 0) === 0) {
      html += `<div class="empty">还没有帕鲁伙伴。捕获后到帕鲁终端释放，即可指派工作！</div>`;
    } else {
      html += `<div class="pal-list">` + (this.palsLast ?? []).map((p) => {
        const jobOpts = [`<option value="none" ${p.job.kind === "none" ? "selected" : ""}>空闲</option>`,
          `<option value="follow" ${p.job.kind === "follow" ? "selected" : ""}>跟随（采集加速×2）</option>`];
        for (const b of this.buildingsLast ?? []) {
          const match = p.affinity.includes(b.id);
          jobOpts.push(`<option value="b:${b.uid}" ${p.job.kind === "building" && p.job.targetUid === b.uid ? "selected" : ""}>${match ? "⭐" : ""}${b.name}</option>`);
        }
        const sad = p.hunger <= 0 || p.mood < 30;
        return `<div class="pal-row">
          <span class="pal-emoji" style="background:${PALS[p.type]?.color ?? "#888"}">${PALS[p.type]?.name?.[0] ?? "?"}</span>
          <div class="pal-info">
            <div class="pal-name">${p.name} <span class="pal-type">${p.typeName}</span> ${sad ? "😢" : "😊"}</div>
            <div class="pal-bars">饱食 ${bar(p.hunger / 100, "#e0a03c")} 心情 ${bar(p.mood / 100, "#5ec26a")}</div>
          </div>
          <select class="jobsel" data-job="${p.uid}">${jobOpts.join("")}</select>
          <button class="btn small" data-feed="${p.uid}" ${this.berryCount > 0 ? "" : "disabled"}>喂浆果</button>
          <button class="btn small danger" data-free="${p.uid}">放归</button>
        </div>`;
      }).join("") + `</div>`;
    }
    return html;
  }

  private renderHelp(): string {
    return `<div class="help-grid">
      <div><b>WASD / 方向键</b> 移动</div>
      <div><b>鼠标左键</b> 采集 / 交互 / 放置</div>
      <div><b>E</b> 采集最近资源 / 旋转方向</div>
      <div><b>Q / E</b> 旋转放置方向（建造时）</div>
      <div><b>1-9,0</b> 选择快捷栏建筑</div>
      <div><b>B</b> 建造菜单</div>
      <div><b>F</b> 喂跟随帕鲁</div>
      <div><b>右键 / Esc</b> 取消 / 关闭</div>
      <div><b>左键投掷</b> 选中帕鲁球时捕获帕鲁</div>
    </div>
    <div class="help-tip">💡 提示：采矿机要放在矿脉上；传送带从建筑正面（朝向侧）抽取物品；研究所消耗矿石+煤炭合成红瓶并自动研究；最终目标——向戴森环核心投入 ${DYSON_NEEDED} 个戴森组件。</div>`;
  }

  private renderMenu(): string {
    return `<div class="menu-btns">
      <button class="btn wide" id="m-save">💾 保存进度</button>
      <button class="btn wide" id="m-mute">${this.muted ? "🔇 取消静音" : "🔊 静音"}</button>
      <button class="btn wide" id="m-title">🏠 返回标题画面</button>
      <button class="btn wide danger" id="m-reset">🗑 删除存档（危险）</button>
    </div>`;
  }

  // ---- Building panel ----

  showBuildingPanel(data: {
    uid: number; name: string; icon: string; desc: string;
    inB: { id: string; n: number }[]; outB: { id: string; n: number }[];
    recipeId: string | null; recipes: { id: string; name: string; unlocked: boolean }[];
    fuel: number; fuelMax: number; nodeRemaining: number; nodeKind: string | null;
    palUid: number | null; palOptions: { uid: number; name: string; type: string; match: boolean }[];
    dysonFed: number; progress: number; producing: boolean;
  }): void {
    this._panelUid = data.uid;
    const p = document.getElementById("panel")!;
    const stacks = (arr: { id: string; n: number }[]) => arr.length === 0
      ? `<span class="empty">空</span>`
      : arr.map((s) => `<span class="stack" data-take="${s.id}" title="点击取出 1 个">${itemName(s.id)}×${s.n}</span>`).join(" ");

    let body = `<div class="panel-title">${data.icon} ${data.name}</div>
      <div class="panel-desc">${data.desc}</div>`;

    // Recipe selector for producers.
    if (data.recipes.length > 0) {
      body += `<div class="panel-sec">配方：` + data.recipes.map((r) =>
        `<button class="btn small ${r.id === data.recipeId ? "sel" : ""} ${r.unlocked ? "" : "locked"}" data-recipe="${r.id}" ${r.unlocked ? "" : "disabled"}>${r.name}</button>`).join(" ") + `</div>`;
    }
    if (data.recipeId) {
      const r = RECIPES[data.recipeId];
      if (r) {
        const inTxt = Object.entries(r.inputs).map(([id, n]) => `${itemName(id)}×${n}`).join(" + ");
        const outTxt = Object.entries(r.outputs).map(([id, n]) => `${itemName(id)}×${n}`).join(" + ");
        body += `<div class="panel-sec">${inTxt} → ${outTxt}（${r.time}s）${bar(data.progress, "#5aa0e0")}</div>`;
      }
    }
    if (data.nodeKind) {
      body += `<div class="panel-sec">矿脉剩余：${data.nodeRemaining} ${bar(data.nodeRemaining / 26, "#d98a4a")}</div>`;
    }
    if (data.fuelMax > 0) {
      body += `<div class="panel-sec">燃料：${data.fuel.toFixed(1)}/${data.fuelMax}s ${bar(data.fuel / data.fuelMax, "#e0a03c")} <button class="btn small" id="p-fuel">加煤</button></div>`;
    }
    if (data.uid === this.dysonCoreUid) {
      body += `<div class="panel-sec">戴森组件：${data.dysonFed}/${DYSON_NEEDED} ${bar(data.dysonFed / DYSON_NEEDED, "#ffd24a")}<br><button class="btn small" id="p-dyson">投入 1 个戴森组件</button></div>`;
    }
    body += `<div class="panel-sec">输入缓存：${stacks(data.inB)} <button class="btn small" id="p-deposit">存入背包材料</button></div>`;
    body += `<div class="panel-sec">输出缓存：${stacks(data.outB)}</div>`;
    if (data.palOptions.length > 0) {
      const opts = [`<option value="">无</option>`].concat(data.palOptions.map((o) =>
        `<option value="${o.uid}" ${o.uid === data.palUid ? "selected" : ""}>${o.match ? "⭐" : ""}${o.name}（${PALS[o.type]?.name ?? o.type}）</option>`));
      body += `<div class="panel-sec">帕鲁：<select id="p-pal">${opts.join("")}</select> ${data.palUid !== null ? "（加成中）" : ""}</div>`;
    }
    if (!data.producing) body += `<div class="panel-warn">⚠️ 电力不足，生产减速</div>`;
    body += `<div class="panel-foot"><button class="btn small danger" id="p-del">拆除（返还50%）</button></div>`;

    p.innerHTML = body;
    p.classList.remove("hidden");

    p.querySelectorAll("[data-take]").forEach((s) => {
      s.addEventListener("click", () => this.cb.onPanelTake(data.uid, "inB", (s as HTMLElement).dataset.take!));
    });
    p.querySelectorAll("[data-recipe]").forEach((s) => {
      s.addEventListener("click", () => this.cb.onPanelRecipe(data.uid, (s as HTMLElement).dataset.recipe!));
    });
    p.querySelector("#p-deposit")?.addEventListener("click", () => this.cb.onPanelDeposit(data.uid));
    p.querySelector("#p-fuel")?.addEventListener("click", () => this.cb.onPanelDeposit(data.uid));
    p.querySelector("#p-dyson")?.addEventListener("click", () => this.cb.onPanelDyson(data.uid));
    p.querySelector("#p-pal")?.addEventListener("change", (e) => {
      const v = (e.target as HTMLSelectElement).value;
      this.cb.onPanelPalAssign(data.uid, v === "" ? null : Number(v));
    });
    p.querySelector("#p-del")?.addEventListener("click", () => {
      this.cb.onPanelDeconstruct(data.uid);
      this.hideBuildingPanel();
    });
  }

  dysonCoreUid = -1;

  hideBuildingPanel(): void {
    this._panelUid = null;
    document.getElementById("panel")!.classList.add("hidden");
  }

  get panelOpen(): boolean {
    return this._panelUid !== null;
  }

  get panelUid(): number | null {
    return this._panelUid;
  }

  // ---- Start / victory ----

  showStart(hasSave: boolean): void {
    const s = document.getElementById("start")!;
    s.innerHTML = `
      <div class="start-box">
        <div class="start-logo">🪐 幻兽戴森</div>
        <div class="start-sub">PalDyson — 帕鲁 × 戴森球 · 俯视角基地建设</div>
        <div class="start-btns">
          <button class="btn big" id="s-new">🚀 新的冒险</button>
          ${hasSave ? `<button class="btn big" id="s-cont">💾 继续游戏</button>` : ""}
        </div>
        <div class="start-controls">
          <div>WASD 移动 · 左键 采集/放置 · E 交互/旋转 · B 建造 · 数字键 选建筑 · F 喂帕鲁</div>
          <div>目标：建工厂 → 炼铁 → 自动化 → 驯化帕鲁 → 点亮戴森环 🏆</div>
        </div>
      </div>
    `;
    s.classList.remove("hidden");
    s.querySelector("#s-new")!.addEventListener("click", () => {
      Sfx.click();
      s.classList.add("hidden");
      this.cb.onNewGame();
    });
    s.querySelector("#s-cont")?.addEventListener("click", () => {
      Sfx.click();
      s.classList.add("hidden");
      this.cb.onContinue();
    });
  }

  showVictory(stats: { timeS: number; captures: number; built: number; itemsProduced: number }): void {
    const v = document.getElementById("victory")!;
    const days = Math.floor(stats.timeS / 240) + 1;
    v.innerHTML = `
      <div class="victory-box">
        <div class="victory-title">🪐 戴森环已点亮！</div>
        <div class="victory-sub">你的自动化帝国与帕鲁伙伴们共同完成了宏伟工程。</div>
        <div class="victory-stats">
          <div>⏱ 用时：第 ${days} 天</div>
          <div>🟣 捕获帕鲁：${stats.captures}</div>
          <div>🏗 建造建筑：${stats.built}</div>
          <div>⚙️ 生产物品：${stats.itemsProduced}</div>
        </div>
        <button class="btn big" id="v-cont">继续游玩（沙盒模式）</button>
      </div>
    `;
    v.classList.remove("hidden");
    v.querySelector("#v-cont")!.addEventListener("click", () => v.classList.add("hidden"));
  }

  // ---- Live data for modals ----

  invLast: Record<string, number> = {};
  palsLast: PalListEntry[] = [];
  buildingsLast: { uid: number; id: string; name: string }[] = [];
  berryCount = 0;
  techLast: { id: string; name: string; desc: string; icon: string; cost: number; researched: boolean; current: boolean; progress: number; canStart: boolean; reason?: string }[] = [];

  setTechState(techs: typeof this.techLast): void {
    this.techLast = techs;
    const m = document.getElementById("modal")!;
    if (!m.classList.contains("hidden") && m.querySelector(".tech-row")) {
      m.querySelector(".modal-body")!.innerHTML = this.renderTechTree();
      this.wireTechModal(m);
    }
  }

  setPalState(data: {
    pals: PalListEntry[]; palItems: { id: string; type: string; n: number }[];
    buildings: { uid: number; id: string; name: string }[]; berryCount: number;
  }): void {
    this.palsLast = data.pals;
    this.buildingsLast = data.buildings;
    this.berryCount = data.berryCount;
    const m = document.getElementById("modal")!;
    if (!m.classList.contains("hidden") && m.querySelector(".pal-sec-title")) {
      m.querySelector(".modal-body")!.innerHTML = this.renderPals();
      this.wirePalModal(m);
    }
  }

  private wireTechModal(m: HTMLElement): void {
    m.querySelectorAll("[data-tech]").forEach((b) => {
      b.addEventListener("click", () => this.cb.onTechStart((b as HTMLElement).dataset.tech!));
    });
  }

  private wirePalModal(m: HTMLElement): void {
    m.querySelectorAll("[data-release]").forEach((b) => {
      b.addEventListener("click", () => this.cb.onPalRelease((b as HTMLElement).dataset.release!));
    });
    m.querySelectorAll("[data-job]").forEach((s) => {
      s.addEventListener("change", () => {
        const sel = s as HTMLSelectElement;
        const uid = Number(sel.dataset.job);
        const v = sel.value;
        if (v === "none") this.cb.onPalJob(uid, { kind: "none" });
        else if (v === "follow") this.cb.onPalJob(uid, { kind: "follow" });
        else this.cb.onPalJob(uid, { kind: "building", targetUid: Number(v.slice(2)) });
      });
    });
    m.querySelectorAll("[data-feed]").forEach((b) => {
      b.addEventListener("click", () => this.cb.onPalFeed(Number((b as HTMLElement).dataset.feed)));
    });
    m.querySelectorAll("[data-free]").forEach((b) => {
      b.addEventListener("click", () => this.cb.onPalFree(Number((b as HTMLElement).dataset.free)));
    });
  }

  wireMenu(): void {
    const m = document.getElementById("modal")!;
    m.querySelector("#m-save")?.addEventListener("click", () => this.cb.onSave());
    m.querySelector("#m-mute")?.addEventListener("click", () => this.cb.onToggleMute());
    m.querySelector("#m-title")?.addEventListener("click", () => this.cb.onBackToTitle());
    m.querySelector("#m-reset")?.addEventListener("click", () => {
      if (confirm("确定删除存档？此操作不可恢复！")) this.cb.onResetSave();
    });
  }

  setMuted(m: boolean): void {
    this.muted = m;
  }

  get isMuted(): boolean {
    return this.muted;
  }
}
