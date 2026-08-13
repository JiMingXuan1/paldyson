// Tech tree: research progression, unlock checks.

import type Phaser from "phaser";
import type { WorldState } from "../types";
import { TECHS, TECH_ORDER } from "../data/tech";
import { RECIPES } from "../data/buildings";
import { Sfx } from "../utils/sound";

export class TechSystem {
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene, private world: WorldState) {
    this.scene = scene;
  }

  /** Whether a building/recipe is unlocked by the research tree. */
  static unlocked(state: WorldState, target: string): boolean {
    for (const t of Object.values(TECHS)) {
      if (t.unlocks.includes(target) && !state.research.researched.includes(t.id)) return false;
    }
    return true;
  }

  static unlockedTech(state: WorldState, techId: string): boolean {
    const t = TECHS[techId];
    if (!t) return true;
    return state.research.researched.includes(techId);
  }

  static canResearch(state: WorldState, techId: string): { ok: boolean; reason?: string } {
    const t = TECHS[techId];
    if (!t) return { ok: false, reason: "未知科技" };
    if (state.research.researched.includes(techId)) return { ok: false, reason: "已研究" };
    if (state.research.current === techId) return { ok: false, reason: "研究中" };
    if (t.requires) {
      for (const r of t.requires) {
        if (!state.research.researched.includes(r)) return { ok: false, reason: "需要先研究前置科技" };
      }
    }
    return { ok: true };
  }

  start(techId: string): boolean {
    const res = TechSystem.canResearch(this.world, techId);
    if (!res.ok) return false;
    this.world.research.current = techId;
    this.world.research.progress = 0;
    return true;
  }

  /** Advance current research; consumes red science from any lab output buffer. */
  tick(dt: number): void {
    const r = this.world.research;
    if (!r.current) return;
    const tech = TECHS[r.current];
    if (!tech) {
      r.current = null;
      return;
    }
    const labs = this.world.buildings.filter((b) => b.id === "research_lab");
    // Consume 1 red science per 2.5s of research.
    const rate = 1 / 2.5;
    for (const lab of labs) {
      if (r.progress >= tech.cost) break;
      const red = lab.outB.find((s) => s.id === "red_science");
      if (red && red.n > 0) {
        red.n -= 1;
        if (red.n <= 0) lab.outB.splice(lab.outB.indexOf(red), 1);
        r.progress += dt * rate;
      }
    }
    if (r.progress >= tech.cost) {
      r.researched.push(r.current);
      r.current = null;
      r.progress = 0;
      Sfx.research();
      this.scene.events.emit("tech-complete", tech);
    }
  }

  /** All techs in tree order with state for UI. */
  list() {
    return TECH_ORDER.map((id) => {
      const t = TECHS[id];
      return {
        id,
        name: t.name,
        desc: t.desc,
        icon: t.icon,
        cost: t.cost,
        researched: this.world.research.researched.includes(id),
        current: this.world.research.current === id,
        progress: this.world.research.current === id ? this.world.research.progress / t.cost : 0,
        canStart: TechSystem.canResearch(this.world, id).ok,
        reason: TechSystem.canResearch(this.world, id).reason,
      };
    });
  }

  isRecipeUnlocked(recipeId: string): boolean {
    const r = RECIPES[recipeId];
    if (!r.tech) return true;
    return TechSystem.unlocked(this.world, r.tech) && TechSystem.unlockedTech(this.world, r.tech);
  }
}
