import Phaser from 'phaser';

import { BootScene } from '@/game/scenes/BootScene';
import { DeskScene, type DeskSceneData } from '@/game/scenes/DeskScene';
import { PreloadScene } from '@/game/scenes/PreloadScene';

/** Registry key holding the session every scene needs. */
export const DESK_DATA_KEY = 'deskData';

export function createGame(parent: HTMLElement, data: DeskSceneData): Phaser.Game {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#e9e2d3',
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.NO_CENTER,
      width: parent.clientWidth || 1280,
      height: parent.clientHeight || 720,
    },
    scene: [BootScene, PreloadScene, DeskScene],
    render: { antialias: true },
    // No network, no analytics, no third-party service reaches the game runtime.
    banner: false,
  });

  // The registry exists as soon as the Game is constructed, and every scene can
  // read it however it was started. Passing the session through `scene.start`
  // alone is not enough: Phaser's own boot queue starts scenes with no data.
  game.registry.set(DESK_DATA_KEY, data);

  return game;
}
