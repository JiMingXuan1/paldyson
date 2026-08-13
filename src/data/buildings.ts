// Building definitions.

import type { NodeKind } from "../types";

export interface RecipeDef {
  id: string;
  name: string;
  inputs: Record<string, number>;
  outputs: Record<string, number>;
  time: number; // seconds per craft
  tech?: string;
}

export interface BuildingDef {
  id: string;
  name: string;
  desc: string;
  icon: string;
  cost: Record<string, number>;
  tech?: string;
  cat: "power" | "production" | "logistics" | "research" | "pal" | "special";
  powerGen?: number; // wind turbine / coal generator
  powerUse?: number;
  fuel?: { item: string; burnS: number; power: number }; // coal generator
  recipes?: string[]; // selectable recipes (furnace / assembler)
  fixedRecipe?: string; // always-on recipe (research lab)
  requiresNode?: NodeKind[]; // mining drill placement
  bufferCap?: number;
  consumesDyson?: boolean; // dyson core
  hotbar?: boolean; // appears in build hotbar
}

export const RECIPES: Record<string, RecipeDef> = {
  smelt_iron: {
    id: "smelt_iron",
    name: "冶炼铁锭",
    inputs: { iron_ore: 1 },
    outputs: { iron_ingot: 1 },
    time: 4,
  },
  gear: {
    id: "gear",
    name: "加工齿轮",
    inputs: { iron_ingot: 2 },
    outputs: { gear: 1 },
    time: 3,
  },
  circuit: {
    id: "circuit",
    name: "制造电路板",
    inputs: { iron_ingot: 1, coal: 1 },
    outputs: { circuit: 1 },
    time: 4,
  },
  red_science: {
    id: "red_science",
    name: "合成科技瓶",
    inputs: { iron_ore: 1, coal: 1 },
    outputs: { red_science: 1 },
    time: 3,
  },
  pal_sphere: {
    id: "pal_sphere",
    name: "制造帕鲁球",
    inputs: { stone: 2, iron_ingot: 1 },
    outputs: { pal_sphere: 1 },
    time: 4,
    tech: "t_pals",
  },
  dyson_component: {
    id: "dyson_component",
    name: "组装戴森组件",
    inputs: { circuit: 2, gear: 2, iron_ingot: 1 },
    outputs: { dyson_component: 1 },
    time: 12,
    tech: "t_dyson",
  },
};

export const BUILDINGS: Record<string, BuildingDef> = {
  wind_turbine: {
    id: "wind_turbine",
    name: "风力发电机",
    desc: "利用风能发电，功率随风力波动。",
    icon: "🌀",
    cost: { wood: 4, stone: 2 },
    cat: "power",
    powerGen: 20,
  },
  coal_generator: {
    id: "coal_generator",
    name: "燃煤发电机",
    desc: "燃烧煤炭稳定供电，功率强劲。",
    icon: "⚡",
    cost: { stone: 8, wood: 4 },
    tech: "t_power",
    cat: "power",
    powerGen: 60,
    fuel: { item: "coal", burnS: 6, power: 60 },
    bufferCap: 10,
  },
  mining_drill: {
    id: "mining_drill",
    name: "采矿机",
    desc: "放置在矿脉上自动开采，需电力。",
    icon: "⛏️",
    cost: { wood: 8, stone: 4 },
    cat: "production",
    powerUse: 12,
    requiresNode: ["iron", "coal"],
    bufferCap: 10,
  },
  furnace: {
    id: "furnace",
    name: "熔炉",
    desc: "将铁矿石冶炼成铁锭。",
    icon: "♨️",
    cost: { stone: 8, wood: 4 },
    tech: "t_metallurgy",
    cat: "production",
    powerUse: 15,
    recipes: ["smelt_iron"],
    bufferCap: 10,
  },
  assembler: {
    id: "assembler",
    name: "组装机",
    desc: "自动化生产零件与设备。",
    icon: "🏭",
    cost: { wood: 10, stone: 6 },
    tech: "t_assembly",
    cat: "production",
    powerUse: 25,
    recipes: ["gear", "circuit", "pal_sphere", "dyson_component"],
    bufferCap: 12,
  },
  research_lab: {
    id: "research_lab",
    name: "研究所",
    desc: "将矿石与煤炭合成红色科技瓶，并推进科技研究。",
    icon: "🧪",
    cost: { wood: 8, stone: 4 },
    cat: "research",
    powerUse: 15,
    fixedRecipe: "red_science",
    bufferCap: 10,
  },
  belt: {
    id: "belt",
    name: "传送带",
    desc: "自动输送物品到相邻建筑。Q/E 旋转方向。",
    icon: "➡️",
    cost: { wood: 1, stone: 1 },
    tech: "t_logistics",
    cat: "logistics",
  },
  chest: {
    id: "chest",
    name: "储物箱",
    desc: "存放物品，作为物流缓冲。",
    icon: "📦",
    cost: { wood: 4 },
    cat: "logistics",
    bufferCap: 80,
  },
  pal_terminal: {
    id: "pal_terminal",
    name: "帕鲁终端",
    desc: "存放与调度已捕获的帕鲁。",
    icon: "🟣",
    cost: { wood: 12, stone: 8 },
    tech: "t_pals",
    cat: "pal",
  },
  dyson_core: {
    id: "dyson_core",
    name: "戴森环核心",
    desc: "终极目标：投入戴森组件，点亮属于你的戴森环。",
    icon: "🪐",
    cost: { stone: 30, wood: 20, circuit: 10 },
    tech: "t_dyson",
    cat: "special",
    consumesDyson: true,
    bufferCap: 10,
  },
};

export const HOTBAR_ORDER = [
  "wind_turbine",
  "mining_drill",
  "furnace",
  "assembler",
  "research_lab",
  "belt",
  "chest",
  "coal_generator",
  "pal_terminal",
  "dyson_core",
];
