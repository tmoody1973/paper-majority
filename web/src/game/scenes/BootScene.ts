import Phaser from 'phaser';

/** Minimum configuration only. Nothing here may reach the network. */
export class BootScene extends Phaser.Scene {
  static readonly KEY = 'Boot';

  constructor() {
    super(BootScene.KEY);
  }

  create(): void {
    this.scene.start('Preload');
  }
}
