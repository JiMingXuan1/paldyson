// Global gameplay constants.

export const TILE = 48; // world pixels per tile
export const MAP_W = 96;
export const MAP_H = 96;

// Player
export const PLAYER_SPEED = 220; // px/s
export const GATHER_RANGE_TILES = 1.6;
export const GATHER_INTERVAL_MS = 380;
export const INTERACT_RANGE_TILES = 1.8;
export const SPHERE_RANGE_TILES = 8;
export const SPHERE_SPEED = 620; // px/s

// Day / night (seconds per full cycle)
export const DAY_LENGTH = 240;

// Belts
export const BELT_TICK_MS = 100;
export const BELT_ITEM_SPEED = 0.09; // tile fraction per tick

// Power
export const WIND_BASE = 20;
export const WIND_MIN = 0.55;
export const WIND_MAX = 1.45;

// Production tick (buildings update every N ms)
export const PROD_TICK_MS = 250;

// Save
export const AUTOSAVE_MS = 20000;
export const SAVE_KEY = "paldyson_save_v1";

// Pal behaviour
export const PAL_HUNGER_DRAIN_S = 25; // seconds per berry-equivalent
export const PAL_MOOD_DRAIN_S = 12; // working mood drain per second
export const PAL_FEED_MOOD = 35;
export const PAL_BOOST_MATCH = 2.0;
export const PAL_BOOST_OTHER = 1.2;
export const WILD_PAL_SPAWN_N = 14;

// Capture
export const CAPTURE_CHANCE = { common: 0.72, rare: 0.5, epic: 0.34 };

// Dyson endgame
export const DYSON_NEEDED = 10;

export const DIRS = [
  { x: 0, y: -1 }, // 0 N
  { x: 1, y: 0 }, // 1 E
  { x: 0, y: 1 }, // 2 S
  { x: -1, y: 0 }, // 3 W
] as const;
