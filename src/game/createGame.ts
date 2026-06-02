import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { BocciaScene } from './scenes/BocciaScene';
import { TchoukballScene } from './scenes/TchoukballScene';

export function createGame(parent: HTMLElement): Phaser.Game {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: 720,
    height: 400,
    backgroundColor: '#101827',
    scene: [BootScene, BocciaScene, TchoukballScene],
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
  });

  window.addEventListener('sport-preview:show', (event) => {
    const sportId = (event as CustomEvent<{ sportId: string }>).detail?.sportId;

    if (sportId === 'tchoukball') {
      game.scene.stop('BocciaScene');
      game.scene.start('TchoukballScene');
      return;
    }

    if (sportId === 'boccia') {
      game.scene.stop('TchoukballScene');
      game.scene.start('BocciaScene');
    }
  });

  return game;
}
