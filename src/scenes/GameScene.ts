// GameScene: wires all systems together — input, camera, world init, update loop.

import Phaser from "phaser";
import type { Dir, WorldState } from "../types";
import { World, T_GRASS, T_WATER, tileFromWorld, tileKey, tileCenterX, tileCenterY } from "../systems/World";
import { Player } from "../systems/Player";
import { BuildingSystem } from "../systems/BuildingSystem";
import { BeltSystem } from "../systems/BeltSystem";
import { PalSystem } from "../systems/PalSystem";
import { TechSystem } from "../systems/TechSystem";
import { UI } from "../ui/UI";
import { Sfx } from "../utils/sound";
import { saveGame, loadGame, hasSave, clearSave } from "../utils/save";
import { BUILDINGS } from "../data/buildings";
import { NODE_DEFS, NODE_ITEMS } from "../systems/World";
import {
  TILE, MAP_W, MAP_H, GATHER_INTERVAL_MS, GATHER_RANGE_TILES, INTERACT_RANGE_TILES,
  AUTOSAVE_MS, PROD_TICK_MS, BELT_TICK_MS, DAY_LENGTH,
} from "../config";

interface GatherState {
  key: string;
  x: number;
  y: number;
  acc: number;
  gfx: Phaser.GameObjects.Graphics | null;
}

export class GameScene extends Phaser.Scene {
  world!: World;
  player!: Player;
  buildSys!: BuildingSystem;
  beltSys!: BeltSystem;
  palSys!: PalSystem;
  techSys!: TechSystem;
  ui!: UI;

  private started = false;
  private sel: { id: string; dir: Dir } | null = null;
  private ghost: Phaser.GameObjects.Image | null = null;
  private reticle!: Phaser.GameObjects.Image;
  private nightOverlay!: Phaser.GameObjects.Rectangle;
  private nodeSprites = new Map<string, Phaser.GameObjects.Image>();
  private gather: GatherState | null = null;
  private pointerDown = false;
  private pointerWorld = { x: 0, y: 0 };

  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private accProd = 0;
  private accBelt = 0;
  private accTech = 0;
  private accSave = 0;
  private accUi = 0;
  private accPanel = 0;
  private timeTextAcc = 0;

  constructor() {
    super("game");
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#10141f");

    this.ui = new UI({
      onSelectBuild: (id) => this.selectBuild(id),
      onRotate: () => this.rotate(),
      onTechStart: (id) => {
        if (this.techSys.start(id)) {
          Sfx.click();
          this.toast("开始研究：" + id, "info");
        } else {
          Sfx.error();
        }
      },
      onPalRelease: (type) => {
        if (this.palSys.releaseFromInventory(type)) {
          this.toast("已释放一只" + type + "到终端", "good");
        } else {
          this.toast("需要先建造帕鲁终端！", "warn");
          Sfx.error();
        }
      },
      onPalJob: (uid, job) => this.palSys.assignJob(uid, job as never),
      onPalFeed: (uid) => {
        if (!this.palSys.feed(uid)) this.toast("没有浆果可以喂食", "warn");
      },
      onPalFree: (uid) => this.palSys.release(uid),
      onPanelTake: (uid, which, itemId) => this.buildSys.take(uid, which, itemId),
      onPanelDeposit: (uid) => this.buildSys.depositAllAccepted(uid),
      onPanelRecipe: (uid, recipeId) => this.buildSys.setRecipe(uid, recipeId),
      onPanelDeconstruct: (uid) => {
        this.buildSys.deconstruct(uid);
        this.ui.hideBuildingPanel();
        this.toast("建筑已拆除（返还50%材料）", "info");
      },
      onPanelDyson: (uid) => this.buildSys.feedDyson(uid),
      onPanelPalAssign: (uid, palUid) => {
        const b = this.world.buildingByUid(uid);
        if (b) {
          if (palUid === null) {
            if (b.palUid !== null) this.palSys.assignJob(b.palUid, { kind: "none" });
          } else {
            const pal = this.world.palByUid(palUid);
            if (pal) this.palSys.assignJob(palUid, { kind: "building", targetUid: uid });
          }
        }
      },
      onNewGame: () => this.startNewGame(),
      onContinue: () => this.continueGame(),
      onSave: () => {
        if (this.started && saveGame(this.world.toSave())) {
          this.toast("💾 已保存", "good");
        }
      },
      onToggleMute: () => {
        const m = !this.ui.isMuted;
        this.ui.setMuted(m);
        Sfx.setMuted(m);
      },
      onResetSave: () => {
        clearSave();
        location.reload();
      },
      onBackToTitle: () => {
        location.reload();
      },
    });
    this.ui.init();

    this.reticle = this.add.image(0, 0, "reticle").setDepth(10).setVisible(false);
    this.nightOverlay = this.add.rectangle(0, 0, 10, 10, 0x0a1030, 0).setDepth(20).setOrigin(0);

    this.setupInput();
    this.ui.showStart(hasSave());
  }

  // ---- World init ----

  private startNewGame(): void {
    const seed = Math.floor(Math.random() * 1000000);
    this.initWorld(seed, true);
  }

  private continueGame(): void {
    const loaded = loadGame();
    if (loaded) {
      this.initWorld(loaded.seed, false, loaded);
    } else {
      this.startNewGame();
    }
  }

  private initWorld(seed: number, fresh: boolean, loaded?: WorldState): void {
    this.world = new World(seed, fresh, loaded);

    // Terrain tilemap.
    const data: number[][] = [];
    for (let y = 0; y < MAP_H; y++) {
      const row: number[] = [];
      for (let x = 0; x < MAP_W; x++) {
        const t = this.world.terrain[y * MAP_W + x];
        if (t === T_WATER) row.push(3);
        else if (t === T_GRASS) row.push(Math.floor(Math.random() * 3));
        else row.push(4);
      }
      data.push(row);
    }
    const map = this.make.tilemap({ data, tileWidth: TILE, tileHeight: TILE });
    const tiles = map.addTilesetImage("terrain_tiles", "terrain_tiles", TILE, TILE)!;
    const layer = map.createLayer(0, tiles, 0, 0)!;
    layer.setCollision([3]);
    layer.setDepth(0);

    this.physics.world.setBounds(0, 0, MAP_W * TILE, MAP_H * TILE);
    this.cameras.main.setBounds(0, 0, MAP_W * TILE, MAP_H * TILE);
    this.cameras.main.setZoom(1);

    // Nodes.
    this.nodeSprites.clear();
    for (const [key, node] of Object.entries(this.world.state.nodes)) {
      const [x, y] = key.split(",").map(Number);
      const img = this.add.image(tileCenterX(x), tileCenterY(y), NODE_DEFS[node.kind].tex).setDepth(2);
      this.nodeSprites.set(key, img);
    }
    this.events.on("node-depleted", (x: number, y: number) => {
      const key = tileKey(x, y);
      this.nodeSprites.get(key)?.destroy();
      this.nodeSprites.delete(key);
      if (this.gather?.key === key) this.stopGather();
    });

    this.player = new Player(this, this.world);
    this.player.create();
    this.physics.add.collider(this.player.sprite, layer);

    this.buildSys = new BuildingSystem(this, this.world, (fed) => {
      this.ui.setDyson(fed);
      this.ui.showVictory({
        timeS: this.world.state.time,
        captures: this.world.state.stats.captures,
        built: this.world.state.stats.built,
        itemsProduced: this.world.state.stats.itemsProduced,
      });
      Sfx.victory();
    });
    this.buildSys.create();
    this.physics.add.collider(this.player.sprite, this.buildSys.staticGroup);

    this.beltSys = new BeltSystem(this, this.world, (b, itemId) => this.buildSys.acceptsItem(b, itemId));
    this.beltSys.create();

    this.palSys = new PalSystem(this, this.world);
    this.palSys.create();

    this.techSys = new TechSystem(this, this.world.state);
    this.events.on("tech-complete", (tech: { name: string }) => {
      this.toast(`🔬 科技完成：${tech.name}！`, "good");
      this.ui.refreshBuilds(this.lockedSet());
      this.selectBuild(null);
    });

    this.cameras.main.startFollow(this.player.sprite, true, 0.12, 0.12);
    this.cameras.main.roundPixels = true;
    this.player.setFollower(this.palSys.followerPal());

    // Track a pre-existing dyson core from a loaded save.
    const dyson = this.world.state.buildings.find((b) => b.id === "dyson_core");
    if (dyson) this.ui.dysonCoreUid = dyson.uid;

    this.started = true;
    this.accProd = 0;
    this.accBelt = 0;
    this.accSave = 0;

    // Starter supplies.
    if (fresh) {
      this.world.invAdd("wood", 8);
      this.world.invAdd("stone", 4);
      this.world.invAdd("berries", 5);
    }

    this.ui.refreshBuilds(this.lockedSet());
    this.pushUiState(true);
    this.toast("🚀 欢迎来到幻兽戴森！目标：点亮戴森环。", "info");

    // Debug/test handle.
    (window as unknown as Record<string, unknown>).__paldyson = {
      scene: this,
      world: this.world,
      buildSys: this.buildSys,
      beltSys: this.beltSys,
      palSys: this.palSys,
      techSys: this.techSys,
    };
  }

  private lockedSet(): Set<string> {
    const s = new Set<string>();
    for (const id of Object.keys(BUILDINGS)) {
      const def = BUILDINGS[id];
      if (def.tech && !TechSystem.unlocked(this.world.state, id)) s.add(id);
    }
    return s;
  }

  // ---- Input ----

  private setupInput(): void {
    const kb = this.input.keyboard!;
    this.keys = {
      W: kb.addKey("W"), A: kb.addKey("A"), S: kb.addKey("S"), D: kb.addKey("D"),
      UP: kb.addKey("UP"), DOWN: kb.addKey("DOWN"), LEFT: kb.addKey("LEFT"), RIGHT: kb.addKey("RIGHT"),
      E: kb.addKey("E"), Q: kb.addKey("Q"), F: kb.addKey("F"), B: kb.addKey("B"), ESC: kb.addKey("ESC"),
    };
    for (let i = 1; i <= 10; i++) {
      this.keys[`NUM${i}`] = kb.addKey(i === 10 ? "ZERO" : ["ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE"][i - 1]);
    }
    const hotbarOrder = ["wind_turbine", "mining_drill", "furnace", "assembler", "research_lab", "belt", "chest", "coal_generator", "pal_terminal", "dyson_core"];
    for (let i = 1; i <= 10; i++) {
      const id = hotbarOrder[i - 1];
      this.keys[`NUM${i}`].on("down", () => {
        if (!this.started) return;
        const locked = this.lockedSet().has(id);
        if (locked) {
          this.toast("该建筑尚未解锁（需要研究科技）", "warn");
          return;
        }
        this.selectBuild(this.sel?.id === id ? null : id);
      });
    }
    this.keys.E.on("down", () => {
      if (!this.started || this.ui.isModalOpen) return;
      if (this.sel) {
        this.rotate();
        return;
      }
      this.interactE();
    });
    this.keys.Q.on("down", () => this.rotate());
    this.keys.F.on("down", () => {
      if (!this.started) return;
      const pal = this.palSys.followerPal();
      if (pal) {
        if (!this.palSys.feed(pal.uid)) this.toast("没有浆果可以喂食", "warn");
      } else {
        this.toast("没有跟随的帕鲁（在帕鲁面板中指派）", "warn");
      }
    });
    this.keys.B.on("down", () => {
      if (this.started) this.ui.toggleBuildMenu();
    });
    this.keys.ESC.on("down", () => {
      if (this.ui.isModalOpen) {
        this.ui.closeModal();
      } else if (this.sel) {
        this.selectBuild(null);
      } else if (this.ui.panelOpen) {
        this.ui.hideBuildingPanel();
      }
    });

    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      this.pointerWorld = this.cameras.main.getWorldPoint(p.x, p.y);
      this.reticle.setPosition(this.pointerWorld.x, this.pointerWorld.y);
      this.reticle.setVisible(true);
      this.updateGhost();
    });
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      Sfx.unlock();
      if (!this.started || this.ui.isModalOpen) return;
      if (p.rightButtonDown()) {
        if (this.sel) this.selectBuild(null);
        else this.ui.hideBuildingPanel();
        return;
      }
      this.pointerDown = true;
      this.handleClick();
    });
    this.input.on("pointerup", () => {
      this.pointerDown = false;
      this.stopGather();
    });
  }

  private selectBuild(id: string | null): void {
    this.sel = id ? { id, dir: 1 } : null;
    this.ui.applySelection(id);
    if (this.sel) {
      this.ui.hideBuildingPanel();
      if (this.ghost) this.ghost.destroy();
      if (this.sel.id !== "sphere") {
        const tex = this.sel.id === "belt" ? `bld_belt_${this.sel.dir}` : `bld_${this.sel.id}`;
        this.ghost = this.add.image(0, 0, tex).setDepth(9).setAlpha(0.75);
        this.updateGhost();
      }
    } else if (this.ghost) {
      this.ghost.destroy();
      this.ghost = null;
    }
  }

  private rotate(): void {
    if (!this.sel) return;
    this.sel.dir = ((this.sel.dir + 1) % 4) as Dir;
    if (this.ghost) {
      this.ghost.setTexture(this.sel.id === "belt" ? `bld_belt_${this.sel.dir}` : `bld_${this.sel.id}`);
    }
    this.updateGhost();
  }

  private updateGhost(): void {
    if (!this.ghost || !this.sel || !this.world) return;
    const t = tileFromWorld(this.pointerWorld.x, this.pointerWorld.y);
    this.ghost.setPosition(tileCenterX(t.x), tileCenterY(t.y));
    if (this.sel.id === "sphere") return;
    const check = this.buildSys.canPlaceAt(this.sel.id, t.x, t.y);
    const afford = this.buildSys.canAfford(this.sel.id);
    this.ghost.setTint(check.ok && afford ? 0x5ec26a : 0xe04848);
  }

  private handleClick(): void {
    if (!this.started) return;
    const t = tileFromWorld(this.pointerWorld.x, this.pointerWorld.y);
    const p = this.world.state.player;

    if (this.sel) {
      if (this.sel.id === "sphere") {
        // Throw a pal sphere.
        if (this.world.invCount("pal_sphere") <= 0) {
          this.toast("没有帕鲁球了！在组装机中制造。", "warn");
          Sfx.error();
          return;
        }
        this.palSys.throwSphere(p.x, p.y, this.pointerWorld.x, this.pointerWorld.y);
        return;
      }
      // Place building.
      const check = this.buildSys.canPlaceAt(this.sel.id, t.x, t.y);
      if (!check.ok) {
        this.toast(check.reason ?? "无法建造", "warn");
        Sfx.error();
        return;
      }
      if (!this.buildSys.canAfford(this.sel.id)) {
        this.toast("材料不足！", "warn");
        Sfx.error();
        return;
      }
      this.buildSys.deductCost(this.sel.id);
      if (this.sel.id === "belt") {
        this.beltSys.place(t.x, t.y, this.sel.dir);
      } else {
        const inst = this.buildSys.place(this.sel.id, t.x, t.y, this.sel.dir);
        if (inst.id === "dyson_core") {
          // Track for the panel's dyson section.
          this.ui.dysonCoreUid = inst.uid;
        }
        this.openPanel(inst.uid);
      }
      this.selectBuild(null);
      return;
    }

    // Interact: building in range?
    const near = Phaser.Math.Distance.Between(p.x, p.y, this.pointerWorld.x, this.pointerWorld.y) <= INTERACT_RANGE_TILES * TILE;
    const building = this.world.buildingAt(t.x, t.y);
    if (building && near) {
      this.openPanel(building.uid);
      return;
    }
    if (building && !near) {
      this.toast("离得太远了", "dim");
      return;
    }

    // Gather node?
    const node = this.world.nodeAt(t.x, t.y);
    if (node && near) {
      this.startGather(t.x, t.y);
      return;
    }
    if (node && !near) {
      this.toast("离得太远了", "dim");
    }
  }

  private openPanel(uid: number): void {
    const data = this.buildSys.panelData(uid);
    if (data) this.ui.showBuildingPanel(data);
  }

  private interactE(): void {
    const p = this.world.state.player;
    const pt = tileFromWorld(p.x, p.y);
    // Nearest node in range.
    let bestNode: { x: number; y: number } | null = null;
    let bestD = GATHER_RANGE_TILES;
    for (const key of this.nodeSprites.keys()) {
      const [x, y] = key.split(",").map(Number);
      const d = Phaser.Math.Distance.Between(x, y, pt.x, pt.y);
      if (d < bestD) {
        bestD = d;
        bestNode = { x, y };
      }
    }
    if (bestNode) {
      this.gatherOnce(bestNode.x, bestNode.y);
      return;
    }
    // Nearest building in range.
    for (const b of this.world.state.buildings) {
      const d = Phaser.Math.Distance.Between(b.x, b.y, pt.x, pt.y);
      if (d <= INTERACT_RANGE_TILES) {
        this.openPanel(b.uid);
        return;
      }
    }
  }

  // ---- Gathering ----

  private startGather(x: number, y: number): void {
    const key = tileKey(x, y);
    const node = this.world.nodeAt(x, y);
    if (!node) return;
    this.stopGather();
    this.gather = { key, x, y, acc: 0, gfx: null };
    this.gatherOnce(x, y);
  }

  private stopGather(): void {
    if (this.gather?.gfx) this.gather.gfx.destroy();
    this.gather = null;
  }

  private gatherOnce(x: number, y: number): void {
    const node = this.world.nodeAt(x, y);
    if (!node || node.remaining <= 0) return;
    const item = NODE_ITEMS[node.kind];
    node.remaining--;
    this.world.invAdd(item, this.player.gatherBoost);
    Sfx.gather();
    if (node.remaining <= 0) {
      delete this.world.state.nodes[tileKey(x, y)];
      this.nodeSprites.get(tileKey(x, y))?.destroy();
      this.nodeSprites.delete(tileKey(x, y));
      this.stopGather();
    }
  }

  private updateGather(dt: number): void {
    if (!this.gather || !this.pointerDown) return;
    const g = this.gather;
    const node = this.world.nodeAt(g.x, g.y);
    if (!node) {
      this.stopGather();
      return;
    }
    const p = this.world.state.player;
    const d = Phaser.Math.Distance.Between(p.x, p.y, tileCenterX(g.x), tileCenterY(g.y));
    if (d > GATHER_RANGE_TILES * TILE) {
      this.stopGather();
      return;
    }
    g.acc += dt;
    const interval = GATHER_INTERVAL_MS / this.player.gatherBoost;
    // Draw progress bar.
    if (!g.gfx) {
      g.gfx = this.add.graphics().setDepth(9);
    }
    g.gfx.clear();
    const cx = tileCenterX(g.x);
    const cy = tileCenterY(g.y) - 26;
    g.gfx.fillStyle(0x000000, 0.6);
    g.gfx.fillRect(cx - 18, cy, 36, 6);
    g.gfx.fillStyle(0xffd24a, 1);
    g.gfx.fillRect(cx - 17, cy + 1, 34 * Math.min(1, g.acc / interval), 4);
    while (g.acc >= interval) {
      g.acc -= interval;
      this.gatherOnce(g.x, g.y);
      if (!this.gather || !this.world.nodeAt(g.x, g.y)) return;
    }
  }

  // ---- Update loop ----

  override update(_t: number, delta: number): void {
    if (!this.started) return;
    const dt = Math.min(delta / 1000, 0.05);
    this.world.state.time += dt;

    // Movement.
    let ax = 0, ay = 0;
    const k = this.keys;
    if (k.A.isDown || k.LEFT.isDown) ax -= 1;
    if (k.D.isDown || k.RIGHT.isDown) ax += 1;
    if (k.W.isDown || k.UP.isDown) ay -= 1;
    if (k.S.isDown || k.DOWN.isDown) ay += 1;
    if (ax !== 0 && ay !== 0) {
      ax *= 0.7071;
      ay *= 0.7071;
    }
    this.player.update(dt * 1000, ax, ay);
    this.updateGather(dt * 1000);

    // Systems.
    this.accBelt += dt;
    if (this.accBelt >= BELT_TICK_MS / 1000) {
      this.accBelt = 0;
      this.beltSys.tick(BELT_TICK_MS / 1000);
      this.beltSys.updateSprites();
    }
    this.accProd += dt;
    if (this.accProd >= PROD_TICK_MS / 1000) {
      this.accProd = 0;
      this.buildSys.tick(PROD_TICK_MS / 1000);
    }
    this.accTech += dt;
    if (this.accTech >= PROD_TICK_MS / 1000) {
      this.accTech = 0;
      this.techSys.tick(PROD_TICK_MS / 1000);
      this.palSys.drain(PROD_TICK_MS / 1000);
    }
    this.palSys.update(dt * 1000, this.isNight());
    if (this.player.follower) {
      const pal = this.palSys.followerPal();
      if (!pal) this.player.setFollower(null);
    }

    // Night overlay.
    const night = this.isNight();
    const alpha = night ? 0.45 : 0;
    const rect = this.nightOverlay;
    rect.setPosition(this.cameras.main.scrollX, this.cameras.main.scrollY);
    rect.setSize(this.cameras.main.width, this.cameras.main.height);
    rect.setAlpha(Phaser.Math.Linear(rect.alpha, alpha, 0.02));

    // Throttled UI updates.
    this.accUi += dt;
    this.accPanel += dt;
    this.timeTextAcc += dt;
    if (this.accUi >= 0.2) {
      this.accUi = 0;
      this.pushUiState(false);
    }
    if (this.ui.panelOpen && this.accPanel >= 0.3) {
      this.accPanel = 0;
      const uid = this.ui.panelUid;
      const data = this.buildSys.panelData(uid ?? -1);
      if (data) this.ui.showBuildingPanel(data);
    }
    if (this.timeTextAcc >= 1) {
      this.timeTextAcc = 0;
      const hour = 6 + (24 * this.world.state.time) / DAY_LENGTH;
      this.ui.setTime(Math.floor(this.world.state.time / DAY_LENGTH) + 1, hour, this.isNight());
    }

    // Autosave.
    this.accSave += dt;
    if (this.accSave >= AUTOSAVE_MS / 1000) {
      this.accSave = 0;
      saveGame(this.world.toSave());
    }
  }

  private isNight(): boolean {
    const hour = 6 + (24 * this.world.state.time) / DAY_LENGTH;
    return hour < 6 || hour >= 19;
  }

  private pushUiState(_force: boolean): void {
    const inv = this.world.state.inventory;
    this.ui.setInventory(inv);
    this.ui.setPower(this.buildSys.power.gen, this.buildSys.power.use);
    this.ui.setDyson(this.world.state.stats.dysonFed);
    this.ui.setTechState(this.techSys.list() as never);
    const modal = document.getElementById("modal");
    if (modal && !modal.classList.contains("hidden") && modal.querySelector(".pal-sec-title")) {
      this.ui.setPalState({
        pals: this.palSys.roster().pals as never,
        palItems: this.palSys.roster().palItems,
        buildings: this.world.state.buildings
          .map((b) => ({ uid: b.uid, id: b.id, name: BUILDINGS[b.id]?.name ?? b.id })),
        berryCount: this.world.invCount("berries"),
      });
    }
  }

  private toast(text: string, kind: "info" | "warn" | "good" | "dim" = "info"): void {
    this.ui.toast(text, kind === "dim" ? "info" : kind);
  }
}
