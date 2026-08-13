// Game entry point.

import Phaser from "phaser";
import "./ui/ui.css";
import { BootScene } from "./scenes/BootScene";
import { GameScene } from "./scenes/GameScene";
import { Sfx } from "./utils/sound";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "game-parent",
  backgroundColor: "#0b1020",
  pixelArt: true,
  roundPixels: true,
  antialias: false,
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: "arcade",
    arcade: { gravity: { x: 0, y: 0 }, debug: false },
  },
  scene: [BootScene, GameScene],
};

const game = new Phaser.Game(config);
void game;

// Unlock audio on first user gesture.
const unlock = () => {
  Sfx.unlock();
  document.removeEventListener("pointerdown", unlock);
  document.removeEventListener("keydown", unlock);
};
document.addEventListener("pointerdown", unlock);
document.addEventListener("keydown", unlock);
