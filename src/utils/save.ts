// Save / load for the WorldState via localStorage.

import type { WorldState } from "../types";
import { SAVE_KEY } from "../config";

export const SAVE_VERSION = 2;

export function saveGame(state: WorldState): boolean {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ ...state, version: SAVE_VERSION }));
    return true;
  } catch {
    return false;
  }
}

export function loadGame(): WorldState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WorldState;
    if (
      !parsed ||
      typeof parsed.seed !== "number" ||
      !Array.isArray(parsed.buildings) ||
      !parsed.nodes ||
      !parsed.research ||
      !parsed.inventory
    ) {
      return null;
    }
    // v1 -> v2 migration: research.progress semantics changed from 0..cost to
    // 0..1; reset any in-progress research so old saves don't instantly finish.
    if ((parsed.version ?? 1) < 2) {
      parsed.research.progress = 0;
      parsed.research.current = null;
      parsed.research.redAcc = 0;
    }
    parsed.research.redAcc ??= 0;
    return parsed;
  } catch {
    return null;
  }
}

export function clearSave(): void {
  localStorage.removeItem(SAVE_KEY);
}

export function hasSave(): boolean {
  return localStorage.getItem(SAVE_KEY) !== null;
}
