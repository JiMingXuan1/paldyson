// BootScene: generate all procedural textures, then start the game scene.

import Phaser from "phaser";
import { createAllTextures } from "../utils/textures";
import { TILE } from "../config";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  create(): void {
    createAllTextures(this);
    // Build the terrain tileset strip: grass0, grass1, grass2, water, rocky.
    const tiles = ["tile_grass", "tile_grass2", "tile_grass3", "tile_water", "tile_rocky"];
    const canvas = this.textures.createCanvas("terrain_tiles", tiles.length * TILE, TILE);
    if (canvas) {
      const ctx = canvas.getContext() as CanvasRenderingContext2D;
      tiles.forEach((key, i) => {
        const img = this.textures.get(key).getSourceImage() as HTMLCanvasElement;
        ctx.drawImage(img, i * TILE, 0);
      });
      canvas.refresh();
    }
    this.scene.start("game");
  }
}
