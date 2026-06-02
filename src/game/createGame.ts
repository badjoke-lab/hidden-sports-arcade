import Phaser from 'phaser';
import { BocciaScene } from './scenes/BocciaScene';
import { TchoukballScene } from './scenes/TchoukballScene';

export type GameSport = 'boccia' | 'tchoukball';

export function createGame(parent: HTMLElement, sport: GameSport): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: 720,
    height: 400,
    backgroundColor: '#101827',
    scene: sport === 'tchoukball' ? [TchoukballScene] : [BocciaScene],
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
  });
}
