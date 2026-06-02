import Phaser from 'phaser';
import { audioManager } from '../../audio/audioManager';
import { inputManager } from '../../input/inputManager';
import { completeMission } from '../../progress/progressManager';
import type { InputState } from '../../input/types';
import { matchManager } from '../match/matchManager';
import type { Difficulty, MatchMode } from '../types';
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
  | 'p2_aiming'
  | 'p2_charging'
  | 'p2_flying'
  | 'p2_rebounded'
  | 'p2_landed'
  | 'cpu_thinking'
  | 'cpu_flying'
  | 'cpu_rebounded'
  | 'cpu_landed'
  | 'preview_result';

type TchoukballLandingResult = 'valid' | 'forbidden_zone' | 'out_of_bounds' | 'missed_frame' | 'none';
type TchoukballSide = 'player' | 'cpu' | 'p2';
type TchoukballDemoStep = 'idle' | 'aim' | 'charge' | 'throw' | 'rebound' | 'landing' | 'reply';

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
const DEMO_DURATION_MS = 24000;
const SLOW_DEMO_DURATION_MS = 36000;
const DEMO_STEP_COUNT = 6;

const demoStepCopy: Record<TchoukballDemoStep, { title: string; body: string; status: string }> = {
  idle: { title: '', body: '', status: 'ready' },
  aim: {
    title: 'Step 1: Aim at the rebound frame',
    body: 'Point the throw line toward the angled frame. This ghost demo does not touch the real score.',
    status: 'aiming at the frame',
  },
  charge: {
    title: 'Step 2: Charge power',
    body: 'Hold Primary to build power before release.',
    status: 'charging power',
  },
  throw: {
    title: 'Step 3: Throw to the frame',
    body: 'Release Primary so the ball travels into the rebound frame.',
    status: 'throwing to the frame',
  },
  rebound: {
    title: 'Step 4: Rebound back into the court',
    body: 'After frame contact, the ball bounces back toward open court space.',
    status: 'showing the rebound path',
  },
  landing: {
    title: 'Step 5: Landing preview',
    body: 'A landing in bounds and outside the forbidden zone becomes a valid preview.',
    status: 'checking the landing preview',
  },
  reply: {
    title: 'Step 6: CPU/P2 reply preview',
    body: 'The CPU or Player 2 gets one reply shot, then the preview score compares valid landings.',
    status: 'showing the reply preview',
  },
};


const DEFAULT_SCORING_PREVIEW: TchoukballScoringPreview = {
  label: 'Preview result: waiting for P1 shot',
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
  player_aiming: 'Aim at rebound frame',
  player_charging: 'Charge power',
  player_flying: 'Throw to rebound frame',
  player_rebounded: 'Rebound back into court',
  player_landed: 'Landing preview locked',
  p2_aiming: 'P2 aim at rebound frame',
  p2_charging: 'P2 charge power',
  p2_flying: 'P2 throw to frame',
  p2_rebounded: 'P2 rebound back into court',
  p2_landed: 'P2 landing preview locked',
  cpu_thinking: 'CPU reply thinking',
  cpu_flying: 'CPU throw to frame',
  cpu_rebounded: 'CPU rebound back into court',
  cpu_landed: 'CPU landing preview locked',
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

  private p2AimOffsetDegrees = 0;

  private p2Charge = 0;

  private activeMode: MatchMode = matchManager.getMatchState().mode;

  private reboundElapsedMs = 0;

  private latestInput: InputState = inputManager.getInputState();

  private wasPrimaryDown = false;

  private unsubscribeInput: (() => void) | null = null;

  private cpuTimer: Phaser.Time.TimerEvent | null = null;

  private dynamicGraphics: Phaser.GameObjects.Graphics | null = null;

  private phaseText: Phaser.GameObjects.Text | null = null;

  private hintText: Phaser.GameObjects.Text | null = null;

  private landingText: Phaser.GameObjects.Text | null = null;

  private demoActive = false;

  private demoSlow = false;

  private demoElapsedMs = 0;

  private demoDurationMs = DEMO_DURATION_MS;

  private demoGraphics: Phaser.GameObjects.Graphics | null = null;

  private demoText: Phaser.GameObjects.Text | null = null;


  private readonly handleRetryRequest = (): void => {
    this.stopDemo();
    this.resetInteraction();
  };

  private readonly handleDemoStartRequest = (event: Event): void => {
    const detail = (event as CustomEvent<{ slow?: boolean }>).detail;
    this.startDemo(Boolean(detail?.slow));
  };

  private readonly handleDemoStopRequest = (): void => {
    this.stopDemo();
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
    window.addEventListener('tchoukball:demo-start', this.handleDemoStartRequest);
    window.addEventListener('tchoukball:demo-stop', this.handleDemoStopRequest);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.cpuTimer?.remove(false);
      this.unsubscribeInput?.();
      this.unsubscribeInput = null;
      window.removeEventListener('tchoukball:retry', this.handleRetryRequest);
      window.removeEventListener('tchoukball:demo-start', this.handleDemoStartRequest);
      window.removeEventListener('tchoukball:demo-stop', this.handleDemoStopRequest);
    });
  }

  update(_time: number, delta: number): void {
    const deltaSeconds = delta / 1000;
    const primaryDown = this.latestInput.primary;
    const currentMode = matchManager.getMatchState().mode;

    if (currentMode !== this.activeMode) {
      this.stopDemo();
      this.activeMode = currentMode;
      this.resetInteraction();
    }

    if (this.demoActive) {
      this.updateDemo(delta);
    }

    if (this.phase === 'player_aiming' || this.phase === 'player_charging') {
      this.updateAim(deltaSeconds);
    }

    if (this.phase === 'p2_aiming' || this.phase === 'p2_charging') {
      this.updateP2Aim(deltaSeconds);
    }

    if (this.phase === 'player_aiming' && primaryDown && !this.wasPrimaryDown) {
      this.stopDemo();
      this.phase = 'player_charging';
      this.charge = 0;
    }

    if (this.phase === 'p2_aiming' && primaryDown && !this.wasPrimaryDown) {
      this.stopDemo();
      this.phase = 'p2_charging';
      this.p2Charge = 0;
    }

    if (this.phase === 'player_charging') {
      this.charge = Math.min(1, this.charge + deltaSeconds * CHARGE_PER_SECOND);

      if (!primaryDown && this.wasPrimaryDown) {
        this.throwPlayerBall();
      }
    }

    if (this.phase === 'p2_charging') {
      this.p2Charge = Math.min(1, this.p2Charge + deltaSeconds * CHARGE_PER_SECOND);

      if (!primaryDown && this.wasPrimaryDown) {
        this.throwP2Ball();
      }
    }

    if (this.phase === 'player_flying' || this.phase === 'player_rebounded') {
      this.updateShot(delta, deltaSeconds, 'player');
    }

    if (this.phase === 'cpu_flying' || this.phase === 'cpu_rebounded') {
      this.updateShot(delta, deltaSeconds, 'cpu');
    }

    if (this.phase === 'p2_flying' || this.phase === 'p2_rebounded') {
      this.updateShot(delta, deltaSeconds, 'p2');
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

  private updateP2Aim(deltaSeconds: number): void {
    const direction = Number(this.latestInput.aimRight) - Number(this.latestInput.aimLeft);

    if (direction === 0) {
      return;
    }

    this.p2AimOffsetDegrees = Phaser.Math.Clamp(
      this.p2AimOffsetDegrees + direction * AIM_TURN_DEGREES_PER_SECOND * deltaSeconds,
      -26,
      26,
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
    completeMission('tchoukball_first_throw');
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

  private throwP2Ball(): void {
    const baseAimRadians = Phaser.Math.Angle.Between(this.cpuStart.x, this.cpuStart.y, this.cpuTargetFrame.x, this.cpuTargetFrame.y);
    const aimRadians = baseAimRadians + Phaser.Math.DegToRad(this.p2AimOffsetDegrees);
    const speed = Phaser.Math.Linear(MIN_THROW_SPEED, MAX_THROW_SPEED, this.p2Charge);

    this.phase = 'p2_flying';
    this.cpuShot = createEmptyShotState(this.cpuStart);
    this.cpuShot.vx = Math.cos(aimRadians) * speed;
    this.cpuShot.vy = Math.sin(aimRadians) * speed;
    audioManager.playSe('throw');
    completeMission('tchoukball_first_throw');
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
    const landingPoint = side === 'player' ? this.getPlayerLandingPreview() : this.getOpponentLandingPreview(side);
    const angle = Phaser.Math.Angle.Between(shot.x, shot.y, landingPoint.x, landingPoint.y);
    const reboundSpeed = incomingSpeed * REBOUND_SPEED_MULTIPLIER;

    shot.hasHitFrame = true;
    shot.landingX = landingPoint.x;
    shot.landingY = landingPoint.y;
    shot.result = 'none';
    this.phase = side === 'player' ? 'player_rebounded' : side === 'p2' ? 'p2_rebounded' : 'cpu_rebounded';
    this.reboundElapsedMs = 0;
    shot.x = side === 'player' ? Math.max(shot.x, this.playerTargetFrame.x + FRAME_SIZE / 2) : Math.min(shot.x, this.cpuTargetFrame.x - FRAME_SIZE / 2);
    shot.vx = Math.cos(angle) * reboundSpeed;
    shot.vy = Math.sin(angle) * reboundSpeed;
    audioManager.playSe('tagHit');
    completeMission('tchoukball_first_rebound');
  }

  private getPlayerLandingPreview(): Point {
    return {
      x: this.court.left + 70 + this.charge * 360,
      y: this.court.centerY + (this.aimDegrees - 180) * 6.6,
    };
  }

  private getOpponentLandingPreview(side: TchoukballSide): Point {
    if (side === 'p2') {
      return {
        x: this.court.right - 70 - this.p2Charge * 360,
        y: this.court.centerY + this.p2AimOffsetDegrees * 6.6,
      };
    }

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
    this.phase = side === 'player' ? 'player_landed' : side === 'p2' ? 'p2_landed' : 'cpu_landed';
    audioManager.playSe(shot.result === 'valid' ? 'score' : 'fail');

    if (shot.result === 'valid') {
      completeMission('tchoukball_first_valid_landing');
    }

    if (side === 'player') {
      this.queueOpponentTurn();
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
    this.phase = side === 'player' ? 'player_landed' : side === 'p2' ? 'p2_landed' : 'cpu_landed';
    audioManager.playSe('fail');

    if (side === 'player') {
      this.queueOpponentTurn();
    } else {
      this.cpuTimer = this.time.delayedCall(CPU_LANDING_HOLD_MS, () => this.showPreviewResult());
    }
  }

  private queueOpponentTurn(): void {
    if (this.isLocal2P()) {
      this.cpuTimer?.remove(false);
      this.cpuTimer = this.time.delayedCall(PLAYER_LANDING_HOLD_MS, () => {
        this.phase = 'p2_aiming';
        this.p2Charge = 0;
        this.p2AimOffsetDegrees = 0;
        this.cpuShot = createEmptyShotState(this.cpuStart);
      });
      return;
    }

    this.queueCpuThinking();
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

  private buildPreviewLabel(playerScore: number, opponentScore: number): string {
    const opponentLabel = this.getOpponentLabel();
    const p1Label = this.isLocal2P() ? 'P1' : 'Player';

    if (this.phase === 'preview_result' || this.cpuShot.result !== 'none') {
      return `Preview result: ${p1Label} ${playerScore} - ${opponentScore} ${opponentLabel}`;
    }

    if (this.playerShot.result === 'valid') {
      return `Preview result: ${p1Label} +1; ${opponentLabel} reply pending`;
    }

    if (this.playerShot.result !== 'none') {
      return `Preview result: ${p1Label} no point; ${opponentLabel} reply pending`;
    }

    return DEFAULT_SCORING_PREVIEW.label;
  }

  private isLocal2P(): boolean {
    return this.activeMode === 'local_2p';
  }

  private getModeLabel(): string {
    return this.isLocal2P() ? 'Local 2P' : 'VS CPU';
  }

  private getOpponentLabel(): string {
    return this.isLocal2P() ? 'P2' : 'CPU';
  }

  private getPhaseLabel(): string {
    return phaseLabels[this.phase];
  }

  private getScoreLine(): string {
    const p1Label = this.isLocal2P() ? 'P1' : 'Player';

    return `${p1Label} ${this.scoringPreview.playerPreviewScore} - ${this.scoringPreview.cpuPreviewScore} ${this.getOpponentLabel()}`;
  }

  private getTurnLabel(): string {
    if (this.phase.startsWith('cpu')) {
      return 'CPU';
    }

    if (this.phase.startsWith('p2')) {
      return 'P2';
    }

    if (this.phase === 'preview_result') {
      return 'Preview result';
    }

    return this.isLocal2P() ? 'P1' : 'Player';
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
    this.activeMode = matchManager.getMatchState().mode;
    this.phase = 'player_aiming';
    this.charge = 0;
    this.cpuCharge = 0.58;
    this.p2Charge = 0;
    this.p2AimOffsetDegrees = 0;
    this.reboundElapsedMs = 0;
    this.aimDegrees = this.clampedPlayerFrameAim();
    this.playerShot = createEmptyShotState(this.playerStart);
    this.cpuShot = createEmptyShotState(this.cpuStart);
    this.scoringPreview = { ...DEFAULT_SCORING_PREVIEW };
    completeMission(this.isLocal2P() ? 'tchoukball_try_local_2p' : 'tchoukball_try_vs_cpu');
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
    const p2AimRadians = Phaser.Math.Angle.Between(this.cpuStart.x, this.cpuStart.y, this.cpuTargetFrame.x, this.cpuTargetFrame.y) + Phaser.Math.DegToRad(this.p2AimOffsetDegrees);
    const p2AimLength = 136 + this.p2Charge * 52;
    const p2AimEndX = this.cpuStart.x + Math.cos(p2AimRadians) * p2AimLength;
    const p2AimEndY = this.cpuStart.y + Math.sin(p2AimRadians) * p2AimLength;
    const difficulty = difficultyLabels[matchManager.getMatchState().difficulty];

    graphics.clear();

    graphics.lineStyle(4, 0xfacc15, this.isPlayerActive() ? 0.95 : 0.34);
    graphics.beginPath();
    graphics.moveTo(this.playerStart.x, this.playerStart.y);
    graphics.lineTo(aimEndX, aimEndY);
    graphics.strokePath();
    graphics.fillStyle(0xfacc15, 0.9);
    graphics.fillTriangle(aimEndX, aimEndY, aimEndX + 10, aimEndY - 5, aimEndX + 10, aimEndY + 5);

    graphics.lineStyle(4, 0x38bdf8, this.isP2Active() ? 0.95 : this.isLocal2P() ? 0.24 : 0);
    graphics.beginPath();
    graphics.moveTo(this.cpuStart.x, this.cpuStart.y);
    graphics.lineTo(p2AimEndX, p2AimEndY);
    graphics.strokePath();
    graphics.fillStyle(0x38bdf8, 0.9);
    graphics.fillTriangle(p2AimEndX, p2AimEndY, p2AimEndX - 10, p2AimEndY - 5, p2AimEndX - 10, p2AimEndY + 5);

    if (this.phase === 'cpu_thinking' || this.phase === 'cpu_flying' || this.phase === 'cpu_rebounded') {
      this.drawCpuIntent(graphics);
    }

    graphics.lineStyle(5, this.phase === 'player_rebounded' ? 0xfacc15 : 0x38bdf8, this.isPlayerShotMoving() ? 1 : 0.42);
    graphics.strokeRoundedRect(this.playerFrameBounds.x, this.playerFrameBounds.y, this.playerFrameBounds.width, this.playerFrameBounds.height, 10);
    graphics.lineStyle(5, this.phase === 'cpu_rebounded' || this.phase === 'p2_rebounded' ? 0x38bdf8 : 0xfacc15, this.isOpponentShotMoving() ? 1 : 0.42);
    graphics.strokeRoundedRect(this.cpuFrameBounds.x, this.cpuFrameBounds.y, this.cpuFrameBounds.width, this.cpuFrameBounds.height, 10);

    this.drawPowerMeter(graphics);
    this.drawLandingMarker(graphics, this.playerShot, 'player');
    this.drawLandingMarker(graphics, this.cpuShot, 'cpu');
    this.drawShotGraphic(graphics, this.playerShot, 0xf97316, 0xffedd5);
    this.drawShotGraphic(graphics, this.cpuShot, 0x38bdf8, 0xe0f2fe);

    this.phaseText.setText(
      [
        `Mode: ${this.getModeLabel()}`,
        `Turn: ${this.getTurnLabel()}`,
        `Phase: ${this.getPhaseLabel()}`,
        this.isLocal2P() ? null : `CPU difficulty: ${difficulty}`,
        `Preview score: ${this.getScoreLine()}`,
        `${this.isLocal2P() ? 'P1' : 'Player'} landing: ${this.getLandingLabel(this.playerShot.result)}`,
        `${this.getOpponentLabel()} landing: ${this.getLandingLabel(this.cpuShot.result)}`,
      ].filter((line): line is string => line !== null).join('\n'),
    );
    this.hintText.setText(this.getHintText());
    this.landingText
      .setText(this.getLandingPreviewText())
      .setColor(this.getLandingTextColor())
      .setVisible(
        this.phase !== 'player_aiming' &&
          this.phase !== 'player_charging' &&
          this.phase !== 'player_flying' &&
          this.phase !== 'p2_aiming' &&
          this.phase !== 'p2_charging' &&
          this.phase !== 'p2_flying',
      );
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
    const activeCharge = this.phase === 'p2_charging' ? this.p2Charge : this.charge;
    const activeFill = this.phase === 'p2_charging' ? 0x38bdf8 : 0xfacc15;

    graphics.fillStyle(0x020617, 0.48);
    graphics.fillRoundedRect(meterX, meterY, meterWidth, meterHeight, 7);
    graphics.fillStyle(activeFill, 0.92);
    graphics.fillRoundedRect(meterX, meterY, meterWidth * activeCharge, meterHeight, 7);
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
      return `${this.isLocal2P() ? 'P1' : 'Player'} landing preview`;
    }

    if (this.phase === 'player_landed') {
      return `${this.isLocal2P() ? 'P1' : 'Player'} landing: ${this.getLandingLabel(this.playerShot.result)}\n${this.scoringPreview.label}`;
    }

    if (this.phase === 'cpu_thinking') {
      return 'CPU thinking — automatic reply incoming';
    }

    if (this.phase === 'cpu_rebounded' || this.phase === 'p2_rebounded') {
      return `${this.getOpponentLabel()} landing preview`;
    }

    if (this.phase === 'cpu_landed' || this.phase === 'p2_landed') {
      return `${this.getOpponentLabel()} landing: ${this.getLandingLabel(this.cpuShot.result)}\n${this.scoringPreview.label}`;
    }

    if (this.phase === 'preview_result') {
      return this.scoringPreview.label;
    }

    return this.scoringPreview.label;
  }

  private getLandingTextColor(): string {
    const activeResult = this.phase === 'cpu_landed' || this.phase === 'p2_landed' || this.phase === 'preview_result' ? this.cpuShot.result : this.playerShot.result;

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
      return 'Valid preview';
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
    if (this.phase === 'player_charging' || this.phase === 'p2_charging') {
      return 'Charging power — release Space / Enter / Primary to throw';
    }

    if (this.phase === 'player_flying') {
      return `${this.isLocal2P() ? 'P1' : 'Player'} shot flying toward the rebound frame`;
    }

    if (this.phase === 'p2_flying') {
      return 'P2 shot flying toward the opposite rebound frame';
    }

    if (this.phase === 'player_rebounded') {
      return `${this.isLocal2P() ? 'P1' : 'Player'} rebound — previewing the landing zone`;
    }

    if (this.phase === 'p2_rebounded') {
      return 'P2 rebound — previewing the landing zone';
    }

    if (this.phase === 'player_landed') {
      return this.isLocal2P() ? 'P1 preview locked. P2 can take one local rebound shot.' : 'Player preview locked. CPU will take one automatic rebound shot.';
    }

    if (this.phase === 'cpu_thinking') {
      return 'Player preview locked. CPU will take one automatic rebound shot.';
    }

    if (this.phase === 'cpu_flying') {
      return 'CPU shot is flying toward the opposite rebound frame';
    }

    if (this.phase === 'cpu_rebounded') {
      return 'CPU rebound — previewing its landing zone';
    }

    if (this.phase === 'cpu_landed' || this.phase === 'p2_landed') {
      return `${this.getOpponentLabel()} preview locked. Building preview score comparison.`;
    }

    if (this.phase === 'preview_result') {
      return 'Preview result only. Press Primary or Retry to reset; no full match system yet.';
    }

    return 'Hit the frame, then land outside the forbidden zone. Aim with A / D or ← / →, hold Primary to charge.';
  }

  private startDemo(slow: boolean): void {
    this.demoActive = true;
    this.demoSlow = slow;
    this.demoElapsedMs = 0;
    this.demoDurationMs = slow ? SLOW_DEMO_DURATION_MS : DEMO_DURATION_MS;
    this.demoGraphics?.clear();
    this.demoText?.setText('');
    completeMission('tchoukball_watch_demo');
    this.updateDemo(0);
  }

  private stopDemo(): void {
    if (!this.demoActive && !this.demoGraphics && !this.demoText) {
      return;
    }

    this.demoActive = false;
    this.demoElapsedMs = 0;
    this.demoGraphics?.clear();
    this.demoText?.setText('');
    this.dispatchDemoStatus('idle', false);
  }

  private updateDemo(deltaMs: number): void {
    this.demoElapsedMs = (this.demoElapsedMs + deltaMs) % this.demoDurationMs;
    this.drawDemoOverlay();
  }

  private getDemoStep(progress: number): TchoukballDemoStep {
    if (progress < 0.18) return 'aim';
    if (progress < 0.33) return 'charge';
    if (progress < 0.48) return 'throw';
    if (progress < 0.64) return 'rebound';
    if (progress < 0.8) return 'landing';
    return 'reply';
  }

  private getDemoStepIndex(step: TchoukballDemoStep): number {
    const order: TchoukballDemoStep[] = ['aim', 'charge', 'throw', 'rebound', 'landing', 'reply'];
    return Math.max(0, order.indexOf(step)) + 1;
  }

  private dispatchDemoStatus(step: TchoukballDemoStep, active: boolean): void {
    const copy = demoStepCopy[step];

    window.dispatchEvent(
      new CustomEvent('tchoukball:demo-status', {
        detail: {
          active,
          step,
          stepIndex: active ? this.getDemoStepIndex(step) : 0,
          totalSteps: DEMO_STEP_COUNT,
          title: copy.title,
          status: copy.status,
          slow: this.demoSlow,
        },
      }),
    );
  }

  private drawDemoOverlay(): void {
    if (!this.demoGraphics) {
      this.demoGraphics = this.add.graphics().setDepth(18);
    }

    if (!this.demoText) {
      this.demoText = this.add
        .text(this.court.left + 18, this.court.top + 18, '', {
          color: '#f8fafc',
          fontFamily: 'Inter, sans-serif',
          fontSize: '14px',
          fontStyle: 'bold',
          lineSpacing: 4,
          padding: { x: 12, y: 10 },
          wordWrap: { width: 300 },
        })
        .setDepth(19);
    }

    const progress = this.demoElapsedMs / this.demoDurationMs;
    const step = this.getDemoStep(progress);
    const stepIndex = this.getDemoStepIndex(step);
    const segmentStart: Record<TchoukballDemoStep, number> = {
      idle: 0,
      aim: 0,
      charge: 0.18,
      throw: 0.33,
      rebound: 0.48,
      landing: 0.64,
      reply: 0.8,
    };
    const segmentEnd: Record<TchoukballDemoStep, number> = {
      idle: 0,
      aim: 0.18,
      charge: 0.33,
      throw: 0.48,
      rebound: 0.64,
      landing: 0.8,
      reply: 1,
    };
    const stepT = Phaser.Math.Clamp((progress - segmentStart[step]) / (segmentEnd[step] - segmentStart[step]), 0, 1);
    const easedT = Phaser.Math.SmoothStep(stepT, 0, 1);
    const playerFrameContact = { x: this.playerTargetFrame.x + FRAME_SIZE / 2, y: this.playerTargetFrame.y };
    const playerLanding = { x: this.court.left + 320, y: this.court.centerY + 92 };
    const replyFrameContact = { x: this.cpuTargetFrame.x - FRAME_SIZE / 2, y: this.cpuTargetFrame.y };
    const replyLanding = { x: this.court.right - 330, y: this.court.centerY - 82 };
    const throwT = step === 'throw' ? easedT : stepIndex > 3 ? 1 : 0;
    const reboundT = step === 'rebound' ? easedT : stepIndex > 4 ? 1 : 0;
    const replyT = step === 'reply' ? easedT : 0;
    const chargeFill = step === 'charge' ? Phaser.Math.Clamp(0.18 + stepT * 0.68, 0, 0.86) : stepIndex > 2 ? 0.78 : 0.16;
    const ghostX = stepIndex <= 3
      ? Phaser.Math.Linear(this.playerStart.x, playerFrameContact.x, throwT)
      : Phaser.Math.Linear(playerFrameContact.x, playerLanding.x, reboundT);
    const ghostY = stepIndex <= 3
      ? Phaser.Math.Linear(this.playerStart.y, playerFrameContact.y, throwT)
      : Phaser.Math.Linear(playerFrameContact.y, playerLanding.y, reboundT);
    const replyX = replyT < 0.5
      ? Phaser.Math.Linear(this.cpuStart.x, replyFrameContact.x, replyT * 2)
      : Phaser.Math.Linear(replyFrameContact.x, replyLanding.x, (replyT - 0.5) * 2);
    const replyY = replyT < 0.5
      ? Phaser.Math.Linear(this.cpuStart.y, replyFrameContact.y, replyT * 2)
      : Phaser.Math.Linear(replyFrameContact.y, replyLanding.y, (replyT - 0.5) * 2);
    const aimAngle = Phaser.Math.Angle.Between(this.playerStart.x, this.playerStart.y, this.playerTargetFrame.x, this.playerTargetFrame.y);
    const aimEndX = this.playerStart.x + Math.cos(aimAngle) * 168;
    const aimEndY = this.playerStart.y + Math.sin(aimAngle) * 168;
    const meterX = this.court.right - 196;
    const meterY = this.court.top + 24;
    const textWidth = Math.min(330, Math.max(250, this.court.width * 0.48));
    const copy = demoStepCopy[step];

    this.demoGraphics.clear();
    this.demoGraphics.fillStyle(0x020617, 0.8);
    this.demoGraphics.fillRoundedRect(this.court.left + 12, this.court.top + 12, textWidth + 26, 124, 14);
    this.demoGraphics.lineStyle(2, 0x7dd3fc, 0.56);
    this.demoGraphics.strokeRoundedRect(this.court.left + 12, this.court.top + 12, textWidth + 26, 124, 14);

    this.demoGraphics.lineStyle(4, 0xfacc15, step === 'aim' ? 1 : 0.45);
    this.demoGraphics.lineBetween(this.playerStart.x, this.playerStart.y, aimEndX, aimEndY);
    this.demoGraphics.fillStyle(0xfacc15, 0.9);
    this.demoGraphics.fillCircle(aimEndX, aimEndY, step === 'aim' ? 12 + Math.sin(stepT * Math.PI * 4) * 3 : 8);

    this.demoGraphics.fillStyle(0x020617, 0.52);
    this.demoGraphics.fillRoundedRect(meterX, meterY, 156, 14, 7);
    this.demoGraphics.fillStyle(0xfacc15, 0.82);
    this.demoGraphics.fillRoundedRect(meterX, meterY, 156 * chargeFill, 14, 7);
    this.demoGraphics.lineStyle(step === 'charge' ? 4 : 2, 0xfacc15, step === 'charge' ? 0.95 : 0.55);
    this.demoGraphics.strokeRoundedRect(meterX - 7, meterY - 7, 170, 28, 10);

    this.demoGraphics.lineStyle(3, 0xf97316, step === 'throw' || step === 'rebound' ? 0.9 : 0.4);
    this.demoGraphics.lineBetween(this.playerStart.x, this.playerStart.y, playerFrameContact.x, playerFrameContact.y);
    this.demoGraphics.lineStyle(3, 0x84cc16, step === 'rebound' || step === 'landing' ? 0.95 : 0.45);
    this.demoGraphics.lineBetween(playerFrameContact.x, playerFrameContact.y, playerLanding.x, playerLanding.y);

    this.demoGraphics.fillStyle(0xf97316, 0.62);
    this.demoGraphics.fillCircle(ghostX, ghostY, BALL_RADIUS + 2);
    this.demoGraphics.lineStyle(3, 0xffedd5, 0.9);
    this.demoGraphics.strokeCircle(ghostX, ghostY, BALL_RADIUS + (step === 'throw' || step === 'rebound' ? 8 : 3));

    if (step === 'landing' || step === 'reply') {
      this.demoGraphics.fillStyle(0x84cc16, 0.24);
      this.demoGraphics.fillCircle(playerLanding.x, playerLanding.y, 30);
      this.demoGraphics.lineStyle(4, 0xbef264, 0.95);
      this.demoGraphics.strokeCircle(playerLanding.x, playerLanding.y, 30 + Math.sin(stepT * Math.PI * 4) * 3);
    }

    if (step === 'reply') {
      this.demoGraphics.lineStyle(3, 0x38bdf8, 0.9);
      this.demoGraphics.lineBetween(this.cpuStart.x, this.cpuStart.y, replyFrameContact.x, replyFrameContact.y);
      this.demoGraphics.lineStyle(3, 0x93c5fd, 0.8);
      this.demoGraphics.lineBetween(replyFrameContact.x, replyFrameContact.y, replyLanding.x, replyLanding.y);
      this.demoGraphics.fillStyle(0x38bdf8, 0.66);
      this.demoGraphics.fillCircle(replyX, replyY, BALL_RADIUS + 2);
      this.demoGraphics.lineStyle(3, 0xe0f2fe, 0.92);
      this.demoGraphics.strokeCircle(replyX, replyY, BALL_RADIUS + 8);
      this.demoGraphics.strokeRoundedRect(this.court.centerX - 130, this.court.top + 48, 260, 72, 12);
    }

    this.demoText.setWordWrapWidth(textWidth);
    this.demoText.setPosition(this.court.left + 18, this.court.top + 18);
    this.demoText.setText(`${copy.title}\n${copy.body}`);
    this.dispatchDemoStatus(step, true);
  }

  private isPlayerActive(): boolean {
    return this.phase === 'player_aiming' || this.phase === 'player_charging' || this.phase === 'player_flying' || this.phase === 'player_rebounded';
  }

  private isPlayerShotMoving(): boolean {
    return this.phase === 'player_flying' || this.phase === 'player_rebounded';
  }

  private isP2Active(): boolean {
    return this.phase === 'p2_aiming' || this.phase === 'p2_charging' || this.phase === 'p2_flying' || this.phase === 'p2_rebounded';
  }

  private isOpponentShotMoving(): boolean {
    return this.phase === 'cpu_flying' || this.phase === 'cpu_rebounded' || this.phase === 'p2_flying' || this.phase === 'p2_rebounded';
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

    this.add.text(centerX, 52, 'VS CPU or Local 2P rebound shots, landing classification, and preview comparison — no full rules yet', {
      align: 'center',
      color: '#bae6fd',
      fontFamily: 'Inter, sans-serif',
      fontSize: '14px',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(courtX + 28, courtY + 12, 'P1 target frame', this.labelStyle()).setOrigin(0, 0);
    this.add.text(courtX + COURT_WIDTH - 28, courtY + 12, 'P2 / CPU target frame', this.labelStyle()).setOrigin(1, 0);
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
