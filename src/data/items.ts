// Item definitions.

export interface ItemDef {
  id: string;
  name: string;
  color: string; // CSS color for UI chips / belt items
  cat: "resource" | "material" | "science" | "tool" | "pal";
  desc: string;
}

export const ITEMS: Record<string, ItemDef> = {
  wood: { id: "wood", name: "木材", color: "#b07a3e", cat: "resource", desc: "砍树获得的基础材料。" },
  stone: { id: "stone", name: "石块", color: "#9aa0a8", cat: "resource", desc: "敲石头获得的基础材料。" },
  iron_ore: { id: "iron_ore", name: "铁矿石", color: "#c98a5a", cat: "resource", desc: "铁矿脉产出，可冶炼成铁锭。" },
  coal: { id: "coal", name: "煤炭", color: "#3a3d44", cat: "resource", desc: "煤矿脉产出，燃料与原料。" },
  berries: { id: "berries", name: "浆果", color: "#e05a7a", cat: "resource", desc: "浆果丛产出，帕鲁的口粮。" },
  iron_ingot: { id: "iron_ingot", name: "铁锭", color: "#cfd6e0", cat: "material", desc: "熔炉冶炼铁矿石所得。" },
  gear: { id: "gear", name: "齿轮", color: "#8fa3b8", cat: "material", desc: "组装机生产的基础零件。" },
  circuit: { id: "circuit", name: "电路板", color: "#5ec26a", cat: "material", desc: "自动化设备的核心元件。" },
  red_science: { id: "red_science", name: "红色科技瓶", color: "#e04848", cat: "science", desc: "研究所合成，用于解锁科技。" },
  pal_sphere: { id: "pal_sphere", name: "帕鲁球", color: "#ff9ad5", cat: "tool", desc: "投掷以捕获野生帕鲁。" },
  dyson_component: { id: "dyson_component", name: "戴森组件", color: "#ffd24a", cat: "material", desc: "构筑戴森环的核心部件。" },
  pal_sprout: { id: "pal_sprout", name: "芽芽兽", color: "#7ec850", cat: "pal", desc: "热爱自然的草系帕鲁。擅长科研与采集。" },
  pal_rock: { id: "pal_rock", name: "岩岩兽", color: "#b08d6a", cat: "pal", desc: "坚如磐石的岩系帕鲁。采矿好手。" },
  pal_ember: { id: "pal_ember", name: "火苗鸟", color: "#ff7a3c", cat: "pal", desc: "热情的火系帕鲁。冶炼与发电专家。" },
  pal_volt: { id: "pal_volt", name: "雷雷鼠", color: "#ffd23c", cat: "pal", desc: "浑身带电的雷系帕鲁。装配与发电专家。" },
  pal_aqua: { id: "pal_aqua", name: "泡泡鱼", color: "#5ab8ff", cat: "pal", desc: "温柔的水系帕鲁。科研与物流帮手。" },
};

export const ITEM_IDS = Object.keys(ITEMS);

export function itemName(id: string): string {
  return ITEMS[id]?.name ?? id;
}

export function itemColor(id: string): string {
  return ITEMS[id]?.color ?? "#888";
}
