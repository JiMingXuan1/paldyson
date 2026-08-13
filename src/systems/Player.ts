// Player: movement, sprite, and the follower pal.

import Phaser from "phaser";
import type { World } from "./World";
import type { PalInst } from "../types";
import { PLAYER_SPEED } from "../config";

export class Player {
  sprite!: Phaser.Physics.Arcade.Sprite;
  shadow!: Phaser.GameObjects.Image;
  follower!: Phaser.GameObjects.Image | null;
  followerShadow!: Phaser.GameObjects.Image | null;
  private facing = 2; // last move dir (for flip)

  constructor(
    private scene: Phaser.Scene,
    private world: World,
  ) {}

  create(): void {
    const { x, y } = this.world.state.player;
    this.shadow = this.scene.add.image(x, y + 8, "shadow").setDepth(5);
    this.sprite = this.scene.physics.add.sprite(x, y, "player").setDepth(6);
    this.sprite.setCollideWorldBounds(true);
    this.follower = null;
    this.followerShadow = null;
  }

  get gatherBoost(): number {
    return this.follower ? 2 : 1;
  }

  setFollower(pal: PalInst | null): void {
    if (this.follower) {
      this.follower.destroy();
      this.follower = null;
    }
    if (this.followerShadow) {
      this.followerShadow.destroy();
      this.followerShadow = null;
    }
    if (pal) {
      this.follower = this.scene.add.image(0, 0, `pal_${pal.type}`).setDepth(7);
      this.followerShadow = this.scene.add.image(0, 0, "shadow").setDepth(5).setScale(0.7);
    }
  }

  update(_dt: number, ax: number, ay: number): void {
    const vx = ax * PLAYER_SPEED;
    const vy = ay * PLAYER_SPEED;
    this.sprite.setVelocity(vx, vy);
    if (ax !== 0 || ay !== 0) {
      this.facing = ax > 0 ? 1 : ax < 0 ? 3 : ay > 0 ? 2 : 0;
    }
    this.sprite.setFlipX(this.facing === 1);
    this.shadow.setPosition(this.sprite.x, this.sprite.y + 10);

    // Follower pal trails behind.
    if (this.follower && this.followerShadow) {
      const fx = this.sprite.x - ax * 22;
      const fy = this.sprite.y - ay * 22 + 6;
      this.follower.setPosition(fx, fy);
      this.follower.setFlipX(ax < 0);
      this.followerShadow.setPosition(fx, fy + 14);
    }

    this.world.state.player.x = this.sprite.x;
    this.world.state.player.y = this.sprite.y;
  }
}
