import Phaser from 'phaser';
import {
  BALL_RADIUS,
  COURT_HEIGHT,
  COURT_WIDTH,
  FRAME_SIZE,
  PLAYER_COLORS,
  ZONE_COLORS,
} from '../sports/tchoukball/tchoukballConfig';

function color(hex: string): number {
  return Phaser.Display.Color.HexStringToColor(hex).color;
}

export class TchoukballScene extends Phaser.Scene {
  constructor() {
    super('TchoukballScene');
  }

  create(): void {
    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2 + 10;
    const courtX = centerX - COURT_WIDTH / 2;
    const courtY = centerY - COURT_HEIGHT / 2;
    const graphics = this.add.graphics();

    graphics.fillStyle(color(ZONE_COLORS.court), 1);
    graphics.fillRoundedRect(courtX, courtY, COURT_WIDTH, COURT_HEIGHT, 18);
    graphics.lineStyle(4, color(ZONE_COLORS.courtLine), 0.95);
    graphics.strokeRoundedRect(courtX, courtY, COURT_WIDTH, COURT_HEIGHT, 18);

    graphics.lineStyle(2, color(ZONE_COLORS.centerLine), 0.7);
    graphics.beginPath();
    graphics.moveTo(centerX, courtY + 16);
    graphics.lineTo(centerX, courtY + COURT_HEIGHT - 16);
    graphics.strokePath();

    this.drawForbiddenZone(graphics, courtX + 82, centerY, 'left');
    this.drawForbiddenZone(graphics, courtX + COURT_WIDTH - 82, centerY, 'right');
    this.drawFrame(courtX + 34, centerY, 'left');
    this.drawFrame(courtX + COURT_WIDTH - 34, centerY, 'right');
    this.drawPlayers(courtX, courtY);
    this.drawBall(centerX, centerY - 42);
    this.drawLabels(courtX, courtY, centerX, centerY);
  }

  private drawForbiddenZone(graphics: Phaser.GameObjects.Graphics, x: number, y: number, side: 'left' | 'right'): void {
    const startAngle = side === 'left' ? -70 : 110;
    const endAngle = side === 'left' ? 70 : 250;

    graphics.fillStyle(color('#fb7185'), 0.28);
    graphics.lineStyle(3, color(ZONE_COLORS.forbiddenZoneLine), 0.82);
    graphics.beginPath();
    graphics.moveTo(x, y);
    graphics.arc(x, y, 74, Phaser.Math.DegToRad(startAngle), Phaser.Math.DegToRad(endAngle));
    graphics.closePath();
    graphics.fillPath();
    graphics.strokePath();
  }

  private drawFrame(x: number, y: number, side: 'left' | 'right'): void {
    const rotation = side === 'left' ? Phaser.Math.DegToRad(12) : Phaser.Math.DegToRad(-12);
    const frame = this.add.rectangle(x, y, FRAME_SIZE, FRAME_SIZE + 22, color(ZONE_COLORS.frameFace), 1);
    frame.setStrokeStyle(5, color(ZONE_COLORS.frame), 1);
    frame.setRotation(rotation);

    const net = this.add.rectangle(x, y, FRAME_SIZE - 18, FRAME_SIZE + 4, color('#bae6fd'), 0.34);
    net.setStrokeStyle(2, color('#7dd3fc'), 0.85);
    net.setRotation(rotation);
  }

  private drawPlayers(courtX: number, courtY: number): void {
    const leftPositions = [
      { x: courtX + 190, y: courtY + 94 },
      { x: courtX + 244, y: courtY + 160 },
      { x: courtX + 190, y: courtY + 226 },
    ];
    const rightPositions = [
      { x: courtX + COURT_WIDTH - 190, y: courtY + 94 },
      { x: courtX + COURT_WIDTH - 244, y: courtY + 160 },
      { x: courtX + COURT_WIDTH - 190, y: courtY + 226 },
    ];

    leftPositions.forEach((position, index) => this.drawPlayer(position.x, position.y, color(PLAYER_COLORS.gold), `A${index + 1}`));
    rightPositions.forEach((position, index) => this.drawPlayer(position.x, position.y, color(PLAYER_COLORS.sky), `B${index + 1}`));
  }

  private drawPlayer(x: number, y: number, fill: number, label: string): void {
    this.add.circle(x + 4, y + 5, 16, 0x020617, 0.28);
    this.add.circle(x, y, 16, fill, 1).setStrokeStyle(3, color(PLAYER_COLORS.neutral), 0.9);
    this.add.text(x, y, label, {
      color: '#07111f',
      fontFamily: 'Inter, sans-serif',
      fontSize: '12px',
      fontStyle: 'bold',
    }).setOrigin(0.5);
  }

  private drawBall(x: number, y: number): void {
    this.add.circle(x + 3, y + 4, BALL_RADIUS, 0x020617, 0.35);
    this.add.circle(x, y, BALL_RADIUS, color(ZONE_COLORS.ball), 1).setStrokeStyle(2, 0xffedd5, 1);
    this.add.text(x + 20, y - 18, 'Ball marker', {
      color: '#fed7aa',
      fontFamily: 'Inter, sans-serif',
      fontSize: '13px',
      fontStyle: 'bold',
    });
  }

  private drawLabels(courtX: number, courtY: number, centerX: number, centerY: number): void {
    this.add.text(centerX, 24, 'Tchoukball foundation preview', {
      align: 'center',
      color: '#f8fafc',
      fontFamily: 'Inter, sans-serif',
      fontSize: '24px',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(centerX, 52, 'Court + rebound frames + forbidden zones — no scoring yet', {
      align: 'center',
      color: '#bae6fd',
      fontFamily: 'Inter, sans-serif',
      fontSize: '14px',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(courtX + 28, courtY + 12, 'Rebound frame', this.labelStyle()).setOrigin(0, 0);
    this.add.text(courtX + COURT_WIDTH - 28, courtY + 12, 'Rebound frame', this.labelStyle()).setOrigin(1, 0);
    this.add.text(courtX + 92, centerY + 86, 'Forbidden zone', this.zoneLabelStyle()).setOrigin(0.5);
    this.add.text(courtX + COURT_WIDTH - 92, centerY + 86, 'Forbidden zone', this.zoneLabelStyle()).setOrigin(0.5);
    this.add.text(centerX, courtY + COURT_HEIGHT - 28, 'Player markers show sides only. Throwing/catching arrives later.', this.labelStyle()).setOrigin(0.5);
  }

  private labelStyle(): Phaser.Types.GameObjects.Text.TextStyle {
    return {
      color: '#dffcf7',
      fontFamily: 'Inter, sans-serif',
      fontSize: '13px',
      fontStyle: 'bold',
    };
  }

  private zoneLabelStyle(): Phaser.Types.GameObjects.Text.TextStyle {
    return {
      color: '#ffe4e6',
      fontFamily: 'Inter, sans-serif',
      fontSize: '12px',
      fontStyle: 'bold',
    };
  }
}
