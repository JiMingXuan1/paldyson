// Research tech tree definitions.

export interface TechDef {
  id: string;
  name: string;
  desc: string;
  cost: number; // red science bottles consumed at labs
  requires?: string[];
  unlocks: string[]; // building ids / recipe ids unlocked
  icon: string; // emoji for UI
}

export const TECHS: Record<string, TechDef> = {
  t_metallurgy: {
    id: "t_metallurgy",
    name: "冶金学",
    desc: "解锁熔炉，可将铁矿石冶炼为铁锭。",
    cost: 1,
    unlocks: ["furnace"],
    icon: "🔥",
  },
  t_assembly: {
    id: "t_assembly",
    name: "自动化生产",
    desc: "解锁组装机，自动化生产齿轮与电路板。",
    cost: 3,
    requires: ["t_metallurgy"],
    unlocks: ["assembler", "recipe:gear", "recipe:circuit"],
    icon: "⚙️",
  },
  t_logistics: {
    id: "t_logistics",
    name: "物流网络",
    desc: "解锁传送带，让物品在工厂间自动流转。",
    cost: 4,
    requires: ["t_assembly"],
    unlocks: ["belt"],
    icon: "🔗",
  },
  t_pals: {
    id: "t_pals",
    name: "帕鲁驯化",
    desc: "解锁帕鲁球与帕鲁终端，捕获并雇佣帕鲁为你工作。",
    cost: 4,
    requires: ["t_assembly"],
    unlocks: ["pal_terminal", "recipe:pal_sphere"],
    icon: "🟣",
  },
  t_power: {
    id: "t_power",
    name: "燃煤发电",
    desc: "解锁燃煤发电机，提供稳定的大功率电力。",
    cost: 6,
    requires: ["t_metallurgy"],
    unlocks: ["coal_generator"],
    icon: "⚡",
  },
  t_dyson: {
    id: "t_dyson",
    name: "戴森工程",
    desc: "终极科技：解锁戴森组件与戴森环核心。",
    cost: 12,
    requires: ["t_logistics", "t_pals"],
    unlocks: ["dyson_core", "recipe:dyson_component"],
    icon: "🪐",
  },
};

export const TECH_ORDER = [
  "t_metallurgy",
  "t_assembly",
  "t_logistics",
  "t_pals",
  "t_power",
  "t_dyson",
];
