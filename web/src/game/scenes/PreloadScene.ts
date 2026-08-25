import Phaser from 'phaser';

/**
 * Loads the small set of local assets the spike needs.
 *
 * The spike draws its cards with Phaser primitives, so the only asset is the
 * labelled fallback used when a referenced illustration is unavailable. Loading it
 * here proves the fallback path exists before the desk opens.
 */
export class PreloadScene extends Phaser.Scene {
  static readonly KEY = 'Preload';

  constructor() {
    super(PreloadScene.KEY);
  }

  preload(): void {
    this.load.svg('fallback-card', '/assets/cards/fallback-card.svg');
    // A missing asset must never break the desk.
    this.load.on('loaderror', () => undefined);
  }

  create(): void {
    this.scene.start('Desk');
  }
}
