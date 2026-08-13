// Pals: wild creature AI, sphere capture, roster management, hunger & mood.

import Phaser from "phaser";
import type { World } from "./World";
import type { PalInst } from "../types";
import { PALS } from "../data/pals";
import { Sfx } from "../utils/sound";
import {
  TILE, MAP_W, MAP_H, WILD_PAL_SPAWN_N, CAPTURE_CHANCE,
  SPHERE_SPEED, SPHERE_RANGE_TILES,
  PAL_HUNGER_DRAIN_S, PAL_MOOD_DRAIN_S, PAL_FEED_MOOD,
} from "../config";

interface WildPal {
  uid: number;
  type: string;
  sprite: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
  tx: number;
  ty: number;
  mode: "wander" | "flee" | "sleep";
  timer: number;
  fleeT: number;
  sleepT: number;
}

export class PalSystem {
  wild: WildPal[] = [];
  projectiles: Phaser.GameObjects.Image[] = [];
  private wildUid = 100000;

  constructor(
    private scene: Phaser.Scene,
    private world: World,
  ) {}

  create(): void {
    const rng = (n: number) => Math.floor(Math.random() * n);
    const weights: [string, number][] = [
      ["sprout", 40], ["rock", 28], ["ember", 14], ["volt", 12], ["aqua", 6],
    ];
    const totalW = weights.reduce((a, [, w]) => a + w, 0);
    for (let i = 0; i < WILD_PAL_SPAWN_N; i++) {
      let roll = Math.random() * totalW;
      let type = "sprout";
      for (const [t, w] of weights) {
        roll -= w;
        if (roll <= 0) {
          type = t;
          break;
        }
      }
      for (let tries = 0; tries < 60; tries++) {
        const x = 4 + rng(MAP_W - 8);
        const y = 4 + rng(MAP_H - 8);
        if (!this.world.isWalkable(x, y)) continue;
        const wx = x * TILE + TILE / 2;
        const wy = y * TILE + TILE / 2;
        const nearPlayer = Phaser.Math.Distance.Between(wx, wy, this.world.state.player.x, this.world.state.player.y) < 12 * TILE;
        if (nearPlayer) continue;
        this.spawnWild(type, wx, wy);
        break;
      }
    }
  }

  private spawnWild(type: string, wx: number, wy: number): void {
    const shadow = this.scene.add.image(wx, wy + 14, "shadow").setDepth(2).setScale(0.8);
    const sprite = this.scene.add.image(wx, wy, `pal_${type}`).setDepth(3);
    this.wild.push({
      uid: this.wildUid++,
      type,
      sprite,
      shadow,
      tx: wx,
      ty: wy,
      mode: "wander",
      timer: 0,
      fleeT: 0,
      sleepT: 0,
    });
  }

  update(dt: number, isNight: boolean): void {
    for (const w of this.wild) {
      if (w.mode === "flee") {
        w.fleeT -= dt;
        this.stepToward(w, dt, 110);
        if (w.fleeT <= 0) {
          w.mode = "wander";
          w.timer = Phaser.Math.FloatBetween(0.5, 2);
        }
        w.sprite.setTint(0xff8888);
      } else if (isNight) {
        if (w.mode !== "sleep") {
          w.mode = "sleep";
          w.sleepT = 0;
        }
        w.sleepT += dt;
        w.sprite.setTint(0x8899aa);
        w.sprite.setScale(1 + Math.sin(w.sleepT * 3) * 0.06);
      } else {
        w.sprite.clearTint();
        w.sprite.setScale(1);
        w.timer -= dt;
        if (w.mode === "sleep") w.mode = "wander";
        if (w.timer <= 0) {
          // Pick a new wander target on walkable ground.
          for (let tries = 0; tries < 12; tries++) {
            const nx = w.sprite.x + Phaser.Math.Between(-3, 3) * TILE;
            const ny = w.sprite.y + Phaser.Math.Between(-3, 3) * TILE;
            const tx = Phaser.Math.Clamp(nx, TILE, (MAP_W - 1) * TILE);
            const ty = Phaser.Math.Clamp(ny, TILE, (MAP_H - 1) * TILE);
            if (this.world.isWalkable(Math.floor(tx / TILE), Math.floor(ty / TILE))) {
              w.tx = tx;
              w.ty = ty;
              w.timer = Phaser.Math.FloatBetween(1.2, 4);
              break;
            }
          }
        }
        this.stepToward(w, dt, 42);
      }
      w.sprite.setFlipX(w.tx < w.sprite.x);
      w.shadow.setPosition(w.sprite.x, w.sprite.y + 14);
    }
  }

  private stepToward(w: WildPal, dt: number, speed: number): void {
    const dx = w.tx - w.sprite.x;
    const dy = w.ty - w.sprite.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 4) return;
    const step = Math.min(speed * dt, dist);
    w.sprite.x += (dx / dist) * step;
    w.sprite.y += (dy / dist) * step;
  }

  // ---- Capture ----

  throwSphere(fromX: number, fromY: number, toX: number, toY: number): boolean {
    const range = SPHERE_RANGE_TILES * TILE;
    const dist = Phaser.Math.Distance.Between(fromX, fromY, toX, toY);
    if (dist > range) {
      Sfx.error();
      return false;
    }
    if (!this.world.invRemove("pal_sphere", 1)) return false;
    const sphere = this.scene.add.image(fromX, fromY, "sphere").setDepth(8);
    this.projectiles.push(sphere);
    const dur = Math.max(150, (dist / SPHERE_SPEED) * 1000);
    this.scene.tweens.add({
      targets: sphere,
      x: toX,
      y: toY,
      duration: dur,
      ease: "Quad.easeIn",
      onComplete: () => this.resolveSphere(toX, toY, sphere),
    });
    Sfx.gather();
    return true;
  }

  private resolveSphere(toX: number, toY: number, sphere: Phaser.GameObjects.Image): void {
    this.projectiles = this.projectiles.filter((p) => p !== sphere);
    // Nearest wild pal within a tile.
    let best: WildPal | null = null;
    let bestD = 0.95 * TILE;
    for (const w of this.wild) {
      const d = Phaser.Math.Distance.Between(toX, toY, w.sprite.x, w.sprite.y);
      if (d < bestD) {
        bestD = d;
        best = w;
      }
    }
    if (!best) {
      // Miss: leave a ground pickup the player can walk over (30s lifetime).
      const pickup = this.scene.add.image(toX, toY, "item_pal_sphere").setDepth(2).setScale(0.9);
      const cx = toX, cy = toY;
      let age = 0;
      const ev = this.scene.time.addEvent({
        delay: 100,
        loop: true,
        callback: () => {
          age += 100;
          const p = this.world.state.player;
          if (Phaser.Math.Distance.Between(p.x, p.y, cx, cy) < 26) {
            this.world.invAdd("pal_sphere", 1);
            pickup.destroy();
            ev.remove();
            Sfx.click();
          } else if (age > 30000) {
            pickup.destroy();
            ev.remove();
          }
        },
      });
      sphere.destroy();
      return;
    }
    const def = PALS[best.type];
    const chance = CAPTURE_CHANCE[def.rarity];
    if (Math.random() < chance) {
      // Captured!
      this.world.invAdd(`pal_${best.type}`, 1);
      this.world.state.stats.captures++;
      this.scene.tweens.add({
        targets: sphere,
        scale: 0,
        alpha: 0,
        duration: 250,
        onComplete: () => sphere.destroy(),
      });
      this.scene.tweens.add({
        targets: best.sprite,
        scale: 0,
        duration: 300,
        onComplete: () => {
          best.shadow.destroy();
          best.sprite.destroy();
        },
      });
      this.wild = this.wild.filter((x) => x !== best);
      Sfx.capture();
    } else {
      // Failed: pal flees, sphere shatters.
      best.mode = "flee";
      best.fleeT = 2.5;
      best.tx = best.sprite.x + Phaser.Math.Between(-6, 6) * TILE;
      best.ty = best.sprite.y + Phaser.Math.Between(-6, 6) * TILE;
      this.scene.tweens.add({
        targets: sphere,
        scale: 0.3,
        angle: 90,
        alpha: 0,
        duration: 200,
        onComplete: () => sphere.destroy(),
      });
      Sfx.captureFail();
    }
  }

  // ---- Roster ----

  roster() {
    return {
      pals: this.world.state.pals.map((p) => ({
        uid: p.uid,
        name: p.name,
        type: p.type,
        typeName: PALS[p.type]?.name ?? p.type,
        hunger: p.hunger,
        mood: p.mood,
        job: p.job,
        affinity: PALS[p.type]?.worksWith ?? [],
      })),
      palItems: Object.entries(this.world.state.inventory)
        .filter(([id]) => id.startsWith("pal_"))
        .map(([id, n]) => ({ id, type: id.slice(4), name: PALS[id.slice(4)]?.name ?? id, n })),
      terminalCount: this.world.state.buildings.filter((b) => b.id === "pal_terminal").length,
    };
  }

  releaseFromInventory(type: string): boolean {
    const id = `pal_${type}`;
    if (!this.world.invRemove(id, 1)) return false;
    if (this.world.state.buildings.filter((b) => b.id === "pal_terminal").length === 0) {
      this.world.invAdd(id, 1);
      return false;
    }
    const pal: PalInst = {
      uid: this.world.nextUid(),
      type,
      name: `${PALS[type]?.name ?? type}${this.world.state.pals.length + 1}`,
      hunger: 80,
      mood: 80,
      job: { kind: "none" },
    };
    this.world.state.pals.push(pal);
    Sfx.capture();
    return true;
  }

  assignJob(palUid: number, job: PalInst["job"]): void {
    const pal = this.world.palByUid(palUid);
    if (!pal) return;
    // Clear previous building assignment.
    if (pal.job.kind === "building") {
      const b = this.world.buildingByUid(pal.job.targetUid);
      if (b && b.palUid === palUid) b.palUid = null;
    }
    pal.job = job;
    if (job.kind === "building") {
      const b = this.world.buildingByUid(job.targetUid);
      if (b) b.palUid = palUid;
    }
    Sfx.click();
  }

  feed(palUid: number): boolean {
    const pal = this.world.palByUid(palUid);
    if (!pal) return false;
    if (!this.world.invRemove("berries", 1)) return false;
    pal.hunger = Math.min(100, pal.hunger + 50);
    pal.mood = Math.min(100, pal.mood + PAL_FEED_MOOD);
    Sfx.feed();
    return true;
  }

  release(palUid: number): void {
    const pal = this.world.palByUid(palUid);
    if (!pal) return;
    if (pal.job.kind === "building") {
      const b = this.world.buildingByUid(pal.job.targetUid);
      if (b && b.palUid === palUid) b.palUid = null;
    }
    this.world.state.pals = this.world.state.pals.filter((p) => p.uid !== palUid);
    Sfx.deconstruct();
  }

  /** Drain hunger/mood over time for assigned pals. */
  drain(dt: number): void {
    for (const p of this.world.state.pals) {
      const working = p.job.kind !== "none";
      p.hunger = Math.max(0, p.hunger - (dt / PAL_HUNGER_DRAIN_S) * 100);
      if (working) p.mood = Math.max(0, p.mood - (dt / PAL_MOOD_DRAIN_S) * 100);
    }
  }
  followerPal(): PalInst | null {
    return this.world.state.pals.find((p) => p.job.kind === "follow") ?? null;
  }
}
