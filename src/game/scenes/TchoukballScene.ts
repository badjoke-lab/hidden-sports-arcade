import Phaser from 'phaser';
import { audioManager } from '../../audio/audioManager';
import { inputManager } from '../../input/inputManager';
import type { InputState } from '../../input/types';
import {
  BALL_RADIUS,
  COURT_HEIGHT,
  COURT_WIDTH,
  FRAME_SIZE,
  PLAYER_COLORS,
  ZONE_COLORS,
} from '../sports/tchoukball/tchoukballConfig';

type TchoukballPhase = 'aiming' | 'charging' | 'flying' | 'rebounded' | 'landed';

type Point = {
  x: number;
  y: number;
};

type BallState = Point & {
  vx: number;
  vy: number;
};

const AIM_MIN_DEGREES = 154;
const AIM_MAX_DEGREES = 206;
const AIM_TURN_DEGREES_PER_SECOND = 58;
const CHARGE_PER_SECOND = 1.05;
const MIN_THROW_SPEED = 360;
const MAX_THROW_SPEED = 560;
const REBOUND_SPEED_MULTIPLIER = 0.78;
const LAND_AFTER_REBOUND_MS = 880;

function color(hex: string): number {
  return Phaser.Display.Color.HexStringToColor(hex).color;
}

export class TchoukballScene extends Phaser.Scene {
  private court = new Phaser.Geom.Rectangle(0, 0, COURT_WIDTH, COURT_HEIGHT);

  private playerStart: Point = { x: 0, y: 0 };

  private targetFrame: Point = { x: 0, y: 0 };

  private reboundFrameBounds = new Phaser.Geom.Rectangle(0, 0, FRAME_SIZE + 24, FRAME_SIZE + 44);

  private ball: BallState = { x: 0, y: 0, vx: 0, vy: 0 };

  private landingPreview: Point | null = null;

  private phase: TchoukballPhase = 'aiming';

  private aimDegrees = 180;

  private charge = 0;

  private reboundElapsedMs = 0;

  private latestInput: InputState = inputManager.getInputState();

  private wasPrimaryDown = false;

  private unsubscribeInput: (() => void) | null = null;

  private dynamicGraphics: Phaser.GameObjects.Graphics | null = null;

  private phaseText: Phaser.GameObjects.Text | null = null;

  private hintText: Phaser.GameObjects.Text | null = null;

  private landingText: Phaser.GameObjects.Text | null = null;

  constructor() {
    super('TchoukballScene');
  }

  create(): void {
    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2 + 10;
    const courtX = centerX - COURT_WIDTH / 2;
    const courtY = centerY - COURT_HEIGHT / 2;
    const graphics = this.add.graphics();

    this.court.setTo(courtX, courtY, COURT_WIDTH, COURT_HEIGHT);
    this.playerStart = { x: courtX + COURT_WIDTH - 190, y: centerY + 42 };
    this.targetFrame = { x: courtX + 34, y: centerY };
    this.reboundFrameBounds.setTo(
      this.targetFrame.x - (FRAME_SIZE + 34) / 2,
      this.targetFrame.y - (FRAME_SIZE + 54) / 2,
      FRAME_SIZE + 34,
      FRAME_SIZE + 54,
    );
    const frameAimDegrees = Phaser.Math.RadToDeg(
      Phaser.Math.Angle.Between(this.playerStart.x, this.playerStart.y, this.targetFrame.x, this.targetFrame.y),
    );
    this.aimDegrees = Phaser.Math.Clamp(
      frameAimDegrees < 0 ? frameAimDegrees + 360 : frameAimDegrees,
      AIM_MIN_DEGREES,
      AIM_MAX_DEGREES,
    );
    this.resetInteraction();

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
    this.drawLabels(courtX, courtY, centerX, centerY);

    this.dynamicGraphics = this.add.graphics();
    this.phaseText = this.add.text(courtX + 18, courtY + COURT_HEIGHT - 70, '', this.labelStyle()).setOrigin(0, 0.5);
    this.hintText = this.add.text(centerX, courtY + COURT_HEIGHT - 28, '', this.labelStyle()).setOrigin(0.5);
    this.landingText = this.add.text(centerX, courtY + 70, '', {
      align: 'center',
      color: '#fed7aa',
      fontFamily: 'Inter, sans-serif',
      fontSize: '15px',
      fontStyle: 'bold',
    }).setOrigin(0.5).setVisible(false);

    this.unsubscribeInput = inputManager.subscribe((state) => {
      this.latestInput = state;
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubscribeInput?.();
      this.unsubscribeInput = null;
    });
  }

  update(_time: number, delta: number): void {
    const deltaSeconds = delta / 1000;
    const primaryDown = this.latestInput.primary;

    if (this.phase === 'aiming' || this.phase === 'charging') {
      this.updateAim(deltaSeconds);
    }

    if (this.phase === 'aiming' && primaryDown && !this.wasPrimaryDown) {
      this.phase = 'charging';
      this.charge = 0;
    }

    if (this.phase === 'charging') {
      this.charge = Math.min(1, this.charge + deltaSeconds * CHARGE_PER_SECOND);

      if (!primaryDown && this.wasPrimaryDown) {
        this.throwBall();
      }
    }

    if (this.phase === 'flying' || this.phase === 'rebounded') {
      this.updateBall(delta, deltaSeconds);
    }

    if (this.phase === 'landed' && primaryDown && !this.wasPrimaryDown) {
      this.resetInteraction();
    }

    this.wasPrimaryDown = primaryDown;
    this.drawInteraction();
  }

  private updateAim(deltaSeconds: number): void {
    const direction = Number(this.latestInput.aimRight) - Number(this.latestInput.aimLeft);

    if (direction === 0) {
      return;
    }

    this.aimDegrees = Phaser.Math.Clamp(
      this.aimDegrees + direction * AIM_TURN_DEGREES_PER_SECOND * deltaSeconds,
      AIM_MIN_DEGREES,
      AIM_MAX_DEGREES,
    );
  }

  private throwBall(): void {
    const aimRadians = Phaser.Math.DegToRad(this.aimDegrees);
    const speed = Phaser.Math.Linear(MIN_THROW_SPEED, MAX_THROW_SPEED, this.charge);

    this.phase = 'flying';
    this.landingPreview = null;
    this.ball.vx = Math.cos(aimRadians) * speed;
    this.ball.vy = Math.sin(aimRadians) * speed;
    audioManager.playSe('throw');
  }

  private updateBall(delta: number, deltaSeconds: number): void {
    this.ball.x += this.ball.vx * deltaSeconds;
    this.ball.y += this.ball.vy * deltaSeconds;

    if (this.phase === 'flying') {
      if (Phaser.Geom.Rectangle.Contains(this.reboundFrameBounds, this.ball.x, this.ball.y)) {
        this.reboundBall();
      } else if (this.ball.x < this.court.left - 28 || this.ball.y < this.court.top - 28 || this.ball.y > this.court.bottom + 28) {
        this.reboundBall();
      }

      return;
    }

    this.reboundElapsedMs += delta;

    if (
      this.reboundElapsedMs >= LAND_AFTER_REBOUND_MS ||
      this.ball.x >= this.court.right - 78 ||
      this.ball.y <= this.court.top + 28 ||
      this.ball.y >= this.court.bottom - 28
    ) {
      this.landBall();
    }
  }

  private reboundBall(): void {
    const incomingSpeed = Math.max(MIN_THROW_SPEED, Math.hypot(this.ball.vx, this.ball.vy));
    const landingX = Phaser.Math.Clamp(
      this.court.centerX + Phaser.Math.Linear(24, 154, this.charge),
      this.court.left + 130,
      this.court.right - 95,
    );
    const landingY = Phaser.Math.Clamp(
      this.court.centerY + (this.aimDegrees - 180) * 2.3,
      this.court.top + 54,
      this.court.bottom - 54,
    );
    const angle = Phaser.Math.Angle.Between(this.ball.x, this.ball.y, landingX, landingY);
    const reboundSpeed = incomingSpeed * REBOUND_SPEED_MULTIPLIER;

    this.phase = 'rebounded';
    this.reboundElapsedMs = 0;
    this.landingPreview = { x: landingX, y: landingY };
    this.ball.x = Math.max(this.ball.x, this.targetFrame.x + FRAME_SIZE / 2);
    this.ball.vx = Math.cos(angle) * reboundSpeed;
    this.ball.vy = Math.sin(angle) * reboundSpeed;
    audioManager.playSe('tagHit');
  }

  private landBall(): void {
    if (this.landingPreview) {
      this.ball.x = this.landingPreview.x;
      this.ball.y = this.landingPreview.y;
    }

    this.ball.vx = 0;
    this.ball.vy = 0;
    this.phase = 'landed';
    audioManager.playSe('score');
  }

  private resetInteraction(): void {
    this.phase = 'aiming';
    this.charge = 0;
    this.reboundElapsedMs = 0;
    this.landingPreview = null;
    this.ball = { x: this.playerStart.x, y: this.playerStart.y, vx: 0, vy: 0 };
  }

  private drawInteraction(): void {
    if (!this.dynamicGraphics || !this.phaseText || !this.hintText || !this.landingText) {
      return;
    }

    const graphics = this.dynamicGraphics;
    const aimRadians = Phaser.Math.DegToRad(this.aimDegrees);
    const aimLength = 136 + this.charge * 52;
    const aimEndX = this.playerStart.x + Math.cos(aimRadians) * aimLength;
    const aimEndY = this.playerStart.y + Math.sin(aimRadians) * aimLength;
    const phaseLabel = this.phase[0].toUpperCase() + this.phase.slice(1);

    graphics.clear();

    graphics.lineStyle(4, 0xfacc15, this.phase === 'flying' || this.phase === 'rebounded' ? 0.38 : 0.95);
    graphics.beginPath();
    graphics.moveTo(this.playerStart.x, this.playerStart.y);
    graphics.lineTo(aimEndX, aimEndY);
    graphics.strokePath();

    graphics.fillStyle(0xfacc15, 0.9);
    graphics.fillTriangle(aimEndX, aimEndY, aimEndX + 10, aimEndY - 5, aimEndX + 10, aimEndY + 5);

    graphics.lineStyle(5, this.phase === 'rebounded' ? 0xfacc15 : 0x38bdf8, this.phase === 'flying' || this.phase === 'rebounded' ? 1 : 0.42);
    graphics.strokeRoundedRect(this.reboundFrameBounds.x, this.reboundFrameBounds.y, this.reboundFrameBounds.width, this.reboundFrameBounds.height, 10);

    this.drawPowerMeter(graphics);
    this.drawBallGraphic(graphics);

    if (this.landingPreview) {
      graphics.lineStyle(3, 0xfed7aa, this.phase === 'landed' ? 1 : 0.62);
      graphics.fillStyle(0xf97316, this.phase === 'landed' ? 0.28 : 0.16);
      graphics.fillCircle(this.landingPreview.x, this.landingPreview.y, 28);
      graphics.strokeCircle(this.landingPreview.x, this.landingPreview.y, 28);
      graphics.lineStyle(2, 0xffedd5, 0.9);
      graphics.beginPath();
      graphics.moveTo(this.landingPreview.x - 18, this.landingPreview.y);
      graphics.lineTo(this.landingPreview.x + 18, this.landingPreview.y);
      graphics.moveTo(this.landingPreview.x, this.landingPreview.y - 18);
      graphics.lineTo(this.landingPreview.x, this.landingPreview.y + 18);
      graphics.strokePath();
    }

    this.phaseText.setText(`Phase: ${phaseLabel}`);
    this.hintText.setText(this.getHintText());
    this.landingText
      .setText(this.phase === 'landed' ? 'Landing preview — scoring not implemented yet' : 'Landing preview')
      .setVisible(this.phase === 'rebounded' || this.phase === 'landed');
  }

  private drawPowerMeter(graphics: Phaser.GameObjects.Graphics): void {
    const meterX = this.court.right - 196;
    const meterY = this.court.top + 24;
    const meterWidth = 156;
    const meterHeight = 14;

    graphics.fillStyle(0x020617, 0.48);
    graphics.fillRoundedRect(meterX, meterY, meterWidth, meterHeight, 7);
    graphics.fillStyle(this.phase === 'charging' ? 0xfacc15 : 0x38bdf8, 0.92);
    graphics.fillRoundedRect(meterX, meterY, meterWidth * this.charge, meterHeight, 7);
    graphics.lineStyle(2, 0xccfbf1, 0.72);
    graphics.strokeRoundedRect(meterX, meterY, meterWidth, meterHeight, 7);
  }

  private drawBallGraphic(graphics: Phaser.GameObjects.Graphics): void {
    graphics.fillStyle(0x020617, 0.35);
    graphics.fillCircle(this.ball.x + 3, this.ball.y + 4, BALL_RADIUS);
    graphics.fillStyle(color(ZONE_COLORS.ball), 1);
    graphics.fillCircle(this.ball.x, this.ball.y, BALL_RADIUS);
    graphics.lineStyle(2, 0xffedd5, 1);
    graphics.strokeCircle(this.ball.x, this.ball.y, BALL_RADIUS);
  }

  private getHintText(): string {
    if (this.phase === 'charging') {
      return 'Charging power — release Space / Enter / Primary to throw';
    }

    if (this.phase === 'flying') {
      return 'Flying toward the rebound frame';
    }

    if (this.phase === 'rebounded') {
      return 'Rebounded — previewing the landing zone';
    }

    if (this.phase === 'landed') {
      return 'Landing preview only. Press Primary to reset; no scoring yet.';
    }

    return 'Aim with A / D or ← / →. Hold Space / Enter / Primary to charge.';
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

  private drawLabels(courtX: number, courtY: number, centerX: number, centerY: number): void {
    this.add.text(centerX, 24, 'Tchoukball foundation preview', {
      align: 'center',
      color: '#f8fafc',
      fontFamily: 'Inter, sans-serif',
      fontSize: '24px',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(centerX, 52, 'Aim, charge, throw, rebound, and landing preview — no scoring yet', {
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
