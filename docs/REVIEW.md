# PalDyson Code Review

**Scope:** `src/` (~4,000 lines) reviewed file-by-file against the current working tree.
**Verified:** `tsc --noEmit` clean under strict mode; `scripts/smoke.mjs` passes.
**Coverage gap:** the smoke test never exercises belt movement, wild-pal movement, or research
consumption — it asserts placement/power/save only. `scripts/loop.mjs` (untracked) does drive
real system ticks, which is how the two worst bugs below were caught.

> ⚠️ **Mid-review note:** commit `cf22c34` ("fix: belt tick ms/seconds bug, per-item buffer
> caps, research bottle rate") landed *while this review was being written*, and
> `src/systems/BeltSystem.ts` has one further **uncommitted** edit (receiver push now uses
> `bAdd`'s return value). Findings below are against the current working tree; already-fixed
> issues are listed at the bottom for the record. **The BeltSystem change must be committed.**

---

## Critical (game-breaking)

### C1. Wild-pal movement is 1000× too fast — pals teleport, flee lasts ~0.15 s
`src/scenes/GameScene.ts:584` calls `this.palSys.update(dt * 1000, …)` — **milliseconds**.
`src/systems/PalSystem.ts:85-138` then treats `dt` as seconds:

- `w.fleeT -= dt` (line 88): `fleeT` is set to `2.5` **seconds** (line 224) but is decremented by
  ~16.7 per frame → the flee state ends after ~9 frames (~0.15 s), not 2.5 s.
- `stepToward(w, dt, 110)` / `stepToward(w, dt, 42)` (lines 89, 123): `step = Math.min(speed * dt, dist)`
  (line 135) with `dt` in ms gives `110 × 16.7 ≈ 1837 px` per frame — always ≥ the target distance,
  so every wild pal **teleports** to its wander/flee target in one frame instead of walking.

`w.timer` (lines 92, 118, `Between(500, 2000)`) is in ms and is *consistent* with the ms `dt`, so
the file mixes units internally. Wild pals visibly blink around the map and capture/flee pacing is
broken.

**Fix:** pass seconds — `this.palSys.update(dt, this.isNight())` in GameScene, and convert the
timer values to seconds (`Between(0.5, 2)` etc.). Or keep ms and set `fleeT = 2500` and divide
`dt` by 1000 in `stepToward`. Either way, pick one unit.

---

## Important (significant but not game-breaking)

### I1. Belt item sprites desync from item data after `sort` — wrong textures, orphaned sprites
`src/systems/BeltSystem.ts:101` sorts `b.items` ascending by `pos` every tick, but sprites are
keyed by **array index** (`itemSprites` map, `spawnItemSprite(b, i, …)`), and `updateSprites`
(lines 170-186) looks sprites up by index. `pushItem` (line 88) spawns a new item's sprite at
`items.length - 1`, then the next tick's sort moves that item to index 0. Consequences:

1. A new item pushed onto a non-empty belt is rendered with the *old* item's texture and vice
   versa (items `[coal, iron]` → sort → sprites drawn swapped).
2. When an item is removed, `destroyItemSprite(b, i)` (line 137) deletes the sprite at the *pre-
   splice* index; after `splice`, the surviving item keeps a stale index, so its sprite is never
   positioned again (stuck at world `(0,0)`) and the map holds an orphaned sprite (a leak).
3. A later `spawnItemSprite` can overwrite a live key without destroying the old sprite → leak.

Data (items/pos) stays correct; only rendering is corrupt, so saves are unaffected.

**Fix:** key sprites by item identity, not index — e.g. add a monotonic `id` to `BeltItem` and use
`itemSprites: Map<beltUid, Map<itemId, sprite>>`, or call `rebuildItemSprites(b)` after the sort
when order changed. Cheapest: in `tick`, after `sort`, remap `map` to the new indices.

### I2. Panel "take" from the output buffer removes from the *input* buffer
`src/ui/UI.ts:453-455`: both the input and output stack lists get `data-take`, and the handler
hardcodes `"inB"`:

```ts
p.querySelectorAll("[data-take]").forEach((s) => {
  s.addEventListener("click", () => this.cb.onPanelTake(data.uid, "inB", ...));
});
```

Clicking an item in the **输出缓存 (output)** section calls `BuildingSystem.take(uid, "inB", id)`
(`BuildingSystem.ts:322-329`), which removes from the input buffer instead. A furnace with
`iron_ingot` in `outB` and `iron_ore` in `inB`: clicking the ingot silently eats an ore (and the
ingot stays). Input items are destroyed.

**Fix:** pass the section explicitly — give output stacks `data-take-out` (or a parent marker) and
call `onPanelTake(data.uid, "outB", id)` for them.

### I3. Tech-gated recipes show as unlocked — progression bypass
`src/systems/BuildingSystem.ts:303`:

```ts
unlocked: RECIPES[rid]?.tech ? TechSystem.unlocked(this.world.state, RECIPES[rid].tech!) : true,
```

`TechSystem.unlocked(state, target)` (`TechSystem.ts:17-22`) returns false only if some tech whose
`unlocks` list contains `target` is unresearched. No tech's `unlocks` contains a *tech id* like
`"t_pals"` (they contain building ids and `"recipe:…"` strings), so this **always returns true**.
Result: the assembler panel enables 帕鲁球 (needs `t_pals`) and 戴森组件 (needs `t_dyson`)
before those techs are researched — the tech tree is bypassed for both endgame recipes.
`TechSystem.isRecipeUnlocked` (`TechSystem.ts:108-112`) has the same flawed first conjunct (it
only works by accident because the second conjunct `unlockedTech` is the real gate) — and it's
never called anyway.

**Fix:** use `TechSystem.unlockedTech(state, RECIPES[rid].tech)` (or check
`unlocked(state, "recipe:" + rid)`).

### I4. Mining drill burns node charges while its output buffer is full
`src/systems/BuildingSystem.ts:237-244`: on completion, `node.remaining--` runs **unconditionally**;
`bAdd(b, "outB", item, 1) > 0` only gates the item/prodCount. With `outB` full (no belt attached),
the drill keeps consuming the finite node (3 s per charge) and produces nothing — the node
silently depletes into thin air. Same pattern as the manual gather path, but there the player sees
the node deplete.

**Fix:** decrement the node only when the ore was accepted: `if (item && bAdd(...) > 0) { node.remaining--; … }`
(or pause progress while the buffer is full).

### I5. Save/load: fully-depleted worlds resurrect all nodes
`src/systems/World.ts:128-129`:

```ts
if (Object.keys(this.state.nodes).length > 0) return;
```

This gates *node placement* (and the player spawn assignment) on "nodes exist" instead of the
`fresh` flag. A save where every node was depleted serializes `nodes: {}`; on load `gen()` sees an
empty map and regenerates the entire resource distribution — depleted nodes come back (and the
player is teleported to spawn). Unusual, but it's a genuine state-integrity hole.

**Fix:** gate the node-placement block on `fresh` (terrain generation must still run from the
seeded RNG on load).

### I6. Research progress bar in the tech modal is wrong (regression from the redAcc fix)
The redAcc fix (`TechSystem.ts:53-87`) changed `progress` semantics from `0..cost` to `0..1`
(`r.progress += 1 / tech.cost`, completion at `>= 1`), but `list()` still divides by cost
(`TechSystem.ts:101`):

```ts
progress: this.world.research.current === id ? this.world.research.progress / t.cost : 0,
```

A cost-3 tech at 2/3 completion shows 22% in the modal (should be 67%); the bar never exceeds
~33%/25%/17% for costs 3/4/6. `renderTechTree` (`UI.ts:315`) renders `progress * 100`.

**Fix:** drop the `/ t.cost` (progress is already a fraction), and note that *old* saves with
in-progress research (progress stored as `0..cost`) will instantly complete under the new
`>= 1` check — bump `version` and migrate.

---

## Minor

- **Belt item "known limitation" doesn't exist — and shouldn't be "fixed" by emptying belts.**
  `BeltInst.items` is serialized in `WorldState.belts` and `BeltSystem.spawn` (`BeltSystem.ts:26-34`)
  rebuilds the item sprites on load, so belt items survive save/load already. `beltItems()`
  (`BeltSystem.ts:189-197`) is dead code written for a limitation that isn't there. No fix needed;
  keep them serialized. (Cosmetic: restored item sprites sit at `(0,0)` for one belt-tick.)
- **`loadGame` validation is minimal** (`save.ts:15-25`): only `seed`/`buildings` checked. A save
  missing `nodes`/`research`/`inventory` crashes in `gen()` (`Object.keys(undefined)`) or in
  `TechSystem`/`World` accessors. `version` is written but never read — no migration path.
- **Building can be placed on the player's own tile** — `canPlaceAt` (`BuildingSystem.ts:79-92`)
  checks terrain/occupancy but not the player; the arcade collider then shoves the player out.
  Common fix: reject the tile under the player sprite (chest/dyson placement on self is the
  realistic case).
- **Panel DOM is rebuilt every 0.3 s** while open (`GameScene.ts:606-611` →
  `showBuildingPanel` `p.innerHTML = body`) — an open pal `<select>` or scroll position resets
  every refresh. Rebuild only when the panel's data actually changed.
- **`World.bufferCap` is now dead code** (`World.ts:275-278`): `bAdd` hardcodes per-item caps
  (12/type, 6 types; chest 80 total) and `BuildingSystem.tick:261` hardcodes 12. `BuildingDef.bufferCap`
  (buildings.ts:101-193) is likewise ignored everywhere — three different cap definitions that can
  drift apart.
- **TechSystem: multiple labs no longer speed up research** (`TechSystem.ts:63-76`): the `for` +
  `break` consumes from the first lab with bottles only, 1 bottle per tick max. The old code
  consumed from every lab per tick. Also, `r.redAcc -= 1` happens *before* the no-bottles check, so
  a pending bottle's worth of credit is discarded when research stalls (progress pauses until the
  next full credit — ~2.5 s extra per stall).
- **Research can be started with zero labs** — `canResearch`/`start` don't require a `research_lab`;
  the tech then sits at 0% forever with no feedback.
- **`feedDyson` re-fires victory** whenever `dysonFed >= 10` (`BuildingSystem.ts:371-373`) — feeding
  a 11th component re-shows the victory overlay.
- **Wind factor ignores its config constants** — `windFactor()` (`BuildingSystem.ts:156-159`) yields
  0.55..1.0 with hardcoded values; `WIND_BASE/WIND_MIN/WIND_MAX` (`config.ts:23-25`) are unused.
- **Furnace/assembler draw power even when idle** (`BuildingSystem.ts:177` counts `powerUse` for all
  power-using buildings unconditionally) — power factor can be < 1 with nothing actually producing.
- **Coal generator burns fuel with no demand** (`BuildingSystem.ts:223-229` — `b.fuel -= dt`
  whenever `fuel > 0`), even when nothing draws power.
- **`interactE` picks the first building in array order, not the nearest** (`GameScene.ts:471-477`).
- **`showVictory` hardcodes `240`** (`UI.ts:520`) instead of `DAY_LENGTH`.
- **`isNight()` computed twice per frame** (`GameScene.ts:584`, `:591`); `roster()` called twice per
  UI push when the pal modal is open (`GameScene.ts:640-641`).
- **Missed-sphere pickup timer runs forever** if never collected (`PalSystem.ts:181-193`) — one
  per-frame callback + sprite per miss; minor leak.

### Dead code / unused exports
- `utils/events.ts` — the whole `Emitter`/`GameEvents` module is unused.
- `inv.ts:14 addStack`, `inv.ts:38 stacksCopy`, `World.ts:291 makeItemStack`, `World.ts:286 serialize`,
  `Player.ts:72 worldBounds`, `PalSystem.ts:336 buildingName`, `PalSystem.ts:327 boostFor` (duplicate
  of `BuildingSystem.palBoost` — if either changes, they diverge), `TechSystem.ts:108 isRecipeUnlocked`.
- `config.ts:29 BELT_CAPACITY` (belt capacity is hardcoded to 2 in `pushItem`), `config.ts:56 DIR_NAMES`,
  `items.ts:30 ITEM_IDS`, `items.ts:36 itemColor`, `pals.ts:127 PAL_IDS`.
- `buildings.ts:198 HOTBAR_ORDER` — hotbar order is hardcoded separately in `GameScene.setupInput`
  (`GameScene.ts:278`) and `UI.renderHotbar` (`UI.ts:185`); three copies of the same list.
- `BuildingDef.hotbar` flag (`buildings.ts:30`) — set on every def, never read.
- `WildPal.uid` (`PalSystem.ts:16`) — assigned, never read.
- `GameScene.pushUiState(_force)` (`GameScene.ts:631`) — `_force` never used.

---

## Fixed during the review window (commit `cf22c34` — do not re-report)

1. **Belt system never moved items** — `BeltSystem.tick` accumulated `dt` in **seconds** but
   compared against `BELT_TICK_MS` (100, ms): `if (this.acc < BELT_TICK_MS) return` → belts were
   permanently frozen. This was the single worst bug in the game (the core conveyor mechanic dead).
   Now `if (this.acc < BELT_TICK_MS / 1000) return` (`BeltSystem.ts:94`). ✔
2. **Research consumed 10× the displayed cost** — old `TechSystem.tick` consumed 1 red bottle per
   lab per tick but advanced progress by only `dt × 0.4`, so a "红瓶×1" tech ate 10 bottles. Now
   rate-correct via the `redAcc` accumulator (`TechSystem.ts:61-78`), total = `tech.cost` bottles. ✔
3. **Shared-capacity buffers could deadlock recipes** — old `bAdd` capped *total* stack count, so a
   full stack of one input blocked another input (ore filling the furnace blocked coal). New
   per-item caps (12/type, 6 types; chest = shared 80) with a dedicated chest branch
   (`World.ts:241-269`). ✔ (Follow-on: the belt receiver pre-check `countStack < cap` no longer
   matches `bAdd` semantics — the uncommitted `BeltSystem.ts` edit switching to `bAdd`'s return
   value fixes exactly this; commit it.)

---

## Positive notes

1. **State mutation is centralized and defensive.** Buffers go through `World.bAdd/bRemove` with
   caps and `?? 0`-style guards; the per-item-cap redesign (`World.ts:241-269`) is a genuinely
   thoughtful fix for recipe deadlocks, and the chest keeps clean storage semantics.
2. **Pal↔building assignment cleanup is handled symmetrically** — deconstruct (`BuildingSystem.ts:145-148`),
   release (`PalSystem.ts:309-312`), and reassignment (`PalSystem.ts:284-287`) all clear the other
   side's reference, and `loop.mjs` asserts the deconstruct path.
3. **Deterministic map gen.** The seeded mulberry32 RNG (`utils/rng.ts`) drives terrain and nodes,
   and loaded worlds reuse the seeded terrain while skipping node re-placement — saves reproduce
   the same map.
4. **Systems are decoupled and testable from the console** — the `__paldyson` debug handle plus
   DOM-free UI made the headless `loop.mjs` simulation possible, which is exactly how the belt and
   research bugs were caught. That test harness is worth keeping and extending (it currently
   bypasses `canPlaceAt`, so placement bugs stay invisible to it).
5. **Save/load basics are sound** — uids continue from `nextUid`, belt items round-trip, follower
   pal and dyson-core panel state are restored, and the `node-depleted` event keeps gather state
   consistent with world state.

---

## Fixes applied (commit `1a3f9b4` + follow-ups)

All Critical/Important findings were fixed and verified with the automated suites
(`scripts/smoke.mjs`, `scripts/loop.mjs`, `scripts/victory.mjs`):

| # | Fix |
|---|---|
| C1 | `GameScene` now passes **seconds** to `PalSystem.update`; wander timers converted to seconds. Regression test: wild pal displacement < 90px/0.5s. |
| I1 | `BeltItem` carries a stable `uid`; belt item sprites keyed by uid (never array index). Regression test: sprite uid set == item uid set. |
| I2 | Panel output stacks carry `data-take="outB"`; `onPanelTake` receives the correct buffer. |
| I3 | Recipe unlock check now uses `TechSystem.unlockedTech(techId)`; 帕鲁球/戴森组件 are properly gated. |
| I4 | Mining drill only consumes node charges when the ore is stored (`bAdd > 0`). |
| I5 | `World.gen` gates node placement on the `fresh` flag; fully-depleted saves no longer resurrect nodes. |
| I6 | Tech modal progress no longer double-divides by cost; save `version` bumped to 2 with v1 migration (in-progress research reset). |
| + | Research now requires a lab building to start; `feedDyson` fires victory exactly once; wind factor uses config constants; coal generator only burns under demand; panel DOM rebuilds only on data change (select/scroll preserved); building placement rejected on the player's own tile; `interactE` picks the nearest building; missed-sphere pickups expire after 30s; `showVictory` uses `DAY_LENGTH`. |
| − | Dead code removed: `events.ts` Emitter, `inv.addStack/stacksCopy`, `World.serialize/makeItemStack/bufferCap`, `Player.worldBounds`, `PalSystem.buildingName/boostFor`, `TechSystem.isRecipeUnlocked`, `BELT_CAPACITY/DIR_NAMES/ITEM_IDS/itemColor/PAL_IDS`, `BuildingDef.hotbar` flag, duplicate `HOTBAR_ORDER` (now a single source in `data/buildings.ts`). |

Re-verification after fixes: `tsc --noEmit` clean · smoke 24/24 · loop 15/15 · victory ✓.
