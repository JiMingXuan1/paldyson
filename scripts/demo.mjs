// Build a demo factory via the debug handle, zoom in, screenshot.
// Usage: node scripts/demo.mjs
import { chromium } from "playwright";
import fs from "node:fs";

fs.mkdirSync("shots", { recursive: true });
const errors = [];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

await page.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await page.click("#s-new");
await page.waitForFunction(() => (window).__paldyson?.world, null, { timeout: 15000 });
await page.waitForTimeout(800);

await page.evaluate(() => {
  const s = (window).__paldyson;
  const w = s.world;
  const px = w.state.player.x, py = w.state.player.y;
  const ox = Math.round(px / 48) - 10, oy = Math.round(py / 48) - 10;

  // Wind turbine (power).
  w.state.player.x = (ox + 6) * 48 + 24;
  w.state.player.y = (oy + 8) * 48 + 24;
  s.scene.player.sprite.setPosition(w.state.player.x, w.state.player.y);
  s.buildSys.deductCost = () => undefined; // free build for the demo
  const place = (id, dx, dy, dir = 1) => s.buildSys.place(id, ox + dx, oy + dy, dir);

  place("wind_turbine", 2, 0, 0);
  place("furnace", 4, 4, 1);
  s.beltSys.place(ox + 5, oy + 4, 1);
  s.beltSys.place(ox + 6, oy + 4, 1);
  place("assembler", 7, 4, 3);
  place("research_lab", 4, 6, 1);
  place("chest", 6, 6, 1);
  place("pal_terminal", 7, 6, 1);
  place("dyson_core", 9, 6, 1);
  place("coal_generator", 2, 6, 1);

  // Give resources & items on the belt.
  w.invAdd("iron_ore", 12);
  w.invAdd("coal", 8);
  w.invAdd("iron_ingot", 4);
  w.invAdd("gear", 3);
  w.invAdd("circuit", 2);
  w.invAdd("dyson_component", 4);
  const furnace = w.state.buildings.find((b) => b.id === "furnace");
  const lab = w.state.buildings.find((b) => b.id === "research_lab");
  const assembler = w.state.buildings.find((b) => b.id === "assembler");
  const gen = w.state.buildings.find((b) => b.id === "coal_generator");
  w.bAdd(furnace, "inB", "iron_ore", 8);
  w.bAdd(furnace, "outB", "iron_ingot", 2);
  w.bAdd(lab, "inB", "iron_ore", 3);
  w.bAdd(lab, "inB", "coal", 3);
  w.bAdd(assembler, "inB", "iron_ingot", 4);
  w.bAdd(assembler, "inB", "coal", 2);
  w.bAdd(gen, "inB", "coal", 3);
  gen.fuel = 4;
  const belt1 = w.state.belts[0];
  belt1.items.push({ id: "iron_ingot", pos: 0.25 }, { id: "gear", pos: 0.7 });
  const belt2 = w.state.belts[1];
  belt2.items.push({ id: "gear", pos: 0.4 });
  s.beltSys.rebuildItemSprites?.(belt1);
  s.beltSys.rebuildItemSprites?.(belt2);
  const b1 = s.beltSys.sprites.get(belt1.uid);

  // Release two pals and assign them.
  w.invAdd("pal_sprout", 1);
  w.invAdd("pal_volt", 1);
  s.palSys.releaseFromInventory("sprout");
  s.palSys.releaseFromInventory("volt");
  const volt = w.state.pals.find((p) => p.type === "volt");
  if (volt) s.palSys.assignJob(volt.uid, { kind: "building", targetUid: assembler.uid });
  const sprout = w.state.pals.find((p) => p.type === "sprout");
  if (sprout) s.palSys.assignJob(sprout.uid, { kind: "follow" });

  // Zoom camera onto the factory.
  s.scene.cameras.main.setZoom(2);
  s.scene.cameras.main.centerOn((ox + 5.5) * 48, (oy + 4) * 48);
  void b1;
});

await page.waitForTimeout(2500); // let production tick
await page.screenshot({ path: "shots/demo-factory.png" });

// Night test: fast-forward time.
await page.evaluate(() => {
  const s = (window).__paldyson;
  s.world.state.time = 60 * 9 + 30; // ~9:30pm
  s.scene.cameras.main.setZoom(1.4);
});
await page.waitForTimeout(1500);
await page.screenshot({ path: "shots/demo-night.png" });

console.log("ERRORS:", errors.length ? errors.join(" | ") : "none");
await browser.close();
process.exit(errors.length ? 1 : 0);
