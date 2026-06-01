import Phaser from 'phaser';
import { completeMission, markSportPlayed } from '../../progress/progressManager';
import { BOCCIA_CONFIG, BOCCIA_PLACEHOLDERS } from '../sports/boccia/bocciaConfig';

interface BallVisual {
  x: number;
  y: number;
  color: number;
  label: string;
}

export class BocciaScene extends Phaser.Scene {
  constructor() {
    super('BocciaScene');
  }

  create() {
    markSportPlayed('boccia');
    completeMission('boccia_shell_visit');

    this.cameras.main.setBackgroundColor('#101827');
    this.drawSceneFoundation();
  }

  private drawSceneFoundation(): void {
    const { width } = this.scale;
    const courtX = (width - BOCCIA_CONFIG.court.width) / 2;
    const courtY = 72;
    const graphics = this.add.graphics();

    this.add
      .text(width / 2, 26, 'Boccia Scene Foundation', {
        color: '#f8fafc',
        fontFamily: 'Arial, sans-serif',
        fontSize: '24px',
        fontStyle: '700',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, 52, `${BOCCIA_PLACEHOLDERS.objective} ${BOCCIA_PLACEHOLDERS.note}`, {
        color: '#bae6fd',
        fontFamily: 'Arial, sans-serif',
        fontSize: '13px',
      })
      .setOrigin(0.5);

    this.drawCourt(graphics, courtX, courtY);
    this.drawBalls(courtX, courtY);
    this.drawAimLine(graphics, courtX, courtY);
    this.drawPowerMeter(graphics, courtX, courtY);
    this.drawHudLabels(courtX, courtY);
  }

  private drawCourt(graphics: Phaser.GameObjects.Graphics, courtX: number, courtY: number): void {
    const { court, throwingArea } = BOCCIA_CONFIG;

    graphics.fillStyle(court.color, 1);
    graphics.fillRoundedRect(courtX, courtY, court.width, court.height, 14);
    graphics.lineStyle(3, court.borderColor, 1);
    graphics.strokeRoundedRect(courtX, courtY, court.width, court.height, 14);

    graphics.fillStyle(throwingArea.color, 0.74);
    graphics.fillRect(courtX, courtY, throwingArea.width, court.height);
    graphics.lineStyle(2, throwingArea.accentColor, 0.95);
    graphics.strokeRect(courtX, courtY, throwingArea.width, court.height);

    const laneHeight = court.height / 3;
    graphics.lineStyle(1, court.lineColor, 0.35);
    for (let lane = 1; lane < 3; lane += 1) {
      const y = courtY + laneHeight * lane;
      graphics.lineBetween(courtX, y, courtX + throwingArea.width, y);
    }

    graphics.lineStyle(2, court.lineColor, 0.55);
    graphics.lineBetween(courtX + throwingArea.width, courtY, courtX + throwingArea.width, courtY + court.height);
    graphics.lineBetween(courtX + court.width / 2, courtY, courtX + court.width / 2, courtY + court.height);

    this.addLabel('Throw area', courtX + throwingArea.width / 2, courtY + 18, '#fde68a');
    this.addLabel('Static top-down court', courtX + court.width / 2, courtY + court.height + 18, '#cbd5e1');
  }

  private drawBalls(courtX: number, courtY: number): void {
    const { court, balls } = BOCCIA_CONFIG;
    const centerY = courtY + court.height / 2;
    const ballVisuals: BallVisual[] = [
      {
        x: courtX + court.width * 0.63,
        y: centerY - 12,
        color: balls.jackColor,
        label: 'Jack',
      },
      {
        x: courtX + 58,
        y: centerY - 46,
        color: balls.playerColor,
        label: 'P1',
      },
      {
        x: courtX + 58,
        y: centerY,
        color: balls.playerColor,
        label: 'P2',
      },
      {
        x: courtX + 58,
        y: centerY + 46,
        color: balls.playerColor,
        label: 'P3',
      },
      {
        x: courtX + court.width * 0.78,
        y: centerY - 52,
        color: balls.opponentColor,
        label: 'O1',
      },
      {
        x: courtX + court.width * 0.84,
        y: centerY + 4,
        color: balls.opponentColor,
        label: 'O2',
      },
      {
        x: courtX + court.width * 0.73,
        y: centerY + 58,
        color: balls.opponentColor,
        label: 'O3',
      },
    ];

    ballVisuals.forEach((ball) => {
      const radius = ball.label === 'Jack' ? balls.jackRadius : balls.ballRadius;
      this.add.circle(ball.x, ball.y, radius + 2, balls.strokeColor, 0.45);
      this.add.circle(ball.x, ball.y, radius, ball.color, 1).setStrokeStyle(2, balls.strokeColor, 0.7);
      this.addLabel(ball.label, ball.x, ball.y + radius + 13, '#e5edf8');
    });
  }

  private drawAimLine(graphics: Phaser.GameObjects.Graphics, courtX: number, courtY: number): void {
    const { court, throwingArea, aimLine } = BOCCIA_CONFIG;
    const startX = courtX + throwingArea.width - 16;
    const startY = courtY + court.height / 2;
    const endX = courtX + court.width * 0.58;
    const endY = courtY + court.height / 2 - 10;

    graphics.lineStyle(3, aimLine.color, 0.75);
    graphics.lineBetween(startX, startY, endX, endY);
    graphics.fillStyle(aimLine.color, 0.9);
    graphics.fillTriangle(endX, endY, endX - 12, endY - 6, endX - 10, endY + 8);
    this.addLabel('Aim line placeholder', (startX + endX) / 2, startY - 24, '#fde68a');
  }

  private drawPowerMeter(graphics: Phaser.GameObjects.Graphics, courtX: number, courtY: number): void {
    const { court, powerMeter } = BOCCIA_CONFIG;
    const x = courtX + court.width - powerMeter.width - 18;
    const y = courtY + court.height + 34;

    graphics.fillStyle(powerMeter.trackColor, 1);
    graphics.fillRoundedRect(x, y, powerMeter.width, powerMeter.height, 7);
    graphics.fillStyle(powerMeter.fillColor, 0.55);
    graphics.fillRoundedRect(x, y, powerMeter.width * 0.42, powerMeter.height, 7);
    graphics.lineStyle(2, 0xdbeafe, 0.65);
    graphics.strokeRoundedRect(x, y, powerMeter.width, powerMeter.height, 7);
    this.addLabel('Power meter placeholder', x + powerMeter.width / 2, y + 30, '#bae6fd');
  }

  private drawHudLabels(courtX: number, courtY: number): void {
    const hudX = courtX + 18;
    const hudY = courtY + BOCCIA_CONFIG.court.height + 30;

    this.add
      .text(hudX, hudY, `Round: ${BOCCIA_PLACEHOLDERS.round}`, this.hudTextStyle('#f8fafc'))
      .setOrigin(0, 0.5);
    this.add
      .text(hudX, hudY + 22, `Balls: ${BOCCIA_PLACEHOLDERS.balls}`, this.hudTextStyle('#f8fafc'))
      .setOrigin(0, 0.5);
    this.add
      .text(hudX, hudY + 44, `Current phase: ${BOCCIA_PLACEHOLDERS.phase}`, this.hudTextStyle('#7dd3fc'))
      .setOrigin(0, 0.5);
  }

  private addLabel(text: string, x: number, y: number, color: string): Phaser.GameObjects.Text {
    return this.add
      .text(x, y, text, {
        color,
        fontFamily: 'Arial, sans-serif',
        fontSize: '12px',
        fontStyle: '700',
      })
      .setOrigin(0.5);
  }

  private hudTextStyle(color: string): Phaser.Types.GameObjects.Text.TextStyle {
    return {
      color,
      fontFamily: 'Arial, sans-serif',
      fontSize: '13px',
      fontStyle: '700',
    };
  }
}
