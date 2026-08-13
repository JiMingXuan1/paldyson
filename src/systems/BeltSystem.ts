// Belts: DSP-style conveyor logistics. Items ride belt segments (0..1 along
// the direction), flow into the next segment, and are pushed into adjacent
// receiver buildings or pulled from adjacent source buildings / chests.

import Phaser from "phaser";
import type { World } from "./World";
import type { BeltInst, BuildingInst, ItemStack } from "../types";
import { BUILDINGS } from "../data/buildings";
import { DIRS, TILE, BELT_TICK_MS, BELT_ITEM_SPEED } from "../config";
import { countStack } from "../utils/inv";

export class BeltSystem {
  sprites = new Map<number, Phaser.GameObjects.Image>();
  private itemSprites = new Map<number, Map<number, Phaser.GameObjects.Image>>();
  private acc = 0;

  constructor(
    private scene: Phaser.Scene,
    private world: World,
    private accepts: (b: BuildingInst, itemId: string) => boolean,
  ) {}

  create(): void {
    for (const b of this.world.state.belts) this.spawn(b);
  }

  private spawn(b: BeltInst): void {
    const img = this.scene.add
      .image(b.x * TILE + TILE / 2, b.y * TILE + TILE / 2, `bld_belt_${b.dir}`)
      .setDepth(3);
    this.sprites.set(b.uid, img);
    this.itemSprites.set(b.uid, new Map());
    b.items.forEach((it, i) => this.spawnItemSprite(b, i, it.id));
  }

  private spawnItemSprite(b: BeltInst, idx: number, itemId: string): void {
    const map = this.itemSprites.get(b.uid)!;
    const img = this.scene.add.image(0, 0, `item_${itemId}`).setDepth(4.5);
    map.set(idx, img);
  }

  private destroyItemSprite(b: BeltInst, idx: number): void {
    const map = this.itemSprites.get(b.uid);
    if (!map) return;
    const img = map.get(idx);
    if (img) img.destroy();
    map.delete(idx);
  }

  private rebuildItemSprites(b: BeltInst): void {
    const map = this.itemSprites.get(b.uid);
    if (!map) return;
    for (const [idx, img] of [...map.entries()]) {
      img.destroy();
      map.delete(idx);
    }
    b.items.forEach((it, i) => this.spawnItemSprite(b, i, it.id));
  }

  place(x: number, y: number, dir: number): BeltInst {
    const b: BeltInst = { uid: this.world.nextUid(), x, y, dir: dir as BeltInst["dir"], items: [] };
    this.world.state.belts.push(b);
    this.spawn(b);
    return b;
  }

  remove(uid: number): void {
    const b = this.world.state.belts.find((x) => x.uid === uid);
    if (!b) return;
    this.rebuildItemSprites(b);
    this.sprites.get(uid)?.destroy();
    this.sprites.delete(uid);
    this.itemSprites.delete(uid);
    this.world.state.belts = this.world.state.belts.filter((x) => x.uid !== uid);
  }

  private segmentAt(x: number, y: number): BeltInst | undefined {
    return this.world.state.belts.find((b) => b.x === x && b.y === y);
  }

  private headSpace(b: BeltInst): boolean {
    return b.items.every((it) => it.pos > 0.05);
  }

  /** Push an item into a belt's tail (pos 0) if free; returns success. */
  private pushItem(b: BeltInst, itemId: string): boolean {
    if (b.items.length >= 2 || !this.headSpace(b)) return false;
    b.items.push({ id: itemId, pos: 0 });
    this.spawnItemSprite(b, b.items.length - 1, itemId);
    return true;
  }

  tick(dt: number): void {
    this.acc += dt;
    if (this.acc < BELT_TICK_MS / 1000) return;
    this.acc = 0;
    const speed = BELT_ITEM_SPEED;

    // Move items forward along each belt.
    for (const b of this.world.state.belts) {
      // Sort so the tail item moves first.
      b.items.sort((a, z) => a.pos - z.pos);
      const removed: number[] = [];
      for (let i = 0; i < b.items.length; i++) {
        const it = b.items[i];
        const next = it.pos + speed;
        if (next >= 1) {
          // Try to move into the next segment or a receiver building.
          const d = DIRS[b.dir];
          const nx = b.x + d.x;
          const ny = b.y + d.y;
          const nextSeg = this.segmentAt(nx, ny);
          const nextDir = nextSeg ? DIRS[nextSeg.dir] : null;
          const aligned = nextSeg && nextDir && nextDir.x === d.x && nextDir.y === d.y;
          if (nextSeg && aligned && this.pushItem(nextSeg, it.id)) {
            removed.push(i);
            continue;
          }
          // Receiver building directly ahead?
          const receiver = this.world.buildingAt(nx, ny);
          if (receiver) {
            const cap = this.world.bufferCap(receiver);
            if (this.accepts(receiver, it.id) && countStack(receiver.inB, it.id) < cap) {
              this.world.bAdd(receiver, "inB", it.id, 1);
              removed.push(i);
              continue;
            }
          }
          // Blocked: wait at the end (keep pos at 0.99).
          it.pos = 0.99;
        } else {
          it.pos = next;
        }
      }
      for (const i of removed.sort((a, z) => z - a)) {
        b.items.splice(i, 1);
        this.destroyItemSprite(b, i);
      }
    }

    // Pull from source buildings / chests into belt heads.
    for (const b of this.world.state.belts) {
      if (!this.headSpace(b)) continue;
      const d = DIRS[b.dir];
      const bx = b.x - d.x;
      const by = b.y - d.y;
      const source = this.world.buildingAt(bx, by);
      if (!source) continue;
      const def = BUILDINGS[source.id];
      if (!def || def.cat === "power" && source.id !== "chest") {
        // Power buildings don't output; skip unless chest.
        if (source.id !== "chest") continue;
      }
      if (source.outB.length === 0) continue;
      // Output side must face this belt (chest is omni).
      const outPos = this.outputPos(source);
      const isChest = source.id === "chest";
      const facing = isChest || (outPos.x === b.x && outPos.y === b.y);
      if (!facing) continue;
      const stack = source.outB[0];
      if (this.pushItem(b, stack.id)) {
        this.world.bRemove(source, "outB", stack.id, 1);
      }
    }
  }

  private outputPos(b: BuildingInst): { x: number; y: number } {
    const d = DIRS[b.dir];
    return { x: b.x + d.x, y: b.y + d.y };
  }

  updateSprites(): void {
    for (const b of this.world.state.belts) {
      const map = this.itemSprites.get(b.uid);
      if (!map) continue;
      const d = DIRS[b.dir];
      const cx = b.x * TILE + TILE / 2;
      const cy = b.y * TILE + TILE / 2;
      const lane = b.items.length === 1 ? 0 : b.items.length === 2 ? 8 : 0;
      b.items.forEach((it, i) => {
        const img = map.get(i);
        if (!img) return;
        const px = cx + d.x * (it.pos - 0.5) * TILE + (d.y !== 0 ? (i === 0 ? -lane : lane) : 0);
        const py = cy + d.y * (it.pos - 0.5) * TILE + (d.x !== 0 ? (i === 0 ? -lane : lane) : 0);
        img.setPosition(px, py);
      });
    }
  }

  /** Items of a belt as a list for save sanity (should be empty at save time). */
  beltItems(b: BeltInst): ItemStack[] {
    const agg: ItemStack[] = [];
    for (const it of b.items) {
      const found = agg.find((s) => s.id === it.id);
      if (found) found.n++;
      else agg.push({ id: it.id, n: 1 });
    }
    return agg;
  }
}
