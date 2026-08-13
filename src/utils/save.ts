// Save / load for the WorldState via localStorage.

import type { WorldState } from "../types";
import { SAVE_KEY } from "../config";

export function saveGame(state: WorldState): boolean {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
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
    if (!parsed || typeof parsed.seed !== "number" || !Array.isArray(parsed.buildings)) return null;
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
