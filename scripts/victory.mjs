import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await page.click("#s-new");
await page.waitForFunction(() => (window).__paldyson?.world, null, { timeout: 15000 });
await page.waitForTimeout(600);
const r = await page.evaluate(() => {
  const s = (window).__paldyson;
  const w = s.world;
  const ox = Math.round(w.state.player.x / 48) - 10, oy = Math.round(w.state.player.y / 48) - 10;
  s.buildSys.deductCost = () => undefined;
  const core = s.buildSys.place("dyson_core", ox + 5, oy + 5, 1);
  w.bAdd(core, "inB", "dyson_component", 10); // as belts/panel deposit would
  for (let i = 0; i < 10; i++) s.buildSys.feedDyson(core.uid);
  return {
    fed: w.state.stats.dysonFed,
    victoryShown: !document.getElementById("victory").classList.contains("hidden"),
    victoryText: document.querySelector(".victory-title")?.textContent ?? null,
  };
});
console.log(JSON.stringify(r));
console.log("ERRORS:", errors.length ? errors.join("|") : "none");
await page.screenshot({ path: "shots/victory.png" });
await browser.close();
