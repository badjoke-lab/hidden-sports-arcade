import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create() {
    const { width, height } = this.scale;

    this.cameras.main.setBackgroundColor('#101827');

    this.add
      .rectangle(width / 2, height / 2, width - 48, height - 48, 0x17243a)
      .setStrokeStyle(2, 0x38bdf8, 0.75);

    this.add.circle(width / 2, height / 2 + 48, 32, 0xfacc15, 0.95);

    this.add
      .text(width / 2, height / 2 - 28, 'Game shell ready', {
        color: '#f8fafc',
        fontFamily: 'Arial, sans-serif',
        fontSize: '28px',
        fontStyle: '700',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height / 2 + 96, 'Phaser initialized', {
        color: '#94a3b8',
        fontFamily: 'Arial, sans-serif',
        fontSize: '16px',
      })
      .setOrigin(0.5);
  }
}
