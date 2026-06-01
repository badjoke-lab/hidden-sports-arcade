import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { BocciaScene } from './scenes/BocciaScene';

export function createGame(parent: HTMLElement): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: 720,
    height: 400,
    backgroundColor: '#101827',
    scene: [BootScene, BocciaScene],
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
  });
}
