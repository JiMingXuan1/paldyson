// Helpers for ItemStack arrays (building buffers).

import type { ItemStack } from "../types";

export function countStack(stacks: ItemStack[], id: string): number {
  return stacks.find((s) => s.id === id)?.n ?? 0;
}

export function totalStack(stacks: ItemStack[]): number {
  return stacks.reduce((a, s) => a + s.n, 0);
}

/** Add n items to a capped buffer. Returns how many were actually added. */
export function addStack(stacks: ItemStack[], id: string, n: number, cap: number): number {
  const cur = totalStack(stacks);
  const space = Math.max(0, cap - cur);
  const added = Math.min(n, space);
  if (added <= 0) return 0;
  const found = stacks.find((s) => s.id === id);
  if (found) found.n += added;
  else stacks.push({ id, n: added });
  return added;
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

export function stacksCopy(stacks: ItemStack[]): ItemStack[] {
  return stacks.map((s) => ({ ...s }));
}
