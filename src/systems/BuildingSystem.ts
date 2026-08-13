// Buildings: placement, production ticking, power grid, buffers, pal boosts.

import Phaser from "phaser";
import type { World } from "./World";
import type { BuildingInst } from "../types";
import { BUILDINGS, RECIPES } from "../data/buildings";
import { PALS } from "../data/pals";
import { TechSystem } from "./TechSystem";
import { Sfx } from "../utils/sound";
import { DIRS, TILE, DYSON_NEEDED, PAL_BOOST_MATCH, PAL_BOOST_OTHER } from "../config";

export interface PowerReport {
  gen: number;
  use: number;
  factor: number;
}

export interface PanelData {
  uid: number;
  inst: BuildingInst;
  name: string;
  icon: string;
  desc: string;
  inB: { id: string; n: number }[];
  outB: { id: string; n: number }[];
  recipeId: string | null;
  recipes: { id: string; name: string; unlocked: boolean }[];
  fuel: number;
  fuelMax: number;
  nodeRemaining: number;
  nodeKind: string | null;
  palUid: number | null;
  palOptions: { uid: number; name: string; type: string; match: boolean }[];
  dysonFed: number;
  progress: number;
  producing: boolean;
}

export class BuildingSystem {
  sprites = new Map<number, Phaser.GameObjects.Image>();
  staticGroup!: Phaser.Physics.Arcade.StaticGroup;
  power: PowerReport = { gen: 0, use: 0, factor: 1 };

  constructor(
    private scene: Phaser.Scene,
    private world: World,
    private onVictory: (fed: number) => void,
  ) {}

  create(): void {
    this.staticGroup = this.scene.physics.add.staticGroup();
    for (const b of this.world.state.buildings) {
      this.spawnSprite(b);
    }
  }

  private spawnSprite(b: BuildingInst): void {
    const def = BUILDINGS[b.id];
    if (!def) return;
    const key = b.id === "belt" ? `bld_belt_${b.dir}` : `bld_${b.id}`;
    const img = this.scene.add.image(b.x * TILE + TILE / 2, b.y * TILE + TILE / 2, key).setDepth(4);
    if (b.id !== "belt") {
      this.staticGroup.add(img);
      (img.body as Phaser.Physics.Arcade.StaticBody).setSize(TILE - 6, TILE - 6);
    }
    this.sprites.set(b.uid, img);
  }

  destroySprite(uid: number): void {
    const img = this.sprites.get(uid);
    if (img) {
      img.destroy();
      this.sprites.delete(uid);
    }
  }

  // ---- Placement ----

  canPlaceAt(id: string, x: number, y: number): { ok: boolean; reason?: string } {
    if (x < 1 || y < 1 || x >= 95 || y >= 95) return { ok: false, reason: "地图边界" };
    if (!this.world.isWalkable(x, y)) return { ok: false, reason: "水面无法建造" };
    if (this.world.buildingAt(x, y) || this.world.beltAt(x, y)) return { ok: false, reason: "位置已被占用" };
    const def = BUILDINGS[id];
    if (!def) return { ok: false, reason: "未知建筑" };
    if (def.requiresNode) {
      const node = this.world.nodeAt(x, y);
      if (!node || !def.requiresNode.includes(node.kind)) {
        return { ok: false, reason: "需要放置在矿脉上" };
      }
    }
    return { ok: true };
  }

  canAfford(id: string): boolean {
    const cost = BUILDINGS[id].cost;
    for (const [item, n] of Object.entries(cost)) {
      if (this.world.invCount(item) < n) return false;
    }
    return true;
  }

  deductCost(id: string): void {
    const cost = BUILDINGS[id].cost;
    for (const [item, n] of Object.entries(cost)) {
      this.world.invRemove(item, n);
    }
  }

  place(id: string, x: number, y: number, dir: number): BuildingInst {
    const b: BuildingInst = {
      uid: this.world.nextUid(),
      id,
      x,
      y,
      dir: dir as BuildingInst["dir"],
      inB: [],
      outB: [],
      recipeId: null,
      progress: 0,
      prodCount: 0,
      fuel: 0,
      palUid: null,
    };
    const def = BUILDINGS[id];
    if (def.recipes && def.recipes.length > 0) {
      b.recipeId = def.recipes[0];
    }
    this.world.state.buildings.push(b);
    this.world.state.stats.built++;
    this.spawnSprite(b);
    Sfx.build();
    return b;
  }

  deconstruct(uid: number): void {
    const b = this.world.buildingByUid(uid);
    if (!b) return;
    const def = BUILDINGS[b.id];
    // Refund 50% (floor) of the cost.
    for (const [item, n] of Object.entries(def.cost)) {
      const refund = Math.floor(n / 2);
      if (refund > 0) this.world.invAdd(item, refund);
    }
    // Unassign pal.
    if (b.palUid !== null) {
      const pal = this.world.palByUid(b.palUid);
      if (pal) pal.job = { kind: "none" };
    }
    this.world.state.buildings = this.world.state.buildings.filter((x) => x.uid !== uid);
    this.destroySprite(uid);
    Sfx.deconstruct();
  }

  // ---- Power ----

  private windFactor(): number {
    const t = this.world.state.time;
    return 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(t / 11));
  }

  recomputePower(): void {
    let gen = 0;
    let use = 0;
    for (const b of this.world.state.buildings) {
      const def = BUILDINGS[b.id];
      if (!def) continue;
      const boost = this.palBoost(b);
      if (def.powerGen) {
        if (b.id === "wind_turbine") {
          gen += def.powerGen * this.windFactor() * boost;
        } else if (b.id === "coal_generator") {
          if (b.fuel > 0) gen += def.powerGen * boost;
        } else {
          gen += def.powerGen * boost;
        }
      }
      if (def.powerUse) use += def.powerUse;
    }
    const factor = use > 0 ? Math.min(1, gen / use) : 1;
    this.power = { gen, use, factor };
  }

  palBoost(b: BuildingInst): number {
    if (b.palUid === null) return 1;
    const pal = this.world.palByUid(b.palUid);
    if (!pal) return 1;
    if (pal.hunger <= 0 || pal.mood < 30) return 1;
    const def = PALS[pal.type];
    if (!def) return 1;
    return def.worksWith.includes(b.id) ? PAL_BOOST_MATCH : PAL_BOOST_OTHER;
  }

  /** Whether an item is accepted into a building's input buffer. */
  acceptsItem(b: BuildingInst, itemId: string): boolean {
    const def = BUILDINGS[b.id];
    if (!def) return false;
    if (b.id === "chest") return true;
    if (b.id === "dyson_core") return itemId === "dyson_component";
    if (b.id === "pal_terminal") return itemId.startsWith("pal_");
    if (def.fuel) return itemId === def.fuel.item;
    if (def.recipes || def.fixedRecipe) {
      const recipeIds = def.recipes ?? (def.fixedRecipe ? [def.fixedRecipe] : []);
      for (const rid of recipeIds) {
        const r = RECIPES[rid];
        if (r && r.inputs[itemId] !== undefined) return true;
      }
      return false;
    }
    return false; // mining drill takes nothing
  }

  // ---- Production tick ----

  tick(dt: number): void {
    this.recomputePower();
    const pf = this.power.factor;
    for (const b of this.world.state.buildings) {
      const def = BUILDINGS[b.id];
      if (!def) continue;
      const boost = this.palBoost(b);

      // Fuel burn.
      if (def.fuel) {
        if (b.fuel > 0) {
          b.fuel -= dt;
        } else if (this.world.bRemove(b, "inB", def.fuel.item, 1) === 1) {
          b.fuel = def.fuel.burnS;
        }
        continue;
      }

      // Mining drill: drains the node below.
      if (b.id === "mining_drill") {
        const node = this.world.nodeAt(b.x, b.y);
        if (node && node.remaining > 0 && pf > 0) {
          b.progress += (dt / 3) * boost * pf;
          if (b.progress >= 1) {
            b.progress = 0;
            node.remaining--;
            const item = node.kind === "iron" ? "iron_ore" : node.kind === "coal" ? "coal" : "";
            if (item && this.world.bAdd(b, "outB", item, 1) > 0) {
              b.prodCount++;
              this.world.state.stats.itemsProduced++;
            }
            if (node.remaining <= 0) {
              delete this.world.state.nodes[`${b.x},${b.y}`];
              this.scene.events.emit("node-depleted", b.x, b.y);
            }
          }
        }
        continue;
      }

      // Producers (furnace / assembler / lab).
      const recipeId = b.id === "research_lab" ? (def.fixedRecipe ?? null) : b.recipeId;
      if (recipeId && RECIPES[recipeId]) {
        const r = RECIPES[recipeId];
        const hasInputs = Object.entries(r.inputs).every(([id, n]) => this.world.bCount(b, "inB", id) >= n);
        const outRoom = Object.entries(r.outputs).every(([_id, n]) => {
          const cur = b.outB.reduce((a, s) => a + s.n, 0);
          return cur + n <= 12;
        });
        if (hasInputs && outRoom && pf > 0) {
          b.progress += (dt / r.time) * boost * pf;
          if (b.progress >= 1) {
            b.progress = 0;
            for (const [id, n] of Object.entries(r.inputs)) this.world.bRemove(b, "inB", id, n);
            for (const [id, n] of Object.entries(r.outputs)) {
              this.world.bAdd(b, "outB", id, n);
              this.world.state.stats.itemsProduced += n;
            }
            b.prodCount++;
            Sfx.insert();
          }
        }
        continue;
      }

      // Dyson core: nothing to tick (fed manually / via belts).
    }
  }

  // ---- Panel interactions ----

  panelData(uid: number): PanelData | null {
    const b = this.world.buildingByUid(uid);
    if (!b) return null;
    const def = BUILDINGS[b.id];
    const recipeIds = def.recipes ?? [];
    const node = this.world.nodeAt(b.x, b.y);
    return {
      uid: b.uid,
      inst: b,
      name: def.name,
      icon: def.icon,
      desc: def.desc,
      inB: b.inB.map((s) => ({ ...s })),
      outB: b.outB.map((s) => ({ ...s })),
      recipeId: b.recipeId,
      recipes: recipeIds.map((rid) => ({
        id: rid,
        name: RECIPES[rid]?.name ?? rid,
        unlocked: RECIPES[rid]?.tech ? TechSystem.unlocked(this.world.state, RECIPES[rid].tech!) : true,
      })),
      fuel: b.fuel,
      fuelMax: def.fuel?.burnS ?? 0,
      nodeRemaining: node?.remaining ?? 0,
      nodeKind: node?.kind ?? null,
      palUid: b.palUid,
      palOptions: this.world.state.pals.map((p) => ({
        uid: p.uid,
        name: p.name,
        type: p.type,
        match: (PALS[p.type]?.worksWith.includes(b.id)) ?? false,
      })),
      dysonFed: this.world.state.stats.dysonFed,
      progress: b.progress,
      producing: this.power.factor > 0,
    };
  }

  take(uid: number, which: "inB" | "outB", itemId: string): void {
    const b = this.world.buildingByUid(uid);
    if (!b) return;
    if (this.world.bRemove(b, which, itemId, 1) === 1) {
      this.world.invAdd(itemId, 1);
      Sfx.click();
    }
  }

  deposit(uid: number, itemId: string, n: number): void {
    const b = this.world.buildingByUid(uid);
    if (!b) return;
    if (!this.acceptsItem(b, itemId)) return;
    const have = this.world.invCount(itemId);
    const take = Math.min(n, have);
    if (take <= 0) return;
    const added = this.world.bAdd(b, "inB", itemId, take);
    if (added > 0) {
      this.world.invRemove(itemId, added);
      Sfx.insert();
    }
  }

  depositAllAccepted(uid: number): void {
    const b = this.world.buildingByUid(uid);
    if (!b) return;
    for (const [itemId, count] of Object.entries(this.world.state.inventory)) {
      if (count <= 0) continue;
      if (this.acceptsItem(b, itemId)) this.deposit(uid, itemId, count);
    }
  }

  setRecipe(uid: number, recipeId: string): void {
    const b = this.world.buildingByUid(uid);
    if (!b) return;
    const def = BUILDINGS[b.id];
    if (def.recipes && def.recipes.includes(recipeId)) {
      b.recipeId = recipeId;
      b.progress = 0;
      Sfx.click();
    }
  }

  feedDyson(uid: number): void {
    const b = this.world.buildingByUid(uid);
    if (!b) return;
    if (this.world.bRemove(b, "inB", "dyson_component", 1) === 1) {
      this.world.state.stats.dysonFed++;
      Sfx.capture();
      if (this.world.state.stats.dysonFed >= DYSON_NEEDED) {
        this.onVictory(this.world.state.stats.dysonFed);
      }
    }
  }

  /** Output side world position (facing dir). */
  outputPos(b: BuildingInst): { x: number; y: number } {
    const d = DIRS[b.dir];
    return { x: b.x + d.x, y: b.y + d.y };
  }
}
