import Phaser from 'phaser';
import { audioManager } from '../../audio/audioManager';
import { inputManager } from '../../input/inputManager';
import type { InputState } from '../../input/types';
import { completeMission, markSportPlayed } from '../../progress/progressManager';
import { BOCCIA_CONFIG, BOCCIA_PLACEHOLDERS } from '../sports/boccia/bocciaConfig';

type BocciaPhase = 'aiming' | 'charging' | 'rolling' | 'stopped';

interface BocciaBallState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  isThrown: boolean;
}

interface BallVisual {
  x: number;
  y: number;
  color: number;
  label: string;
}

const phaseLabels: Record<BocciaPhase, string> = {
  aiming: 'Aiming',
  charging: 'Charging',
  rolling: 'Rolling',
  stopped: 'Stopped',
};

const aimLimits = {
  min: Phaser.Math.DegToRad(-35),
  max: Phaser.Math.DegToRad(35),
} as const;

const aimRotateSpeed = Phaser.Math.DegToRad(72);
const aimLineLength = 230;
const chargeSpeed = 0.85;
const minThrowSpeed = 130;
const maxThrowSpeed = 520;
const frictionPerSixtyFpsFrame = 0.985;
const stopSpeed = 14;

export class BocciaScene extends Phaser.Scene {
  private courtBounds = new Phaser.Geom.Rectangle(0, 0, 0, 0);

  private phase: BocciaPhase = 'aiming';

  private aimAngle = Phaser.Math.DegToRad(-5);

  private power = 0;

  private powerDirection: 1 | -1 = 1;

  private previousPrimary = false;

  private playerBall: BocciaBallState = {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    isThrown: false,
  };

  private aimGraphics?: Phaser.GameObjects.Graphics;

  private powerGraphics?: Phaser.GameObjects.Graphics;

  private playerBallShadow?: Phaser.GameObjects.Arc;

  private playerBallCircle?: Phaser.GameObjects.Arc;

  private playerBallLabel?: Phaser.GameObjects.Text;

  private phaseText?: Phaser.GameObjects.Text;

  private powerText?: Phaser.GameObjects.Text;

  private hintText?: Phaser.GameObjects.Text;

  constructor() {
    super('BocciaScene');
  }

  create() {
    markSportPlayed('boccia');
    completeMission('boccia_shell_visit');

    this.cameras.main.setBackgroundColor('#101827');
    this.drawSceneFoundation();
  }

  update(_: number, delta: number): void {
    const input = inputManager.getInputState();
    const deltaSeconds = Math.min(delta / 1000, 0.05);

    this.updateAim(input, deltaSeconds);
    this.updateCharge(input, deltaSeconds);
    this.updateBall(deltaSeconds);
    this.previousPrimary = input.primary;
  }

  private drawSceneFoundation(): void {
    const { width } = this.scale;
    const courtX = (width - BOCCIA_CONFIG.court.width) / 2;
    const courtY = 72;
    const staticGraphics = this.add.graphics();

    this.courtBounds.setTo(courtX, courtY, BOCCIA_CONFIG.court.width, BOCCIA_CONFIG.court.height);
    this.playerBall = {
      x: courtX + BOCCIA_CONFIG.throwingArea.width - 36,
      y: courtY + BOCCIA_CONFIG.court.height / 2,
      vx: 0,
      vy: 0,
      isThrown: false,
    };

    this.add
      .text(width / 2, 26, 'Boccia Throw Practice', {
        color: '#f8fafc',
        fontFamily: 'Arial, sans-serif',
        fontSize: '24px',
        fontStyle: '700',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, 52, `${BOCCIA_PLACEHOLDERS.objective} Aim, charge, and throw one player ball.`, {
        color: '#bae6fd',
        fontFamily: 'Arial, sans-serif',
        fontSize: '13px',
      })
      .setOrigin(0.5);

    this.drawCourt(staticGraphics, courtX, courtY);
    this.drawBalls(courtX, courtY);
    this.aimGraphics = this.add.graphics();
    this.powerGraphics = this.add.graphics();
    this.drawHudLabels(courtX, courtY);
    this.redrawAimLine();
    this.redrawPowerMeter();
    this.refreshHudLabels();
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
    this.addLabel('Top-down court', courtX + court.width / 2, courtY + court.height + 18, '#cbd5e1');
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

    this.playerBallShadow = this.add.circle(this.playerBall.x, this.playerBall.y, balls.ballRadius + 2, balls.strokeColor, 0.24);
    this.playerBallCircle = this.add
      .circle(this.playerBall.x, this.playerBall.y, balls.ballRadius, balls.playerColor, 1)
      .setStrokeStyle(2, balls.strokeColor, 0.9);
    this.playerBallLabel = this.addLabel('P1', this.playerBall.x, this.playerBall.y + balls.ballRadius + 13, '#e5edf8');
  }

  private redrawAimLine(): void {
    if (!this.aimGraphics || this.phase === 'rolling' || this.phase === 'stopped') {
      this.aimGraphics?.clear();
      return;
    }

    const { aimLine } = BOCCIA_CONFIG;
    const startX = this.playerBall.x;
    const startY = this.playerBall.y;
    const endX = startX + Math.cos(this.aimAngle) * aimLineLength;
    const endY = startY + Math.sin(this.aimAngle) * aimLineLength;
    const arrowAngle = this.aimAngle;

    this.aimGraphics.clear();
    this.aimGraphics.lineStyle(3, aimLine.color, 0.78);
    this.aimGraphics.lineBetween(startX, startY, endX, endY);
    this.aimGraphics.fillStyle(aimLine.color, 0.92);
    this.aimGraphics.fillTriangle(
      endX,
      endY,
      endX - Math.cos(arrowAngle - 0.38) * 16,
      endY - Math.sin(arrowAngle - 0.38) * 16,
      endX - Math.cos(arrowAngle + 0.38) * 16,
      endY - Math.sin(arrowAngle + 0.38) * 16,
    );
  }

  private redrawPowerMeter(): void {
    if (!this.powerGraphics) {
      return;
    }

    const { court, powerMeter } = BOCCIA_CONFIG;
    const x = this.courtBounds.x + court.width - powerMeter.width - 18;
    const y = this.courtBounds.y + court.height + 34;

    this.powerGraphics.clear();
    this.powerGraphics.fillStyle(powerMeter.trackColor, 1);
    this.powerGraphics.fillRoundedRect(x, y, powerMeter.width, powerMeter.height, 7);
    this.powerGraphics.fillStyle(powerMeter.fillColor, this.phase === 'charging' ? 0.95 : 0.62);
    this.powerGraphics.fillRoundedRect(x, y, powerMeter.width * this.power, powerMeter.height, 7);
    this.powerGraphics.lineStyle(2, 0xdbeafe, 0.65);
    this.powerGraphics.strokeRoundedRect(x, y, powerMeter.width, powerMeter.height, 7);
  }

  private drawHudLabels(courtX: number, courtY: number): void {
    const hudX = courtX + 18;
    const hudY = courtY + BOCCIA_CONFIG.court.height + 30;
    const powerMeter = BOCCIA_CONFIG.powerMeter;

    this.phaseText = this.add.text(hudX, hudY, '', {
      color: '#f8fafc',
      fontFamily: 'Arial, sans-serif',
      fontSize: '15px',
      fontStyle: '700',
    });

    this.powerText = this.add.text(courtX + BOCCIA_CONFIG.court.width - powerMeter.width - 18, hudY + 20, '', {
      color: '#bae6fd',
      fontFamily: 'Arial, sans-serif',
      fontSize: '13px',
    });

    this.hintText = this.add.text(hudX, hudY + 24, '', {
      color: '#cbd5e1',
      fontFamily: 'Arial, sans-serif',
      fontSize: '12px',
    });
  }

  private addLabel(text: string, x: number, y: number, color: string): Phaser.GameObjects.Text {
    return this.add
      .text(x, y, text, {
        color,
        fontFamily: 'Arial, sans-serif',
        fontSize: '11px',
      })
      .setOrigin(0.5);
  }

  private updateAim(input: InputState, deltaSeconds: number): void {
    if (this.phase !== 'aiming' && this.phase !== 'charging') {
      return;
    }

    const aimDirection = Number(input.aimRight) - Number(input.aimLeft);

    if (aimDirection === 0) {
      return;
    }

    this.aimAngle = Phaser.Math.Clamp(
      this.aimAngle + aimDirection * aimRotateSpeed * deltaSeconds,
      aimLimits.min,
      aimLimits.max,
    );
    this.redrawAimLine();
  }

  private updateCharge(input: InputState, deltaSeconds: number): void {
    if (this.phase !== 'aiming' && this.phase !== 'charging') {
      return;
    }

    if (input.primary) {
      if (!this.previousPrimary) {
        this.setPhase('charging');
      }

      this.power += this.powerDirection * chargeSpeed * deltaSeconds;

      if (this.power >= 1) {
        this.power = 1;
        this.powerDirection = -1;
      }

      if (this.power <= 0) {
        this.power = 0;
        this.powerDirection = 1;
      }

      this.redrawPowerMeter();
      this.refreshHudLabels();
      return;
    }

    if (this.previousPrimary && this.phase === 'charging') {
      this.throwBall();
    }
  }

  private throwBall(): void {
    const throwPower = Math.max(this.power, 0.08);
    const speed = Phaser.Math.Linear(minThrowSpeed, maxThrowSpeed, throwPower);

    this.playerBall.vx = Math.cos(this.aimAngle) * speed;
    this.playerBall.vy = Math.sin(this.aimAngle) * speed;
    this.playerBall.isThrown = true;
    this.setPhase('rolling');
    this.aimGraphics?.clear();
    audioManager.playSe('throw');
  }

  private updateBall(deltaSeconds: number): void {
    if (this.phase !== 'rolling') {
      return;
    }

    const radius = BOCCIA_CONFIG.balls.ballRadius;
    const friction = Math.pow(frictionPerSixtyFpsFrame, deltaSeconds * 60);

    this.playerBall.x += this.playerBall.vx * deltaSeconds;
    this.playerBall.y += this.playerBall.vy * deltaSeconds;
    this.playerBall.vx *= friction;
    this.playerBall.vy *= friction;

    if (this.playerBall.x < this.courtBounds.left + radius) {
      this.playerBall.x = this.courtBounds.left + radius;
      this.playerBall.vx = Math.abs(this.playerBall.vx) * 0.35;
    } else if (this.playerBall.x > this.courtBounds.right - radius) {
      this.playerBall.x = this.courtBounds.right - radius;
      this.playerBall.vx = -Math.abs(this.playerBall.vx) * 0.35;
    }

    if (this.playerBall.y < this.courtBounds.top + radius) {
      this.playerBall.y = this.courtBounds.top + radius;
      this.playerBall.vy = Math.abs(this.playerBall.vy) * 0.35;
    } else if (this.playerBall.y > this.courtBounds.bottom - radius) {
      this.playerBall.y = this.courtBounds.bottom - radius;
      this.playerBall.vy = -Math.abs(this.playerBall.vy) * 0.35;
    }

    this.syncPlayerBallVisuals();

    if (Math.hypot(this.playerBall.vx, this.playerBall.vy) <= stopSpeed) {
      this.playerBall.vx = 0;
      this.playerBall.vy = 0;
      this.syncPlayerBallVisuals();
      this.setPhase('stopped');
    }
  }

  private syncPlayerBallVisuals(): void {
    this.playerBallShadow?.setPosition(this.playerBall.x, this.playerBall.y);
    this.playerBallCircle?.setPosition(this.playerBall.x, this.playerBall.y);
    this.playerBallLabel?.setPosition(this.playerBall.x, this.playerBall.y + BOCCIA_CONFIG.balls.ballRadius + 13);
  }

  private setPhase(phase: BocciaPhase): void {
    if (this.phase === phase) {
      return;
    }

    this.phase = phase;
    this.refreshHudLabels();
    this.redrawPowerMeter();
  }

  private refreshHudLabels(): void {
    const powerPercent = Math.round(this.power * 100);

    if (this.phaseText) {
      this.phaseText.text = `Current phase: ${phaseLabels[this.phase]}`;
    }

    if (this.powerText) {
      this.powerText.text = `Power: ${powerPercent}%`;
    }

    if (this.hintText) {
      this.hintText.text = this.getHintText();
    }
  }

  private getHintText(): string {
    if (this.phase === 'aiming') {
      return 'A/D or arrows aim • Hold Space/Enter or Primary to charge';
    }

    if (this.phase === 'charging') {
      return 'Release Space/Enter or Primary to throw';
    }

    if (this.phase === 'rolling') {
      return 'Ball is rolling with friction';
    }

    return 'Ball stopped • Scoring and CPU turns arrive later';
  }
}
