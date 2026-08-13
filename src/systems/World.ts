// World: map generation + the serializable game state + grid helpers.

import { MAP_W, MAP_H, TILE } from "../config";
import { RNG } from "../utils/rng";
import type { NodeKind, NodeState, WorldState, BuildingInst, BeltInst, ItemStack } from "../types";
import { countStack, removeStack } from "../utils/inv";

export const T_GRASS = 0;
export const T_WATER = 1;

export const NODE_DEFS: Record<NodeKind, { max: [number, number]; tex: string }> = {
  tree: { max: [6, 10], tex: "node_tree" },
  rock: { max: [6, 10], tex: "node_rock" },
  iron: { max: [16, 26], tex: "node_iron" },
  coal: { max: [12, 20], tex: "node_coal" },
  berry: { max: [4, 7], tex: "node_berry" },
};

export const NODE_ITEMS: Record<NodeKind, string> = {
  tree: "wood",
  rock: "stone",
  iron: "iron_ore",
  coal: "coal",
  berry: "berries",
};

export function tileKey(x: number, y: number): string {
  return `${x},${y}`;
}

export function tileCenterX(x: number): number {
  return x * TILE + TILE / 2;
}

export function tileCenterY(y: number): number {
  return y * TILE + TILE / 2;
}

export function tileFromWorld(px: number, py: number): { x: number; y: number } {
  return { x: Math.floor(px / TILE), y: Math.floor(py / TILE) };
}

function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

export class World {
  state: WorldState;
  terrain: Uint8Array;
  spawnTX = Math.floor(MAP_W / 2);
  spawnTY = Math.floor(MAP_H / 2);

  constructor(seed: number, fresh: boolean, loaded?: WorldState) {
    this.terrain = new Uint8Array(MAP_W * MAP_H);
    if (fresh) {
      this.state = this.freshState(seed);
    } else if (loaded) {
      this.state = loaded;
    } else {
      this.state = this.freshState(seed);
    }
    this.gen();
  }

  private freshState(seed: number): WorldState {
    return {
      version: 1,
      seed,
      time: 0,
      nodes: {},
      player: { x: 0, y: 0 },
      inventory: {},
      buildings: [],
      belts: [],
      pals: [],
      research: { researched: [], current: null, progress: 0, redAcc: 0 },
      nextUid: 1,
      stats: { captures: 0, built: 0, itemsProduced: 0, dysonFed: 0 },
    };
  }

  /** Generate terrain + initial nodes. Called once at construction. */
  private gen(): void {
    const rng = new RNG(this.state.seed);
    const idx = (x: number, y: number) => y * MAP_W + x;

    // Border is water.
    for (let x = 0; x < MAP_W; x++) {
      this.terrain[idx(x, 0)] = T_WATER;
      this.terrain[idx(x, MAP_H - 1)] = T_WATER;
    }
    for (let y = 0; y < MAP_H; y++) {
      this.terrain[idx(0, y)] = T_WATER;
      this.terrain[idx(MAP_W - 1, y)] = T_WATER;
    }

    // Lake blobs.
    const lakes = 9;
    for (let i = 0; i < lakes; i++) {
      let cx = rng.int(10, MAP_W - 10);
      let cy = rng.int(10, MAP_H - 10);
      const steps = rng.int(60, 140);
      const radius = rng.int(2, 4);
      for (let s = 0; s < steps; s++) {
        for (let dx = -radius; dx <= radius; dx++) {
          for (let dy = -radius; dy <= radius; dy++) {
            const x = cx + dx;
            const y = cy + dy;
            if (x > 1 && y > 1 && x < MAP_W - 2 && y < MAP_H - 2 && dist(0, 0, dx, dy) <= radius) {
              this.terrain[idx(x, y)] = T_WATER;
            }
          }
        }
        cx += rng.int(-2, 2);
        cy += rng.int(-2, 2);
        cx = Math.max(4, Math.min(MAP_W - 5, cx));
        cy = Math.max(4, Math.min(MAP_H - 5, cy));
      }
    }

    // Clear a spawn area.
    for (let y = this.spawnTY - 7; y <= this.spawnTY + 7; y++) {
      for (let x = this.spawnTX - 7; x <= this.spawnTX + 7; x++) {
        this.terrain[idx(x, y)] = T_GRASS;
      }
    }

    // Only place nodes on a fresh world.
    if (Object.keys(this.state.nodes).length > 0) return;

    const nodes = this.state.nodes;
    const nearSpawn = (x: number, y: number, min: number) => dist(x, y, this.spawnTX, this.spawnTY) < min;
    const grassTile = (minSpawn: number): { x: number; y: number } | null => {
      for (let tries = 0; tries < 80; tries++) {
        const x = rng.int(3, MAP_W - 4);
        const y = rng.int(3, MAP_H - 4);
        if (this.terrain[idx(x, y)] !== T_GRASS) continue;
        if (nearSpawn(x, y, minSpawn)) continue;
        if (nodes[tileKey(x, y)]) continue;
        return { x, y };
      }
      return null;
    };

    const scatter = (kind: NodeKind, count: number, minSpawn: number) => {
      for (let i = 0; i < count; i++) {
        const t = grassTile(minSpawn);
        if (!t) continue;
        const [lo, hi] = NODE_DEFS[kind].max;
        nodes[tileKey(t.x, t.y)] = { kind, remaining: rng.int(lo, hi), max: rng.int(lo, hi) };
      }
    };

    const cluster = (kind: NodeKind, count: number, minSpawn: number) => {
      for (let i = 0; i < count; i++) {
        const t = grassTile(minSpawn);
        if (!t) continue;
        const size = rng.int(2, 3);
        const [lo, hi] = NODE_DEFS[kind].max;
        for (let s = 0; s < size; s++) {
          const x = t.x + rng.int(-1, 1);
          const y = t.y + rng.int(-1, 1);
          if (x < 2 || y < 2 || x > MAP_W - 3 || y > MAP_H - 3) continue;
          if (this.terrain[idx(x, y)] !== T_GRASS) continue;
          if (nodes[tileKey(x, y)]) continue;
          nodes[tileKey(x, y)] = { kind, remaining: rng.int(lo, hi), max: rng.int(lo, hi) };
        }
      }
    };

    scatter("tree", 340, 8);
    scatter("rock", 190, 8);
    cluster("iron", 13, 12);
    cluster("coal", 10, 12);
    scatter("berry", 30, 12);

    // Player spawn point (world px).
    this.state.player.x = tileCenterX(this.spawnTX);
    this.state.player.y = tileCenterY(this.spawnTY);
  }

  // ---- Grid helpers ----

  terrainAt(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return T_WATER;
    return this.terrain[y * MAP_W + x];
  }

  isWalkable(x: number, y: number): boolean {
    return this.terrainAt(x, y) !== T_WATER;
  }

  nodeAt(x: number, y: number): NodeState | undefined {
    return this.state.nodes[tileKey(x, y)];
  }

  buildingAt(x: number, y: number): BuildingInst | undefined {
    return this.state.buildings.find((b) => b.x === x && b.y === y);
  }

  beltAt(x: number, y: number): BeltInst | undefined {
    return this.state.belts.find((b) => b.x === x && b.y === y);
  }

  buildingByUid(uid: number): BuildingInst | undefined {
    return this.state.buildings.find((b) => b.uid === uid);
  }

  palByUid(uid: number) {
    return this.state.pals.find((p) => p.uid === uid);
  }

  nextUid(): number {
    return this.state.nextUid++;
  }

  // ---- Player inventory ----

  invCount(id: string): number {
    return this.state.inventory[id] ?? 0;
  }

  invAdd(id: string, n: number): void {
    this.state.inventory[id] = (this.state.inventory[id] ?? 0) + n;
  }

  invRemove(id: string, n: number): boolean {
    const cur = this.invCount(id);
    if (cur < n) return false;
    this.state.inventory[id] = cur - n;
    if (this.state.inventory[id] === 0) delete this.state.inventory[id];
    return true;
  }

  // ---- Building buffers ----

  bCount(b: BuildingInst, which: "inB" | "outB", id: string): number {
    return countStack(b[which], id);
  }

  bAdd(b: BuildingInst, which: "inB" | "outB", id: string, n: number): number {
    const stacks = b[which];
    if (b.id === "chest") {
      // Chest: shared total capacity (storage semantics).
      const total = stacks.reduce((a, s) => a + s.n, 0);
      const added = Math.min(n, Math.max(0, 80 - total));
      if (added <= 0) return 0;
      const found = stacks.find((s) => s.id === id);
      if (found) found.n += added;
      else stacks.push({ id, n: added });
      return added;
    }
    // Producers: per-item capacity so one material can never block another
    // (avoids recipe deadlocks like a full stack of ore blocking coal).
    const PER_ITEM = 12;
    const MAX_TYPES = 6;
    const found = stacks.find((s) => s.id === id);
    let added: number;
    if (found) {
      added = Math.min(n, PER_ITEM - found.n);
    } else {
      if (stacks.length >= MAX_TYPES) return 0;
      added = Math.min(n, PER_ITEM);
    }
    if (added <= 0) return 0;
    if (found) found.n += added;
    else stacks.push({ id, n: added });
    return added;
  }

  bRemove(b: BuildingInst, which: "inB" | "outB", id: string, n: number): number {
    return removeStack(b[which], id, n);
  }

  bufferCap(b: BuildingInst): number {
    // Building def cap, default 10.
    return b.id === "chest" ? 80 : 12;
  }

  // ---- Save ----

  toSave(): WorldState {
    return this.state;
  }

  serialize(): string {
    return JSON.stringify(this.state);
  }
}

export function makeItemStack(id: string, n: number): ItemStack {
  return { id, n };
}
