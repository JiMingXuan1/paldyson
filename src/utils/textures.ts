// All game art is generated procedurally as PIXEL MAPS (string arrays with
// palettes) — a deliberate retro pixel-art style with zero external assets.
// Phaser runs with pixelArt:true so everything renders crisp and chunky.

import Phaser from "phaser";
import { PALS } from "../data/pals";

type Palette = Record<string, number>;

/**
 * Generate a texture from a pixel map.
 * @param rows string rows; "." = transparent; letters map into `pal`.
 */
function pm(
  scene: Phaser.Scene,
  key: string,
  rows: string[],
  pal: Palette,
  scale: number,
): void {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === ".") continue;
      const color = pal[ch];
      if (color === undefined) continue;
      g.fillStyle(color, 1);
      g.fillRect(x * scale, y * scale, scale, scale);
    }
  });
  const w = (rows[0]?.length ?? 0) * scale;
  const h = rows.length * scale;
  g.generateTexture(key, w, h);
  g.destroy();
}

/** Solid-color base tile with an overlay pixel map. */
function tileMap(
  scene: Phaser.Scene,
  key: string,
  rows: string[],
  base: number,
  pal: Palette,
  scale: number,
): void {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(base, 1);
  g.fillRect(0, 0, rows[0].length * scale, rows.length * scale);
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === ".") continue;
      const color = pal[ch];
      if (color === undefined) continue;
      g.fillStyle(color, 1);
      g.fillRect(x * scale, y * scale, scale, scale);
    }
  });
  const w = rows[0].length * scale;
  const h = rows.length * scale;
  g.generateTexture(key, w, h);
  g.destroy();
}

const S = 4; // 12x12 maps -> 48px tiles

export function createAllTextures(scene: Phaser.Scene): void {
  // ---- Terrain ----
  tileMap(scene, "tile_grass", [
    "............",
    "..L..L...L..",
    ".L..LL..L...",
    "..L..L..L...",
    "....L..L..L.",
    ".L....L.....",
    "..LL..L.....",
    "...L..L..LL.",
    "L...L...L...",
    ".L...LL..L..",
    "..L..L...L..",
    "....L..d....",
  ], 0x3c8c3c, { L: 0x4aa04a, d: 0x2f732f }, S);
  tileMap(scene, "tile_grass2", [
    "............",
    "...L..L.....",
    "....L...L...",
    ".L....LL....",
    "..L..L..L...",
    "L..LL..L....",
    "....L...L...",
    "..L....LL...",
    ".L...L...L..",
    "...L..L..L..",
    "....L..L....",
    "............",
  ], 0x3c8c3c, { L: 0x4aa04a, d: 0x2f732f }, S);
  tileMap(scene, "tile_grass3", [
    "....L.......",
    "..L..L..L...",
    "....L...L...",
    "..F....L....",
    "....L..F....",
    ".....L......",
    "..L....L....",
    "....L....L..",
    "..L....L....",
    "....LL..L...",
    "..L..L..L...",
    "....L...F...",
  ], 0x3c8c3c, { L: 0x4aa04a, F: 0xe8e8e8 }, S);
  tileMap(scene, "tile_water", [
    "............",
    "....ww......",
    "..ww...w....",
    "......ww....",
    "..w....w..w.",
    "...w...ww...",
    "....ww..w...",
    "..w...w.....",
    "...w...ww...",
    "....ww......",
    "............",
  ], 0x2e6fb0, { w: 0x4a8fd0, d: 0x2560a0 }, S);

  // ---- Resource nodes ----
  pm(scene, "node_tree", [
    "....tttt....",
    "...tGGGGt...",
    "..tGGGGGGt..",
    ".tGGGGGGGGt.",
    ".tGgGGGGGg..",
    ".tGGGGGGGGt.",
    "..tGGGGGGt..",
    "...tGGGGt...",
    "....tttt....",
    "....tt......",
    "....tt......",
    "...tttt.....",
  ], { t: 0x6d4326, G: 0x2f7d3a, g: 0x45a04e }, S);
  pm(scene, "node_rock", [
    "....rr......",
    "...rrrr.....",
    "..rrrrrr....",
    ".rrrLrrrr...",
    ".rrLrrrrr...",
    ".rrrrrLrr...",
    "..rrrrrr....",
    "..rrrrrr....",
    ".rrddrrr....",
    ".rdd.rrr....",
    "............",
  ], { r: 0x7d828c, L: 0x8f949e, d: 0x5d626c }, S);
  pm(scene, "node_iron", [
    ".....rr.....",
    "....rrrr....",
    "...rrrrrr...",
    "..rrOrrrr...",
    ".rrrrrOrr...",
    ".rrrrrrrr...",
    "..rrOrrrr...",
    "..rrrrrr....",
    ".rrOOOrr....",
    ".rOO.rrr....",
    "............",
  ], { r: 0x6a6f78, O: 0xd98a4a }, S);
  pm(scene, "node_coal", [
    ".....rr.....",
    "....rrrr....",
    "...rrrrrr...",
    "..rrCrrrr...",
    ".rrrrrCrr...",
    ".rrCcrrrr...",
    "..rrrrrr....",
    "..rrCrrr....",
    ".rrCCCrr....",
    ".rCC.rrr....",
    "............",
  ], { r: 0x4c505a, C: 0x23262c }, S);
  pm(scene, "node_berry", [
    "............",
    "....gg......",
    "..gggggg....",
    ".gggggggg...",
    ".ggBggBgg...",
    "..gggggg....",
    ".ggBggggg...",
    "..ggBggg....",
    "..gggggg....",
    "............",
  ], { g: 0x2f7d3a, B: 0xd94a6a }, S);

  // ---- Buildings (12x12 @4) ----
  pm(scene, "bld_wind_turbine", [
    "....ttt.....",
    "...ttttt....",
    "..ttttttt...",
    "....ttt.....",
    "....ttt.....",
    "....ttt.....",
    "....ttt.....",
    "....ttt.....",
    "....ttt.....",
    "...ttttt....",
    "...sssss....",
    "............",
  ], { t: 0xeef4fa, s: 0x9aa8b8 }, S);
  pm(scene, "bld_coal_generator", [
    "..bb..bb....",
    "..bb..bb....",
    "..bb..bb....",
    ".bbbbbbbb...",
    ".bddddddb...",
    ".bdffffdb...",
    ".bdffffdb...",
    ".bddddddb...",
    ".bbbbbbbb...",
    "..cccccc....",
    "..cc..cc....",
    "............",
  ], { b: 0x232a33, d: 0x39424e, f: 0x5aa0e0, c: 0x5a6068 }, S);
  pm(scene, "bld_mining_drill", [
    "..gggggg....",
    "..gddddg....",
    "..gddddg....",
    "..gddddg..r.",
    "..gggggg.rr.",
    ".....rrrrr..",
    "....rrrrr...",
    "...rrrrr....",
    "...rrrr.....",
    "...ssss.....",
    "...ssss.....",
    "............",
  ], { g: 0x9aa8b8, d: 0xc8d2de, r: 0xd98a4a, s: 0x39424e }, S);
  pm(scene, "bld_furnace", [
    "..bbbbbb....",
    "..bccccb....",
    "..bccccb....",
    "..bccccb....",
    "..bccccb....",
    "..bbbbbb....",
    "..bbb.bb....",
    "..bffffb....",
    "..bfyffb....",
    "..bbbbbb....",
    "............",
    "............",
  ], { b: 0x8a5a3c, c: 0x5e3a26, f: 0xff8a2a, y: 0xffd24a }, S);
  pm(scene, "bld_assembler", [
    "..bbbbbb....",
    "..bddddb....",
    "..bdwwdb....",
    "..bdwwdb....",
    "..bddddb....",
    "..bbbbbb....",
    "..bddddb....",
    "..bddddb....",
    "..bddddb....",
    "..bbbbbb....",
    "............",
  ], { b: 0x234a75, d: 0x3a6ea8, w: 0xeef4fa }, S);
  pm(scene, "bld_research_lab", [
    "..pppppp....",
    "..pddddp....",
    "..pdFddp....",
    "..pddddp....",
    "..pppppp....",
    "..pppppp....",
    "..pf..fp....",
    "..pff..p....",
    "..pffffp....",
    "..pppppp....",
    "............",
  ], { p: 0x462f6e, d: 0x6a4a9a, f: 0x8ae05a, F: 0xc8b8e8 }, S);
  pm(scene, "bld_chest", [
    "..bbbbbb....",
    "..bllllb....",
    "..bllllb....",
    "..bbbbbb....",
    "..bbbbbb....",
    "..bbkkbb....",
    "..bbkkbb....",
    "..bbbbbb....",
    "..bbbbbb....",
    "..bbbbbb....",
    "............",
  ], { b: 0x9a6a3a, l: 0xc08a5a, k: 0x39424e }, S);
  pm(scene, "bld_pal_terminal", [
    "..bbbbbb....",
    "..bppppb....",
    "..bppppb....",
    "..bppppb....",
    "..bbbbbb....",
    "..bbbbbb....",
    "..bbbbbb....",
    "..bbbbbb....",
    "..bbbbbb....",
    "..bbbbbb....",
    "............",
  ], { b: 0x232a33, p: 0xff9ad5 }, S);
  pm(scene, "bld_dyson_core", [
    "..yyyyyy....",
    ".yywwwwyy...",
    ".yw....wy...",
    ".yw....wy...",
    ".yw....wy...",
    ".yw....wy...",
    ".yw....wy...",
    ".yw....wy...",
    ".yywwwwyy...",
    "..yyyyyy....",
    "............",
  ], { y: 0xffd24a, w: 0xfff0b0 }, S);

  // Belts: 4 directions (0=N, 1=E, 2=S, 3=W); "^v><" are arrow pixels.
  const BELT_PAL: Palette = { l: 0x6a6f7a, "^": 0xb8bec8, v: 0xb8bec8, ">": 0xb8bec8, "<": 0xb8bec8 };
  pm(scene, "bld_belt_0", [
    "............",
    "..llllll....",
    "..l^^^^l....",
    "..l^^^^l....",
    "..l^^^^l....",
    "..llllll....",
    "............",
    "............",
    "............",
    "............",
    "............",
  ], BELT_PAL, S);
  pm(scene, "bld_belt_1", [
    "............",
    "............",
    "............",
    "..llllllll..",
    "..l>>>>l...",
    "..llllllll..",
    "............",
    "............",
    "............",
    "............",
    "............",
  ], BELT_PAL, S);
  pm(scene, "bld_belt_2", [
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
    "..llllll....",
    "..lvvvvl....",
    "..lvvvvl....",
    "..lvvvvl....",
    "..llllll....",
  ], BELT_PAL, S);
  pm(scene, "bld_belt_3", [
    "............",
    "............",
    "............",
    "..llllllll..",
    "..l<<<<l...",
    "..llllllll..",
    "............",
    "............",
    "............",
    "............",
    "............",
  ], BELT_PAL, S);

  // ---- Player (12x12 @3 = 36px) ----
  pm(scene, "player", [
    "....hhhh....",
    "...hhhhhh...",
    "...heeeeh...",
    "...heeeeh...",
    "...hhhhhh...",
    "...bbbbbb...",
    "..bbbbbbbb..",
    "..bj....jb..",
    "..bbbbbbbb..",
    "..bbbbbbbb..",
    "...bb..bb...",
    "...bb..bb...",
  ], { h: 0x39424e, e: 0x5aa0e0, b: 0x2b2b33, j: 0xd9b380 }, 3);
  pm(scene, "sphere", [
    "...ppp...",
    "..ppppp..",
    ".ppWpppp.",
    ".ppWpppp.",
    ".ppppppp.",
    "..ppppp..",
    "...ppp...",
    ".........",
  ], { p: 0xff9ad5, W: 0xffffff }, 2);
  pm(scene, "shadow", [
    "..llll..",
    ".llllll.",
    ".llllll.",
    "..llll..",
  ], { l: 0x000000 }, 4);
  pm(scene, "reticle", [
    "bb......bb",
    "bb......bb",
    "..........",
    "..........",
    ".....b....",
    "..........",
    "..........",
    "bb......bb",
    "bb......bb",
  ], { b: 0xffffff }, 3);

  // ---- Items (8x8 @2 = 16px) ----
  const itemMaps: Record<string, { rows: string[]; pal: Palette }> = {
    wood: { rows: ["..bbbb..", ".byyyyb.", ".byyyyb.", ".byyyyb.", ".byyyyb.", "..bbbb..", "........", "........"], pal: { b: 0x6d4326, y: 0xb07a3e } },
    stone: { rows: ["...rr...", "..rrrr..", ".rrLrrr.", ".rrrrrr.", ".rrddrr.", "..rrrr..", "...rr...", "........"], pal: { r: 0x7d828c, L: 0x8f949e, d: 0x5d626c } },
    iron_ore: { rows: ["...rr...", "..rOrr..", ".rrOOrr.", ".rrrrrr.", ".rrrrO..", "..rOr...", "...r....", "........"], pal: { r: 0x6a6f78, O: 0xd98a4a } },
    coal: { rows: ["...rr...", "..rCrr..", ".rrCCrr.", ".rrrrrr.", ".rrrCC..", "..rCr...", "...r....", "........"], pal: { r: 0x4c505a, C: 0x23262c } },
    berries: { rows: ["........", "...B....", "..B.B...", "...B....", "........", "........", "........", "........"], pal: { B: 0xd94a6a } },
    iron_ingot: { rows: ["........", "........", ".yyyyyy.", ".yyyyyy.", ".yyyyyy.", "........", "........", "........"], pal: { y: 0xcfd6e0 } },
    gear: { rows: ["...yy...", "..y..y..", ".y.yy.y.", ".y.yy.y.", "..y..y..", "...yy...", "........", "........"], pal: { y: 0x8fa3b8 } },
    circuit: { rows: ["..gggg..", ".gggggg.", ".gyggyg.", ".gyggyg.", ".gggggg.", ".gggggg.", "........", "........"], pal: { g: 0x2f7d3a, y: 0xffd24a } },
    red_science: { rows: ["...rr...", "..rrrr..", ".rwwrrr.", ".rrrrrr.", "..rrrr..", "...rr...", "........", "........"], pal: { r: 0xe04848, w: 0xfff0f0 } },
    pal_sphere: { rows: ["...pp...", "..pppp..", ".ppWppp.", ".pppppp.", "..pppp..", "...pp...", "........", "........"], pal: { p: 0xff9ad5, W: 0xffffff } },
    dyson_component: { rows: ["..yyyy..", ".y....y.", ".y....y.", ".y....y.", ".y....y.", "..yyyy..", "........", "........"], pal: { y: 0xffd24a } },
  };
  for (const [id, map] of Object.entries(itemMaps)) {
    pm(scene, `item_${id}`, map.rows, map.pal, 2);
  }
  // Pal items: mini colored faces.
  const palItemColors: Record<string, number> = {
    sprout: 0x7ec850, rock: 0xb08d6a, ember: 0xff7a3c, volt: 0xffd23c, aqua: 0x5ab8ff,
  };
  for (const [pid, color] of Object.entries(palItemColors)) {
    pm(scene, `item_pal_${pid}`, [
      "...cc...",
      "..cccc..",
      ".ccWccc.",
      ".ccWccc.",
      "..cccc..",
      "...cc...",
      "........",
      "........",
    ], { c: color, W: 0xffffff }, 2);
  }

  // ---- Pal sprites from pixel maps (12x12 @3 = 36px) ----
  for (const def of Object.values(PALS)) {
    const c = Phaser.Display.Color.HexStringToColor(def.color);
    const main = c.color;
    const light = c.lighten(18).color;
    const dark = c.darken(22).color;
    pm(scene, `pal_${def.id}`, def.sprite, {
      c: main, l: light, d: dark, e: 0xffffff, p: 0x1a1a22, f: 0xffd24a,
    }, 3);
  }
}
