// Automated smoke test: boot, start game, build a wind turbine, verify power,
// save, reload, continue, verify persistence. Asserts via DOM + __paldyson.
// Usage: node scripts/smoke.mjs
import { chromium } from "playwright";

const URL = process.env.URL ?? "http://localhost:5173/";
const failures = [];
const errors = [];

function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
  if (!ok) failures.push(name);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push("[console] " + msg.text());
});
page.on("pageerror", (e) => errors.push("[page] " + e.message));

// --- Boot & start ---
await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForSelector("#s-new", { timeout: 15000 });
check("start screen shows 新游戏 button", true);

await page.click("#s-new");
await page.waitForFunction(() => (window).__paldyson?.world, null, { timeout: 15000 });
await page.waitForTimeout(1000);

const state0 = await page.evaluate(() => ({
  nodes: Object.keys((window).__paldyson.world.state.nodes).length,
  inv: { ...(window).__paldyson.world.state.inventory },
  player: { ...(window).__paldyson.world.state.player },
  terrain: (window).__paldyson.world.terrain.length,
}));
check("world generated with nodes", state0.nodes > 50, `nodes=${state0.nodes}`);
check("starter inventory given", state0.inv.wood === 8 && state0.inv.stone === 4, JSON.stringify(state0.inv));
check("player at spawn", state0.player.x > 2000 && state0.player.x < 2600);
check("terrain 96x96", state0.terrain === 96 * 96);

// Canvas present & UI visible.
check("canvas rendered", await page.locator("canvas").count() === 1);
check("hotbar has 11 slots", await page.locator(".hslot").count() === 11);

// --- Build a wind turbine ---
await page.keyboard.press("1");
await page.waitForTimeout(300);
const ghost = await page.evaluate(() => {
  const s = (window).__paldyson.scene;
  return s.ghost ? { x: s.ghost.x, y: s.ghost.y, tex: s.ghost.texture.key } : null;
});
check("ghost appears for wind turbine", ghost !== null, JSON.stringify(ghost));

await page.mouse.move(440, 400);
await page.waitForTimeout(200);
await page.mouse.down();
await page.mouse.up();
await page.waitForTimeout(800);

const after = await page.evaluate(() => {
  const s = (window).__paldyson;
  const b = s.world.state.buildings;
  return {
    count: b.length,
    id: b[0]?.id,
    invWood: s.world.state.inventory.wood,
    invStone: s.world.state.inventory.stone,
    power: { ...s.buildSys.power },
    ghost: s.scene.ghost,
  };
});
check("building placed", after.count === 1 && after.id === "wind_turbine", JSON.stringify(after));
check("cost deducted", after.invWood === 4 && after.invStone === 2, `wood=${after.invWood} stone=${after.invStone}`);
check("power generated", after.power.gen > 0, `gen=${after.power.gen.toFixed(1)}`);
check("ghost cleared after placement", after.ghost === null);

// Power chip UI shows values.
const powerChip = await page.textContent("#top-power");
check("power chip updated", /⚡ \d+\.?\d*\/\d+/.test(powerChip ?? ""), powerChip ?? "");

// --- Gather a tree near spawn (teleport player next to a tree node) ---
const gather = await page.evaluate(async () => {
  const s = (window).__paldyson;
  const world = s.world;
  const nodes = Object.entries(world.state.nodes);
  const tree = nodes.find(([, n]) => n.kind === "tree") ?? nodes[0];
  if (!tree) return { ok: false };
  const [x, y] = tree[0].split(",").map(Number);
  // Teleport the player next to the node and gather once via the node logic.
  world.state.player.x = x * 48 + 24;
  world.state.player.y = y * 48 + 24;
  s.scene.player.sprite.setPosition(world.state.player.x, world.state.player.y);
  const before = world.state.inventory.wood ?? 0;
  s.scene.gatherOnce(x, y);
  const after2 = world.state.inventory.wood ?? 0;
  return { ok: after2 > before, before, after: after2, kind: tree[1].kind };
});
check("gatherOnce works", gather.ok, JSON.stringify(gather));

// --- Place a mining drill is impossible without tech-free ore nearby; check canPlaceAt rejects water ---
const canPlace = await page.evaluate(() => {
  const s = (window).__paldyson;
  const world = s.world;
  // find a water tile
  for (let y = 1; y < 95; y++) {
    for (let x = 1; x < 95; x++) {
      if (world.terrain[y * 96 + x] === 1) {
        return { ok: s.buildSys.canPlaceAt("wind_turbine", x, y).ok, x, y };
      }
    }
  }
  return { ok: "no-water-found" };
});
check("water blocks building", canPlace.ok === false, JSON.stringify(canPlace));

// --- Save & reload ---
await page.click("#btn-menu");
await page.waitForTimeout(200);
await page.click("#m-save");
await page.waitForTimeout(300);
await page.keyboard.press("Escape");
await page.waitForTimeout(200);

const saved = await page.evaluate(() => localStorage.getItem("paldyson_save_v1"));
check("save written to localStorage", !!saved && JSON.parse(saved).buildings.length === 1);

await page.reload({ waitUntil: "networkidle" });
await page.waitForSelector("#s-cont", { timeout: 15000 });
check("continue button appears after save", true);
await page.click("#s-cont");
await page.waitForFunction(() => (window).__paldyson?.world, null, { timeout: 15000 });
await page.waitForTimeout(600);

const loaded = await page.evaluate(() => ({
  buildings: (window).__paldyson.world.state.buildings.map((b) => b.id),
  wood: (window).__paldyson.world.state.inventory.wood,
  sprites: (window).__paldyson.scene.buildSys.sprites.size,
}));
check("load restores building", loaded.buildings.includes("wind_turbine"), JSON.stringify(loaded));
check("load restores inventory", loaded.wood === 5, `wood=${loaded.wood}`);
check("load restores sprites", loaded.sprites === 1, `sprites=${loaded.sprites}`);

// --- Tech modal opens ---
await page.click("#btn-tech");
await page.waitForTimeout(400);
check("tech modal lists 6 techs", await page.locator(".tech-row").count() === 6);
await page.keyboard.press("Escape");

// --- Pals modal opens ---
await page.click("#btn-pals");
await page.waitForTimeout(400);
check("pals modal shows empty state", await page.locator(".pal-sec-title").count() >= 2);
await page.keyboard.press("Escape");

// --- Errors ---
check("no page errors", errors.length === 0, errors.join(" | "));

console.log("\n=== SUMMARY ===");
console.log(failures.length === 0 ? "ALL TESTS PASSED ✅" : `${failures.length} FAILURES ❌`);
await browser.close();
process.exit(failures.length ? 1 : 0);
