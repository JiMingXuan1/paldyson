// Belts: DSP-style conveyor logistics. Items ride belt segments (0..1 along
// the direction), flow into the next segment, and are pushed into adjacent
// receiver buildings or pulled from adjacent source buildings / chests.
// Item sprites are keyed by a stable per-item uid, never by array index.

import Phaser from "phaser";
import type { World } from "./World";
import type { BeltInst, BuildingInst } from "../types";
import { DIRS, TILE, BELT_TICK_MS, BELT_ITEM_SPEED } from "../config";

export class BeltSystem {
  sprites = new Map<number, Phaser.GameObjects.Image>();
  private itemSprites = new Map<number, Map<number, Phaser.GameObjects.Image>>();
  private acc = 0;
  private itemUid = 1;

  constructor(
    private scene: Phaser.Scene,
    private world: World,
    private accepts: (b: BuildingInst, itemId: string) => boolean,
  ) {}

  create(): void {
    for (const b of this.world.state.belts) {
      // Assign stable uids to items from a loaded save.
      for (const it of b.items) {
        if (!it.uid) it.uid = this.itemUid++;
        if (it.uid >= this.itemUid) this.itemUid = it.uid + 1;
      }
      this.spawn(b);
    }
  }

  private spawn(b: BeltInst): void {
    const img = this.scene.add
      .image(b.x * TILE + TILE / 2, b.y * TILE + TILE / 2, `bld_belt_${b.dir}`)
      .setDepth(3);
    this.sprites.set(b.uid, img);
    this.itemSprites.set(b.uid, new Map());
    for (const it of b.items) this.spawnItemSprite(b, it);
  }

  private spawnItemSprite(b: BeltInst, it: { uid: number; id: string }): void {
    const map = this.itemSprites.get(b.uid)!;
    const img = this.scene.add.image(0, 0, `item_${it.id}`).setDepth(4.5);
    map.set(it.uid, img);
  }

  private destroyItemSprite(b: BeltInst, itemUid: number): void {
    const map = this.itemSprites.get(b.uid);
    if (!map) return;
    map.get(itemUid)?.destroy();
    map.delete(itemUid);
  }

  private rebuildItemSprites(b: BeltInst): void {
    const map = this.itemSprites.get(b.uid);
    if (!map) return;
    for (const [, img] of [...map.entries()]) img.destroy();
    map.clear();
    for (const it of b.items) this.spawnItemSprite(b, it);
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
    const it = { uid: this.itemUid++, id: itemId, pos: 0 };
    b.items.push(it);
    this.spawnItemSprite(b, it);
    return true;
  }

  tick(dt: number): void {
    this.acc += dt;
    if (this.acc < BELT_TICK_MS / 1000) return;
    this.acc = 0;
    const speed = BELT_ITEM_SPEED;

    // Move items forward along each belt.
    for (const b of this.world.state.belts) {
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
          if (receiver && this.accepts(receiver, it.id)) {
            const added = this.world.bAdd(receiver, "inB", it.id, 1);
            if (added > 0) {
              removed.push(i);
              continue;
            }
          }
          // Blocked: wait at the end.
          it.pos = 0.99;
        } else {
          it.pos = next;
        }
      }
      for (const i of removed.sort((a, z) => z - a)) {
        const it = b.items[i];
        b.items.splice(i, 1);
        this.destroyItemSprite(b, it.uid);
      }
    }

    // Pull from source buildings / chests into belt heads.
    for (const b of this.world.state.belts) {
      if (!this.headSpace(b)) continue;
      const d = DIRS[b.dir];
      const bx = b.x - d.x;
      const by = b.y - d.y;
      const source = this.world.buildingAt(bx, by);
      if (!source || source.outB.length === 0) continue;
      // Output side must face this belt (chest is omni).
      const isChest = source.id === "chest";
      const facing = isChest || this.outputPos(source).x === b.x && this.outputPos(source).y === b.y;
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
        const img = map.get(it.uid);
        if (!img) return;
        const px = cx + d.x * (it.pos - 0.5) * TILE + (d.y !== 0 ? (i === 0 ? -lane : lane) : 0);
        const py = cy + d.y * (it.pos - 0.5) * TILE + (d.x !== 0 ? (i === 0 ? -lane : lane) : 0);
        img.setPosition(px, py);
      });
    }
  }
}
