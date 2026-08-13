// Diagnose a blank page: load the game, dump DOM state + console + canvas info.
import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const logs = [];
page.on("console", (m) => logs.push(`[${m.type()}] ${m.text().slice(0, 300)}`));
page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message.slice(0, 500)}`));
page.on("requestfailed", (r) => logs.push(`[reqfail] ${r.url()} ${r.failure()?.errorText}`));
const resp = await page.goto(process.env.URL ?? "http://localhost:5173/", { waitUntil: "networkidle", timeout: 20000 });
console.log("HTTP:", resp?.status());
await page.waitForTimeout(3000);
const state = await page.evaluate(() => {
  const q = (s) => document.querySelector(s);
  return {
    bodyChildren: document.body.children.length,
    appChildren: document.getElementById("app")?.children.length,
    uiRoot: !!q("#ui-root"),
    gameParentChildren: document.getElementById("game-parent")?.children.length,
    canvasCount: document.querySelectorAll("canvas").length,
    canvasSize: (() => { const c = document.querySelector("canvas"); return c ? c.width + "x" + c.height : "none"; })(),
    startVisible: q("#start") ? !q("#start").classList.contains("hidden") : false,
    newGameBtn: !!q("#s-new"),
    hotbarSlots: document.querySelectorAll(".hslot").length,
    hasPaldyson: typeof window.__paldyson !== "undefined",
    title: document.title,
    crt: !!q("#crt"),
  };
});
console.log("DOM:", JSON.stringify(state, null, 1));
console.log("LOGS:");
logs.slice(0, 20).forEach((l) => console.log(" ", l));
console.log("logCount:", logs.length);
await browser.close();
