// Helpers for ItemStack arrays (building buffers).

import type { ItemStack } from "../types";

export function countStack(stacks: ItemStack[], id: string): number {
  return stacks.find((s) => s.id === id)?.n ?? 0;
}

export function totalStack(stacks: ItemStack[]): number {
  return stacks.reduce((a, s) => a + s.n, 0);
}

/** Remove n items. Returns how many were actually removed. */
export function removeStack(stacks: ItemStack[], id: string, n: number): number {
  const found = stacks.find((s) => s.id === id);
  if (!found) return 0;
  const removed = Math.min(found.n, n);
  found.n -= removed;
  if (found.n <= 0) {
    const i = stacks.indexOf(found);
    stacks.splice(i, 1);
  }
  return removed;
}
