// Headless smoke test: boot the game, start a new run, walk around, screenshot.
// Usage: node scripts/screenshot.mjs [outDir]
import { chromium } from "playwright";
import fs from "node:fs";

const outDir = process.argv[2] ?? "shots";
fs.mkdirSync(outDir, { recursive: true });

const errors = [];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push("[console] " + msg.text());
});
page.on("pageerror", (e) => errors.push("[page] " + e.message));

await page.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
await page.screenshot({ path: `${outDir}/01-start.png` });

// Start a new game.
await page.click("#s-new");
await page.waitForTimeout(3500);
await page.screenshot({ path: `${outDir}/02-gameplay.png` });

// Move with WASD.
await page.keyboard.down("w");
await page.waitForTimeout(600);
await page.keyboard.up("w");
await page.keyboard.down("d");
await page.waitForTimeout(600);
await page.keyboard.up("d");
await page.waitForTimeout(400);
await page.screenshot({ path: `${outDir}/03-moved.png` });

// Open tech tree modal, then close.
await page.click("#btn-tech");
await page.waitForTimeout(500);
await page.screenshot({ path: `${outDir}/04-tech.png` });
await page.keyboard.press("Escape");
await page.waitForTimeout(300);

// Open pals modal, close.
await page.click("#btn-pals");
await page.waitForTimeout(500);
await page.screenshot({ path: `${outDir}/05-pals.png` });
await page.keyboard.press("Escape");
await page.waitForTimeout(300);

// Open build menu.
await page.keyboard.press("b");
await page.waitForTimeout(400);
await page.screenshot({ path: `${outDir}/06-buildmenu.png` });
await page.keyboard.press("b");

// Save via menu.
await page.click("#btn-menu");
await page.waitForTimeout(300);
await page.screenshot({ path: `${outDir}/07-menu.png` });
await page.click("#m-save");
await page.waitForTimeout(400);

console.log("SAVED_SHOT_FILES:", fs.readdirSync(outDir).join(", "));
console.log("ERRORS:", errors.length ? "\n" + errors.join("\n") : "none");
await browser.close();
process.exit(errors.length ? 1 : 0);
