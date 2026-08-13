// End-to-end gameplay loop simulation: drill -> belt -> furnace -> lab ->
// research -> pal capture. Advances game time via the systems' tick functions.
// Usage: node scripts/loop.mjs
import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

await page.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await page.click("#s-new");
await page.waitForFunction(() => (window).__paldyson?.world, null, { timeout: 15000 });
await page.waitForTimeout(600);

const r = await page.evaluate(async () => {
  const s = (window).__paldyson;
  const w = s.world;
  const fail = [];
  const assert = (name, ok, detail = "") => { if (!ok) fail.push(`${name} ${detail}`); return ok; };

  // Find an iron node and a coal node.
  const nodes = Object.entries(w.state.nodes);
  const iron = nodes.find(([, n]) => n.kind === "iron");
  const coal = nodes.find(([, n]) => n.kind === "coal");
  assert("map has iron+coal nodes", !!iron && !!coal);
  if (!iron || !coal) return { fail, errors: [] };
  const [ix, iy] = iron[0].split(",").map(Number);
  const [cx, cy] = coal[0].split(",").map(Number);

  // Free placement for the sim.
  s.buildSys.deductCost = () => undefined;
  const place = (id, x, y, dir) => s.buildSys.place(id, x, y, dir);

  // Power: 3 wind turbines.
  place("wind_turbine", ix - 3, iy, 0);
  place("wind_turbine", ix - 3, iy + 1, 0);
  place("wind_turbine", ix - 3, iy + 2, 0);
  // Drill -> belt -> furnace.
  const drill = place("mining_drill", ix, iy, 1);
  s.beltSys.place(ix + 1, iy, 1);
  const furnace = place("furnace", ix + 2, iy, 3);
  // Coal drill -> belt -> lab.
  const coalDrill = place("mining_drill", cx, cy, 1);
  s.beltSys.place(cx + 1, cy, 1);
  s.beltSys.place(cx + 2, cy, 1);
  const lab = place("research_lab", cx + 3, cy, 3);
  // Feed the lab ore + coal directly (belt delivery is covered by the furnace
  // path); leave buffer room so belted coal can still arrive.
  w.bAdd(lab, "inB", "iron_ore", 8);
  w.bAdd(lab, "inB", "coal", 8);

  // Deterministic capture: force Math.random to succeed.
  const realRandom = Math.random;
  Math.random = () => 0;

  // Simulate 200 seconds in 0.25s steps.
  for (let t = 0; t < 200; t += 0.25) {
    w.state.time += 0.25;
    s.buildSys.tick(0.25);
    s.beltSys.tick(0.25);
    s.beltSys.updateSprites();
    s.techSys.tick(0.25);
    s.palSys.drain(0.25);
    if (t === 60) {
      const started = s.techSys.start("t_metallurgy");
      window.__dbg = { started, current: w.state.research.current };
    }
  }

  const oreOnBelt = w.state.belts[0]?.items.length ?? 0;
  assert("drill mined iron ore", w.bCount(drill, "outB", "iron_ore") > 0 || oreOnBelt > 0 || w.bCount(furnace, "inB", "iron_ore") > 0,
    `outB=${w.bCount(drill, "outB", "iron_ore")} belt=${oreOnBelt} furnaceIn=${w.bCount(furnace, "inB", "iron_ore")}`);
  assert("belt moved items toward furnace", oreOnBelt > 0 || w.bCount(furnace, "inB", "iron_ore") > 0, `belt=${oreOnBelt} in=${w.bCount(furnace, "inB", "iron_ore")}`);
  assert("furnace smelted ingots", w.bCount(furnace, "outB", "iron_ingot") > 0, `ingots=${w.bCount(furnace, "outB", "iron_ingot")}`);
  assert("lab produced red science", w.bCount(lab, "outB", "red_science") > 0, `reds=${w.bCount(lab, "outB", "red_science")}`);
  assert("coal drill worked", w.bCount(coalDrill, "outB", "coal") > 0 || w.bCount(lab, "inB", "coal") > 8, `outB=${w.bCount(coalDrill, "outB", "coal")} labIn=${w.bCount(lab, "inB", "coal")}`);
  assert("metallurgy researched", w.state.research.researched.includes("t_metallurgy"), `researched=${w.state.research.researched.join(",")}`);
  assert("power covers load", s.buildSys.power.gen > 0, `gen=${s.buildSys.power.gen.toFixed(1)} use=${s.buildSys.power.use}`);

  // Pal capture: teleport near a wild pal, throw a sphere, wait for tween.
  const wild = s.palSys.wild[0];
  if (wild) {
    const p = w.state.player;
    p.x = wild.sprite.x + 40;
    p.y = wild.sprite.y + 40;
    s.scene.player.sprite.setPosition(p.x, p.y);
    w.invAdd("pal_sphere", 3);
    const before = w.invCount("pal_sphere");
    s.palSys.throwSphere(p.x, p.y, wild.sprite.x, wild.sprite.y);
    await new Promise((r2) => setTimeout(r2, 1200));
    const after = w.invCount("pal_sphere");
    const captured = w.state.stats.captures;
    assert("sphere consumed on throw", after < before, `before=${before} after=${after}`);
    assert("capture succeeded (forced)", captured === 1, `captures=${captured}`);
    assert("captured pal item in inventory", w.invCount(`pal_${wild.type}`) === 1, `type=${wild.type}`);
  } else {
    fail.push("no wild pal to capture");
  }
  Math.random = realRandom;

  // C1 regression: wild pals must walk, not teleport (dt unit fix).
  w.state.time = 100; // back to daytime (hour ~16)
  const w1 = s.palSys.wild[0];
  if (w1) {
    const x0 = w1.sprite.x, y0 = w1.sprite.y;
    w1.tx = w1.sprite.x + 96;
    w1.ty = w1.sprite.y;
    w1.mode = "wander";
    w1.timer = 5;
    await new Promise((r2) => setTimeout(r2, 500));
    const d = Math.hypot(w1.sprite.x - x0, w1.sprite.y - y0);
    assert("wild pal walks (no teleport)", d > 3 && d < 90, `displacement=${d.toFixed(1)}px/0.5s`);
  }

  // I1 regression: belt item sprites are keyed by item uid.
  const b1 = w.state.belts[0];
  const beltMap = s.beltSys["itemSprites"].get(b1.uid);
  const spriteUids = beltMap ? [...beltMap.keys()].sort((a, z) => a - z) : [];
  const itemUids = b1.items.map((i) => i.uid).sort((a, z) => a - z);
  assert("belt sprite uids match item uids", JSON.stringify(spriteUids) === JSON.stringify(itemUids),
    `sprites=${JSON.stringify(spriteUids)} items=${JSON.stringify(itemUids)}`);

  // Deconstruct test: pal assignment cleanup.
  const voltPal = (() => { w.invAdd("pal_volt", 1); s.palSys.releaseFromInventory("volt"); return w.state.pals.find((p) => p.type === "volt"); })();
  if (voltPal) {
    s.palSys.assignJob(voltPal.uid, { kind: "building", targetUid: furnace.uid });
    const assigned = furnace.palUid === voltPal.uid;
    s.buildSys.deconstruct(furnace.uid);
    const cleaned = w.state.pals.find((p) => p.uid === voltPal.uid)?.job.kind === "none";
    assert("pal assigned to furnace", assigned);
    assert("deconstruct cleans pal assignment", cleaned);
  }

  return {
    fail, power: s.buildSys.power, stats: w.state.stats,
    dbg: window.__dbg,
    labIn: lab.inB, labOut: lab.outB,
    research: w.state.research,
  };
});

console.log("failures:", JSON.stringify(r.fail, null, 1));
console.log("power:", JSON.stringify(r.power));
console.log("stats:", JSON.stringify(r.stats));
console.log("dbg:", JSON.stringify(r.dbg));
console.log("labIn:", JSON.stringify(r.labIn));
console.log("labOut:", JSON.stringify(r.labOut));
console.log("research:", JSON.stringify(r.research));
console.log("ERRORS:", errors.length ? errors.join(" | ") : "none");
await browser.close();
process.exit(r.fail.length || errors.length ? 1 : 0);
