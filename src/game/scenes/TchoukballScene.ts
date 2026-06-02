import Phaser from 'phaser';
import { audioManager } from '../../audio/audioManager';
import { inputManager } from '../../input/inputManager';
import type { InputState } from '../../input/types';
import { matchManager } from '../match/matchManager';
import type { Difficulty } from '../types';
import {
  BALL_RADIUS,
  COURT_HEIGHT,
  COURT_WIDTH,
  FRAME_SIZE,
  PLAYER_COLORS,
  ZONE_COLORS,
} from '../sports/tchoukball/tchoukballConfig';

type TchoukballPhase =
  | 'player_aiming'
  | 'player_charging'
  | 'player_flying'
  | 'player_rebounded'
  | 'player_landed'
  | 'cpu_thinking'
  | 'cpu_flying'
  | 'cpu_rebounded'
  | 'cpu_landed'
  | 'preview_result';

type TchoukballLandingResult = 'valid' | 'forbidden_zone' | 'out_of_bounds' | 'missed_frame' | 'none';
type TchoukballSide = 'player' | 'cpu';

interface TchoukballShotState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  hasHitFrame: boolean;
  landingX: number | null;
  landingY: number | null;
  result: TchoukballLandingResult;
}

interface TchoukballScoringPreview {
  label: string;
  playerPreviewScore: number;
  cpuPreviewScore: number;
}

type Point = {
  x: number;
  y: number;
};

const AIM_MIN_DEGREES = 154;
const AIM_MAX_DEGREES = 206;
const AIM_TURN_DEGREES_PER_SECOND = 58;
const CHARGE_PER_SECOND = 1.05;
const MIN_THROW_SPEED = 360;
const MAX_THROW_SPEED = 560;
const REBOUND_SPEED_MULTIPLIER = 0.78;
const LAND_AFTER_REBOUND_MS = 880;
const FORBIDDEN_ZONE_RADIUS = 74;
const CPU_THINKING_DELAY_MS = 720;
const PLAYER_LANDING_HOLD_MS = 650;
const CPU_LANDING_HOLD_MS = 650;

const DEFAULT_SCORING_PREVIEW: TchoukballScoringPreview = {
  label: 'Preview result: waiting for player shot',
  playerPreviewScore: 0,
  cpuPreviewScore: 0,
};

const difficultyLabels: Record<Difficulty, string> = {
  easy: 'Easy',
  normal: 'Normal',
  hard: 'Hard',
};

const cpuErrorByDifficulty: Record<Difficulty, { aim: number; power: number }> = {
  easy: { aim: 0.35, power: 0.3 },
  normal: { aim: 0.2, power: 0.18 },
  hard: { aim: 0.1, power: 0.1 },
};

const phaseLabels: Record<TchoukballPhase, string> = {
  player_aiming: 'Player aiming',
  player_charging: 'Player charging',
  player_flying: 'Player flying',
  player_rebounded: 'Player rebounded',
  player_landed: 'Player landed',
  cpu_thinking: 'CPU thinking',
  cpu_flying: 'CPU flying',
  cpu_rebounded: 'CPU rebounded',
  cpu_landed: 'CPU landed',
  preview_result: 'Preview result',
};

function color(hex: string): number {
  return Phaser.Display.Color.HexStringToColor(hex).color;
}

function createEmptyShotState(start: Point): TchoukballShotState {
  return {
    x: start.x,
    y: start.y,
    vx: 0,
    vy: 0,
    hasHitFrame: false,
    landingX: null,
    landingY: null,
    result: 'none',
  };
}

export class TchoukballScene extends Phaser.Scene {
  private court = new Phaser.Geom.Rectangle(0, 0, COURT_WIDTH, COURT_HEIGHT);

  private playerStart: Point = { x: 0, y: 0 };

  private cpuStart: Point = { x: 0, y: 0 };

  private playerTargetFrame: Point = { x: 0, y: 0 };

  private cpuTargetFrame: Point = { x: 0, y: 0 };

  private playerFrameBounds = new Phaser.Geom.Rectangle(0, 0, FRAME_SIZE + 24, FRAME_SIZE + 44);

  private cpuFrameBounds = new Phaser.Geom.Rectangle(0, 0, FRAME_SIZE + 24, FRAME_SIZE + 44);

  private playerShot: TchoukballShotState = createEmptyShotState({ x: 0, y: 0 });

  private cpuShot: TchoukballShotState = createEmptyShotState({ x: 0, y: 0 });

  private scoringPreview: TchoukballScoringPreview = { ...DEFAULT_SCORING_PREVIEW };

  private phase: TchoukballPhase = 'player_aiming';

  private aimDegrees = 180;

  private charge = 0;

  private cpuCharge = 0.58;

  private cpuAimDegrees = 0;

  private reboundElapsedMs = 0;

  private latestInput: InputState = inputManager.getInputState();

  private wasPrimaryDown = false;

  private unsubscribeInput: (() => void) | null = null;

  private cpuTimer: Phaser.Time.TimerEvent | null = null;

  private dynamicGraphics: Phaser.GameObjects.Graphics | null = null;

  private phaseText: Phaser.GameObjects.Text | null = null;

  private hintText: Phaser.GameObjects.Text | null = null;

  private landingText: Phaser.GameObjects.Text | null = null;

  private readonly handleRetryRequest = (): void => {
    this.resetInteraction();
  };

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
    this.cpuStart = { x: courtX + 190, y: centerY - 42 };
    this.playerTargetFrame = { x: courtX + 34, y: centerY };
    this.cpuTargetFrame = { x: courtX + COURT_WIDTH - 34, y: centerY };
    this.setFrameBounds(this.playerFrameBounds, this.playerTargetFrame);
    this.setFrameBounds(this.cpuFrameBounds, this.cpuTargetFrame);
    this.aimDegrees = this.clampedPlayerFrameAim();
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
    this.phaseText = this.add.text(courtX + 18, courtY + COURT_HEIGHT - 82, '', this.labelStyle()).setOrigin(0, 0.5);
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
    window.addEventListener('tchoukball:retry', this.handleRetryRequest);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.cpuTimer?.remove(false);
      this.unsubscribeInput?.();
      this.unsubscribeInput = null;
      window.removeEventListener('tchoukball:retry', this.handleRetryRequest);
    });
  }

  update(_time: number, delta: number): void {
    const deltaSeconds = delta / 1000;
    const primaryDown = this.latestInput.primary;

    if (this.phase === 'player_aiming' || this.phase === 'player_charging') {
      this.updateAim(deltaSeconds);
    }

    if (this.phase === 'player_aiming' && primaryDown && !this.wasPrimaryDown) {
      this.phase = 'player_charging';
      this.charge = 0;
    }

    if (this.phase === 'player_charging') {
      this.charge = Math.min(1, this.charge + deltaSeconds * CHARGE_PER_SECOND);

      if (!primaryDown && this.wasPrimaryDown) {
        this.throwPlayerBall();
      }
    }

    if (this.phase === 'player_flying' || this.phase === 'player_rebounded') {
      this.updateShot(delta, deltaSeconds, 'player');
    }

    if (this.phase === 'cpu_flying' || this.phase === 'cpu_rebounded') {
      this.updateShot(delta, deltaSeconds, 'cpu');
    }

    if (this.phase === 'preview_result' && primaryDown && !this.wasPrimaryDown) {
      this.resetInteraction();
    }

    this.wasPrimaryDown = primaryDown;
    this.drawInteraction();
  }

  private setFrameBounds(bounds: Phaser.Geom.Rectangle, frame: Point): void {
    bounds.setTo(frame.x - (FRAME_SIZE + 34) / 2, frame.y - (FRAME_SIZE + 54) / 2, FRAME_SIZE + 34, FRAME_SIZE + 54);
  }

  private clampedPlayerFrameAim(): number {
    const frameAimDegrees = Phaser.Math.RadToDeg(
      Phaser.Math.Angle.Between(this.playerStart.x, this.playerStart.y, this.playerTargetFrame.x, this.playerTargetFrame.y),
    );

    return Phaser.Math.Clamp(frameAimDegrees < 0 ? frameAimDegrees + 360 : frameAimDegrees, AIM_MIN_DEGREES, AIM_MAX_DEGREES);
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

  private throwPlayerBall(): void {
    const aimRadians = Phaser.Math.DegToRad(this.aimDegrees);
    const speed = Phaser.Math.Linear(MIN_THROW_SPEED, MAX_THROW_SPEED, this.charge);

    this.phase = 'player_flying';
    this.scoringPreview = { ...DEFAULT_SCORING_PREVIEW };
    this.playerShot.vx = Math.cos(aimRadians) * speed;
    this.playerShot.vy = Math.sin(aimRadians) * speed;
    audioManager.playSe('throw');
  }

  private throwCpuBall(): void {
    const difficulty = matchManager.getMatchState().difficulty;
    const error = cpuErrorByDifficulty[difficulty];
    const baseAimRadians = Phaser.Math.Angle.Between(this.cpuStart.x, this.cpuStart.y, this.cpuTargetFrame.x, this.cpuTargetFrame.y);
    const aimRadians = baseAimRadians + Phaser.Math.FloatBetween(-error.aim, error.aim);
    const baseCharge = Phaser.Math.Clamp(0.56 + Phaser.Math.FloatBetween(-error.power, error.power), 0.16, 0.92);
    const speed = Phaser.Math.Linear(MIN_THROW_SPEED, MAX_THROW_SPEED, baseCharge);

    this.cpuCharge = baseCharge;
    this.cpuAimDegrees = Phaser.Math.RadToDeg(aimRadians);
    this.cpuShot = createEmptyShotState(this.cpuStart);
    this.phase = 'cpu_flying';
    this.cpuShot.vx = Math.cos(aimRadians) * speed;
    this.cpuShot.vy = Math.sin(aimRadians) * speed;
    audioManager.playSe('throw');
  }

  private updateShot(delta: number, deltaSeconds: number, side: TchoukballSide): void {
    const shot = this.getShot(side);
    const frameBounds = side === 'player' ? this.playerFrameBounds : this.cpuFrameBounds;

    shot.x += shot.vx * deltaSeconds;
    shot.y += shot.vy * deltaSeconds;

    if (!shot.hasHitFrame) {
      if (Phaser.Geom.Rectangle.Contains(frameBounds, shot.x, shot.y)) {
        this.reboundShot(side);
      } else if (this.hasMissedFrame(shot, side)) {
        this.landMissedFrame(side);
      }

      return;
    }

    this.reboundElapsedMs += delta;

    if (
      this.reboundElapsedMs >= LAND_AFTER_REBOUND_MS ||
      shot.x <= this.court.left + 28 ||
      shot.x >= this.court.right - 28 ||
      shot.y <= this.court.top + 28 ||
      shot.y >= this.court.bottom - 28
    ) {
      this.landShot(side);
    }
  }

  private hasMissedFrame(shot: TchoukballShotState, side: TchoukballSide): boolean {
    if (side === 'player') {
      return shot.x < this.court.left - 28 || shot.y < this.court.top - 28 || shot.y > this.court.bottom + 28;
    }

    return shot.x > this.court.right + 28 || shot.y < this.court.top - 28 || shot.y > this.court.bottom + 28;
  }

  private reboundShot(side: TchoukballSide): void {
    const shot = this.getShot(side);
    const incomingSpeed = Math.max(MIN_THROW_SPEED, Math.hypot(shot.vx, shot.vy));
    const landingPoint = side === 'player' ? this.getPlayerLandingPreview() : this.getCpuLandingPreview();
    const angle = Phaser.Math.Angle.Between(shot.x, shot.y, landingPoint.x, landingPoint.y);
    const reboundSpeed = incomingSpeed * REBOUND_SPEED_MULTIPLIER;

    shot.hasHitFrame = true;
    shot.landingX = landingPoint.x;
    shot.landingY = landingPoint.y;
    shot.result = 'none';
    this.phase = side === 'player' ? 'player_rebounded' : 'cpu_rebounded';
    this.reboundElapsedMs = 0;
    shot.x = side === 'player' ? Math.max(shot.x, this.playerTargetFrame.x + FRAME_SIZE / 2) : Math.min(shot.x, this.cpuTargetFrame.x - FRAME_SIZE / 2);
    shot.vx = Math.cos(angle) * reboundSpeed;
    shot.vy = Math.sin(angle) * reboundSpeed;
    audioManager.playSe('tagHit');
  }

  private getPlayerLandingPreview(): Point {
    return {
      x: this.court.left + 70 + this.charge * 360,
      y: this.court.centerY + (this.aimDegrees - 180) * 6.6,
    };
  }

  private getCpuLandingPreview(): Point {
    return {
      x: this.court.right - 70 - this.cpuCharge * 360,
      y: this.court.centerY + this.cpuAimDegrees * 6.6,
    };
  }

  private landShot(side: TchoukballSide): void {
    const shot = this.getShot(side);

    if (shot.landingX !== null && shot.landingY !== null) {
      shot.x = shot.landingX;
      shot.y = shot.landingY;
      shot.result = this.getLandingResult({ x: shot.landingX, y: shot.landingY });
    }

    shot.vx = 0;
    shot.vy = 0;
    this.updateScoringPreview();
    this.phase = side === 'player' ? 'player_landed' : 'cpu_landed';
    audioManager.playSe(shot.result === 'valid' ? 'score' : 'fail');

    if (side === 'player') {
      this.queueCpuThinking();
    } else {
      this.cpuTimer = this.time.delayedCall(CPU_LANDING_HOLD_MS, () => this.showPreviewResult());
    }
  }

  private landMissedFrame(side: TchoukballSide): void {
    const shot = this.getShot(side);

    shot.vx = 0;
    shot.vy = 0;
    shot.hasHitFrame = false;
    shot.landingX = null;
    shot.landingY = null;
    shot.result = 'missed_frame';
    this.updateScoringPreview();
    this.phase = side === 'player' ? 'player_landed' : 'cpu_landed';
    audioManager.playSe('fail');

    if (side === 'player') {
      this.queueCpuThinking();
    } else {
      this.cpuTimer = this.time.delayedCall(CPU_LANDING_HOLD_MS, () => this.showPreviewResult());
    }
  }

  private queueCpuThinking(): void {
    this.cpuTimer?.remove(false);
    this.cpuTimer = this.time.delayedCall(PLAYER_LANDING_HOLD_MS, () => {
      this.phase = 'cpu_thinking';
      this.cpuTimer = this.time.delayedCall(CPU_THINKING_DELAY_MS, () => this.throwCpuBall());
    });
  }

  private showPreviewResult(): void {
    this.phase = 'preview_result';
    this.updateScoringPreview();
    audioManager.playSe(this.scoringPreview.playerPreviewScore > this.scoringPreview.cpuPreviewScore ? 'score' : 'select');
  }

  private updateScoringPreview(): void {
    const playerScore = this.playerShot.result === 'valid' ? 1 : 0;
    const cpuScore = this.cpuShot.result === 'valid' ? 1 : 0;

    this.scoringPreview = {
      label: this.buildPreviewLabel(playerScore, cpuScore),
      playerPreviewScore: playerScore,
      cpuPreviewScore: cpuScore,
    };
  }

  private buildPreviewLabel(playerScore: number, cpuScore: number): string {
    if (this.phase === 'preview_result' || this.cpuShot.result !== 'none') {
      return `Preview result: Player ${playerScore} - ${cpuScore} CPU`;
    }

    if (this.playerShot.result === 'valid') {
      return 'Preview result: Player +1; CPU reply pending';
    }

    if (this.playerShot.result !== 'none') {
      return 'Preview result: Player no point; CPU reply pending';
    }

    return DEFAULT_SCORING_PREVIEW.label;
  }

  private getShot(side: TchoukballSide): TchoukballShotState {
    return side === 'player' ? this.playerShot : this.cpuShot;
  }

  private getLandingResult(point: Point): TchoukballLandingResult {
    if (!Phaser.Geom.Rectangle.Contains(this.court, point.x, point.y)) {
      return 'out_of_bounds';
    }

    if (this.isInForbiddenZone(point)) {
      return 'forbidden_zone';
    }

    return 'valid';
  }

  private isInForbiddenZone(point: Point): boolean {
    const leftZone = { x: this.court.left + 82, y: this.court.centerY };
    const rightZone = { x: this.court.right - 82, y: this.court.centerY };

    return (
      Phaser.Math.Distance.Between(point.x, point.y, leftZone.x, leftZone.y) <= FORBIDDEN_ZONE_RADIUS ||
      Phaser.Math.Distance.Between(point.x, point.y, rightZone.x, rightZone.y) <= FORBIDDEN_ZONE_RADIUS
    );
  }

  private resetInteraction(): void {
    this.cpuTimer?.remove(false);
    this.cpuTimer = null;
    this.phase = 'player_aiming';
    this.charge = 0;
    this.cpuCharge = 0.58;
    this.reboundElapsedMs = 0;
    this.aimDegrees = this.clampedPlayerFrameAim();
    this.playerShot = createEmptyShotState(this.playerStart);
    this.cpuShot = createEmptyShotState(this.cpuStart);
    this.scoringPreview = { ...DEFAULT_SCORING_PREVIEW };
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
    const difficulty = difficultyLabels[matchManager.getMatchState().difficulty];

    graphics.clear();

    graphics.lineStyle(4, 0xfacc15, this.isPlayerActive() ? 0.95 : 0.34);
    graphics.beginPath();
    graphics.moveTo(this.playerStart.x, this.playerStart.y);
    graphics.lineTo(aimEndX, aimEndY);
    graphics.strokePath();
    graphics.fillStyle(0xfacc15, 0.9);
    graphics.fillTriangle(aimEndX, aimEndY, aimEndX + 10, aimEndY - 5, aimEndX + 10, aimEndY + 5);

    if (this.phase === 'cpu_thinking' || this.phase === 'cpu_flying' || this.phase === 'cpu_rebounded') {
      this.drawCpuIntent(graphics);
    }

    graphics.lineStyle(5, this.phase === 'player_rebounded' ? 0xfacc15 : 0x38bdf8, this.isPlayerShotMoving() ? 1 : 0.42);
    graphics.strokeRoundedRect(this.playerFrameBounds.x, this.playerFrameBounds.y, this.playerFrameBounds.width, this.playerFrameBounds.height, 10);
    graphics.lineStyle(5, this.phase === 'cpu_rebounded' ? 0x38bdf8 : 0xfacc15, this.isCpuShotMoving() ? 1 : 0.42);
    graphics.strokeRoundedRect(this.cpuFrameBounds.x, this.cpuFrameBounds.y, this.cpuFrameBounds.width, this.cpuFrameBounds.height, 10);

    this.drawPowerMeter(graphics);
    this.drawLandingMarker(graphics, this.playerShot, 'player');
    this.drawLandingMarker(graphics, this.cpuShot, 'cpu');
    this.drawShotGraphic(graphics, this.playerShot, 0xf97316, 0xffedd5);
    this.drawShotGraphic(graphics, this.cpuShot, 0x38bdf8, 0xe0f2fe);

    this.phaseText.setText(
      [
        `Phase: ${phaseLabels[this.phase]}`,
        `CPU difficulty: ${difficulty}`,
        this.scoringPreview.label,
        `Preview score: Player ${this.scoringPreview.playerPreviewScore} - ${this.scoringPreview.cpuPreviewScore} CPU`,
        `Player landing: ${this.getLandingLabel(this.playerShot.result)}`,
        `CPU landing: ${this.getLandingLabel(this.cpuShot.result)}`,
      ].join('\n'),
    );
    this.hintText.setText(this.getHintText());
    this.landingText
      .setText(this.getLandingPreviewText())
      .setColor(this.getLandingTextColor())
      .setVisible(this.phase !== 'player_aiming' && this.phase !== 'player_charging' && this.phase !== 'player_flying');
  }

  private drawCpuIntent(graphics: Phaser.GameObjects.Graphics): void {
    const pulse = this.phase === 'cpu_thinking' ? 0.45 + Math.sin(this.time.now / 120) * 0.18 : 0.8;

    graphics.lineStyle(4, 0x38bdf8, pulse);
    graphics.beginPath();
    graphics.moveTo(this.cpuStart.x, this.cpuStart.y);
    graphics.lineTo(this.cpuTargetFrame.x - 24, this.cpuTargetFrame.y);
    graphics.strokePath();
  }

  private drawLandingMarker(graphics: Phaser.GameObjects.Graphics, shot: TchoukballShotState, side: TchoukballSide): void {
    if (shot.landingX === null || shot.landingY === null) {
      return;
    }

    const markerColor = this.getLandingMarkerColor(shot.result, side);
    const resolved = shot.result !== 'none';

    graphics.lineStyle(3, markerColor.stroke, resolved ? 1 : 0.62);
    graphics.fillStyle(markerColor.fill, resolved ? 0.32 : 0.16);
    graphics.fillCircle(shot.landingX, shot.landingY, 28);
    graphics.strokeCircle(shot.landingX, shot.landingY, 28);
    graphics.lineStyle(2, markerColor.crosshair, 0.9);
    graphics.beginPath();
    graphics.moveTo(shot.landingX - 18, shot.landingY);
    graphics.lineTo(shot.landingX + 18, shot.landingY);
    graphics.moveTo(shot.landingX, shot.landingY - 18);
    graphics.lineTo(shot.landingX, shot.landingY + 18);
    graphics.strokePath();
  }

  private drawPowerMeter(graphics: Phaser.GameObjects.Graphics): void {
    const meterX = this.court.right - 196;
    const meterY = this.court.top + 24;
    const meterWidth = 156;
    const meterHeight = 14;

    graphics.fillStyle(0x020617, 0.48);
    graphics.fillRoundedRect(meterX, meterY, meterWidth, meterHeight, 7);
    graphics.fillStyle(this.phase === 'player_charging' ? 0xfacc15 : 0x38bdf8, 0.92);
    graphics.fillRoundedRect(meterX, meterY, meterWidth * this.charge, meterHeight, 7);
    graphics.lineStyle(2, 0xccfbf1, 0.72);
    graphics.strokeRoundedRect(meterX, meterY, meterWidth, meterHeight, 7);
  }

  private drawShotGraphic(graphics: Phaser.GameObjects.Graphics, shot: TchoukballShotState, fill: number, stroke: number): void {
    graphics.fillStyle(0x020617, 0.35);
    graphics.fillCircle(shot.x + 3, shot.y + 4, BALL_RADIUS);
    graphics.fillStyle(fill, 1);
    graphics.fillCircle(shot.x, shot.y, BALL_RADIUS);
    graphics.lineStyle(2, stroke, 1);
    graphics.strokeCircle(shot.x, shot.y, BALL_RADIUS);
    graphics.fillStyle(0x07111f, 1);
    graphics.fillCircle(shot.x, shot.y, 4);
  }

  private getLandingMarkerColor(result: TchoukballLandingResult, side: TchoukballSide): { fill: number; stroke: number; crosshair: number } {
    if (result === 'none') {
      return side === 'player'
        ? { fill: 0xf97316, stroke: 0xfed7aa, crosshair: 0xffedd5 }
        : { fill: 0x38bdf8, stroke: 0xbae6fd, crosshair: 0xe0f2fe };
    }

    if (result === 'valid') {
      return { fill: 0x84cc16, stroke: side === 'player' ? 0xfacc15 : 0x38bdf8, crosshair: 0xecfccb };
    }

    if (result === 'forbidden_zone') {
      return { fill: 0xef4444, stroke: 0xfb923c, crosshair: 0xffedd5 };
    }

    return { fill: 0xdc2626, stroke: 0xfca5a5, crosshair: 0xfee2e2 };
  }

  private getLandingPreviewText(): string {
    if (this.phase === 'player_rebounded') {
      return 'Player landing preview';
    }

    if (this.phase === 'player_landed') {
      return `Player ${this.getLandingLabel(this.playerShot.result).toLowerCase()} preview\n${this.scoringPreview.label}`;
    }

    if (this.phase === 'cpu_thinking') {
      return 'CPU thinking — automatic reply incoming';
    }

    if (this.phase === 'cpu_rebounded') {
      return 'CPU landing preview';
    }

    if (this.phase === 'cpu_landed') {
      return `CPU ${this.getLandingLabel(this.cpuShot.result).toLowerCase()} preview\n${this.scoringPreview.label}`;
    }

    if (this.phase === 'preview_result') {
      return this.scoringPreview.label;
    }

    return this.scoringPreview.label;
  }

  private getLandingTextColor(): string {
    const activeResult = this.phase === 'cpu_landed' || this.phase === 'preview_result' ? this.cpuShot.result : this.playerShot.result;

    if (activeResult === 'valid') {
      return '#bef264';
    }

    if (activeResult === 'missed_frame') {
      return '#fecaca';
    }

    if (activeResult === 'forbidden_zone' || activeResult === 'out_of_bounds') {
      return '#fdba74';
    }

    return '#fed7aa';
  }

  private getLandingLabel(result: TchoukballLandingResult): string {
    if (result === 'valid') {
      return 'Valid';
    }

    if (result === 'forbidden_zone') {
      return 'Forbidden zone';
    }

    if (result === 'out_of_bounds') {
      return 'Out';
    }

    if (result === 'missed_frame') {
      return 'Missed frame';
    }

    return 'Pending';
  }

  private getHintText(): string {
    if (this.phase === 'player_charging') {
      return 'Charging power — release Space / Enter / Primary to throw';
    }

    if (this.phase === 'player_flying') {
      return 'Player shot flying toward the rebound frame';
    }

    if (this.phase === 'player_rebounded') {
      return 'Player rebound — previewing the landing zone';
    }

    if (this.phase === 'player_landed' || this.phase === 'cpu_thinking') {
      return 'Player preview locked. CPU will take one automatic rebound shot.';
    }

    if (this.phase === 'cpu_flying') {
      return 'CPU shot is flying toward the opposite rebound frame';
    }

    if (this.phase === 'cpu_rebounded') {
      return 'CPU rebound — previewing its landing zone';
    }

    if (this.phase === 'cpu_landed') {
      return 'CPU preview locked. Building preview score comparison.';
    }

    if (this.phase === 'preview_result') {
      return 'Preview result only. Press Primary or Retry to reset; no full match system yet.';
    }

    return 'Aim with A / D or ← / →. Hold Space / Enter / Primary to charge.';
  }

  private isPlayerActive(): boolean {
    return this.phase === 'player_aiming' || this.phase === 'player_charging' || this.phase === 'player_flying' || this.phase === 'player_rebounded';
  }

  private isPlayerShotMoving(): boolean {
    return this.phase === 'player_flying' || this.phase === 'player_rebounded';
  }

  private isCpuShotMoving(): boolean {
    return this.phase === 'cpu_flying' || this.phase === 'cpu_rebounded';
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
    this.add.text(centerX, 24, 'Tchoukball VS CPU foundation preview', {
      align: 'center',
      color: '#f8fafc',
      fontFamily: 'Inter, sans-serif',
      fontSize: '24px',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(centerX, 52, 'Player shot, CPU reply, landing classification, and preview comparison — no full rules yet', {
      align: 'center',
      color: '#bae6fd',
      fontFamily: 'Inter, sans-serif',
      fontSize: '14px',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(courtX + 28, courtY + 12, 'Player target frame', this.labelStyle()).setOrigin(0, 0);
    this.add.text(courtX + COURT_WIDTH - 28, courtY + 12, 'CPU target frame', this.labelStyle()).setOrigin(1, 0);
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
