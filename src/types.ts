// Shared type definitions for the game world (all serializable).

export type Dir = 0 | 1 | 2 | 3;

export type NodeKind = "tree" | "rock" | "iron" | "coal" | "berry";

export interface NodeState {
  kind: NodeKind;
  remaining: number;
  max: number;
}

export interface ItemStack {
  id: string;
  n: number;
}

export interface BeltItem {
  uid: number; // stable instance id (sprite keying)
  id: string;
  pos: number; // 0..1 along the belt
}

export interface BeltInst {
  uid: number;
  x: number;
  y: number;
  dir: Dir;
  items: BeltItem[];
}

export type PalJob =
  | { kind: "none" }
  | { kind: "follow" }
  | { kind: "building"; targetUid: number };

export interface PalInst {
  uid: number;
  type: string; // pal type id
  name: string;
  hunger: number; // 0..100 (100 = full)
  mood: number; // 0..100
  job: PalJob;
}

export interface BuildingInst {
  uid: number;
  id: string; // building def id
  x: number;
  y: number;
  dir: Dir;
  inB: ItemStack[]; // input buffer
  outB: ItemStack[]; // output buffer
  recipeId: string | null; // selected recipe for producers
  progress: number; // 0..1 current production progress
  prodCount: number; // total items produced (stat)
  fuel: number; // coal generator remaining burn time (s)
  palUid: number | null; // assigned pal
}

export interface ResearchState {
  researched: string[];
  current: string | null;
  progress: number; // 0..1
  redAcc: number; // fractional bottle accumulator for research rate
}

export interface WorldState {
  version: number;
  seed: number;
  time: number; // seconds elapsed
  nodes: Record<string, NodeState>; // key "x,y"
  player: { x: number; y: number };
  inventory: Record<string, number>;
  buildings: BuildingInst[];
  belts: BeltInst[];
  pals: PalInst[];
  research: ResearchState;
  nextUid: number;
  stats: { captures: number; built: number; itemsProduced: number; dysonFed: number };
}
