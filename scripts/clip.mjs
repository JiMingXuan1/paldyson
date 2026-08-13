// Crop screenshots around each placed building using EXACT sprite positions.
import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on("pageerror", (e) => console.log("PAGEERR:", e.message));
await page.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await page.click("#s-new");
await page.waitForFunction(() => (window).__paldyson?.world, null, { timeout: 15000 });
await page.waitForTimeout(500);
const spots = await page.evaluate(async () => {
  const s = (window).__paldyson;
  const w = s.world;
  const ox = Math.round(w.state.player.x / 48) - 10, oy = Math.round(w.state.player.y / 48) - 10;
  w.state.player.x = (ox + 6) * 48 + 24;
  w.state.player.y = (oy + 8) * 48 + 24;
  s.scene.player.sprite.setPosition(w.state.player.x, w.state.player.y);
  s.buildSys.deductCost = () => undefined;
  const place = (id, dx, dy, dir = 1) => s.buildSys.place(id, ox + dx, oy + dy, dir);
  const turbine = place("wind_turbine", 2, 0, 0);
  const furnace = place("furnace", 4, 4, 1);
  s.beltSys.place(ox + 5, oy + 4, 1);
  const assembler = place("assembler", 7, 4, 3);
  const lab = place("research_lab", 4, 6, 1);
  place("pal_terminal", 7, 6, 1);
  place("dyson_core", 9, 6, 1);
  place("chest", 6, 6, 1);
  const w2 = s.world;
  w2.invAdd("iron_ore", 12); w2.invAdd("coal", 8); w2.invAdd("iron_ingot", 4); w2.invAdd("gear", 3);
  w2.invAdd("pal_sprout", 1); w2.invAdd("pal_volt", 1); w2.invAdd("berries", 5);
  w2.bAdd(furnace, "inB", "iron_ore", 8);
  w2.bAdd(furnace, "outB", "iron_ingot", 2);
  const belt1 = w2.state.belts[0];
  belt1.items.push({ id: "iron_ingot", pos: 0.3 }, { id: "gear", pos: 0.7 });
  s.beltSys.rebuildItemSprites(belt1);
  s.palSys.releaseFromInventory("sprout");
  const sprout = w2.state.pals.find((p) => p.type === "sprout");
  if (sprout) s.palSys.assignJob(sprout.uid, { kind: "follow" });
  s.palSys.releaseFromInventory("volt");
  const volt = w2.state.pals.find((p) => p.type === "volt");
  if (volt && assembler) s.palSys.assignJob(volt.uid, { kind: "building", targetUid: assembler.uid });
  s.scene.cameras.main.stopFollow();
  s.scene.cameras.main.setZoom(2);
  s.scene.cameras.main.centerOn((ox + 5.5) * 48, (oy + 4) * 48);
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const c = s.scene.cameras.main;
  const toScreen = (img) => ({
    x: (img.x - c.scrollX - c.width * 0.5) * c.zoom + c.width * 0.5,
    y: (img.y - c.scrollY - c.height * 0.5) * c.zoom + c.height * 0.5,
  });
  const out = {
    furnace: toScreen(s.scene.buildSys.sprites.get(furnace.uid)),
    belt1: toScreen(s.beltSys.sprites.get(belt1.uid)),
    assembler: toScreen(s.scene.buildSys.sprites.get(assembler.uid)),
    lab: toScreen(s.scene.buildSys.sprites.get(lab.uid)),
    player: { x: (s.scene.player.sprite.x - c.scrollX) * c.zoom, y: (s.scene.player.sprite.y - c.scrollY) * c.zoom },
    turbine: toScreen(s.scene.buildSys.sprites.get(turbine.uid)),
  };
  return out;
});
console.log("SPOTS:", JSON.stringify(spots));
for (const [name, p] of Object.entries(spots)) {
  const cx = Math.max(0, Math.min(1280 - 192, p.x - 96));
  const cy = Math.max(0, Math.min(800 - 192, p.y - 96));
  await page.screenshot({ path: `shots/crop-${name}.png`, clip: { x: cx, y: cy, width: 192, height: 192 } });
}
await browser.close();
