// Pal (creature) definitions, including 12x12 pixel-art sprites.
// Sprite map legend: "." empty, "c" main color, "l" light, "d" dark, "e" eye(white), "p" pupil(dark), "f" accent.

export interface PalDef {
  id: string;
  name: string;
  rarity: "common" | "rare" | "epic";
  color: string; // CSS
  sprite: string[];
  worksWith: string[]; // building ids it excels at
  desc: string;
}

export const PALS: Record<string, PalDef> = {
  sprout: {
    id: "sprout",
    name: "芽芽兽",
    rarity: "common",
    color: "#7ec850",
    worksWith: ["research_lab", "mining_drill", "chest"],
    desc: "头顶嫩芽的小家伙，亲近自然，帮得上科研与采集的忙。",
    sprite: [
      "....cccc....",
      "...cccccc...",
      "...cllllc...",
      "..ccffffcc..",
      ".ccffffffcc.",
      ".cfefppefc..",
      ".cfefppefc..",
      ".ccffffffcc.",
      "..ccffddcc..",
      "...cddddc...",
      "..ccdccdcc..",
      "..cc..cc....",
    ],
  },
  rock: {
    id: "rock",
    name: "岩岩兽",
    rarity: "common",
    color: "#b08d6a",
    worksWith: ["mining_drill", "furnace", "chest"],
    desc: "浑身硬壳的岩系帕鲁，采矿效率一流。",
    sprite: [
    "....dddd....",
      "...dccccd...",
      "..dccccccd..",
      ".dccceecccd.",
      ".dccceecccd.",
      ".dccccccccd.",
      "..dccffccd..",
      "...dccccd...",
      "..cddccddc..",
      ".cccdcccdcc.",
      ".ccd.cc.dcc.",
      "..d...d...d.",
    ],
  },
  ember: {
    id: "ember",
    name: "火苗鸟",
    rarity: "rare",
    color: "#ff7a3c",
    worksWith: ["furnace", "coal_generator", "assembler"],
    desc: "尾羽带火的小鸟，冶炼炉边的常客。",
    sprite: [
      "....c.......",
      "...cf.......",
      "..cccf......",
      ".ccccc......",
      ".ceecfc.....",
      ".ceecffc....",
      ".cccccffc...",
      "..ccc.ffc...",
      ".ccfc..ffc..",
      ".cf.c...ffc.",
      ".c.......fc.",
      "..........c.",
    ],
  },
  volt: {
    id: "volt",
    name: "雷雷鼠",
    rarity: "rare",
    color: "#ffd23c",
    worksWith: ["assembler", "wind_turbine", "coal_generator", "mining_drill"],
    desc: "尾巴会放电的老鼠，装配线上效率惊人。",
    sprite: [
      "....cccc....",
      "...cccccc...",
      "..ccceeccc..",
      "..ccceeccc..",
      "..ccccffcc..",
      "...ccffcc...",
      "..ccfccfcc..",
      ".ccccfcfccc.",
      "..cccccccc..",
      "...c.ddd.c..",
      "....d.d.d...",
      "...d..d..d..",
    ],
  },
  aqua: {
    id: "aqua",
    name: "泡泡鱼",
    rarity: "epic",
    color: "#5ab8ff",
    worksWith: ["research_lab", "assembler", "chest", "wind_turbine"],
    desc: "会吐泡泡的稀有水系帕鲁，科研与物流的好搭档。",
    sprite: [
      ".....cc.....",
      "....cccc....",
      "...cffcc....",
      "..ccffecc...",
      "..cceeecc...",
      ".ccceeeccc..",
      ".ccceeeccc..",
      "..cfffffcc..",
      "...cfffcc...",
      "....cccc....",
      "..c....c....",
      "..f....f....",
    ],
  },
};

export const PAL_IDS = Object.keys(PALS);
