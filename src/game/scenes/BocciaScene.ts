import Phaser from 'phaser';
import { audioManager } from '../../audio/audioManager';
import { matchManager } from '../match/matchManager';
import { inputManager } from '../../input/inputManager';
import type { InputState } from '../../input/types';
import { completeMission, markSportPlayed } from '../../progress/progressManager';
import { BOCCIA_CONFIG, BOCCIA_PLACEHOLDERS } from '../sports/boccia/bocciaConfig';
import type { MatchMode } from '../types';

type BocciaPhase =
  | 'p1_aiming'
  | 'p1_charging'
  | 'p1_rolling'
  | 'p2_aiming'
  | 'p2_charging'
  | 'p2_rolling'
  | 'cpu_thinking'
  | 'cpu_rolling'
  | 'scoring_preview';
type BocciaSide = 'player' | 'opponent';

interface BocciaBallState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  isThrown: boolean;
  side: BocciaSide;
}

interface BocciaScoringBall {
  id: string;
  side: BocciaSide;
  x: number;
  y: number;
}

interface BocciaScoredBall extends BocciaScoringBall {
  distance: number;
}

interface BocciaScoringPreview {
  closestSide: BocciaSide | 'draw';
  closestBallId: string | null;
  playerScore: number;
  opponentScore: number;
  closestDistance: number | null;
  label: string;
}

interface BallVisual {
  id?: string;
  side?: BocciaSide;
  x: number;
  y: number;
  color: number;
  label: string;
}

const phaseLabels: Record<BocciaPhase, string> = {
  p1_aiming: 'P1 aiming',
  p1_charging: 'P1 charging',
  p1_rolling: 'P1 rolling',
  p2_aiming: 'P2 aiming',
  p2_charging: 'P2 charging',
  p2_rolling: 'P2 rolling',
  cpu_thinking: 'CPU thinking',
  cpu_rolling: 'CPU rolling',
  scoring_preview: 'Scoring preview',
};

const sideLabels: Record<BocciaSide, string> = {
  player: 'P1',
  opponent: 'Opponent',
};

const difficultyLabels = {
  easy: 'Easy',
  normal: 'Normal',
  hard: 'Hard',
} as const;

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
const tieDistanceTolerance = 0.5;
const cpuThinkingDelayMs = 700;

const cpuErrorByDifficulty = {
  easy: { aim: 0.35, power: 0.3 },
  normal: { aim: 0.2, power: 0.18 },
  hard: { aim: 0.1, power: 0.1 },
} as const;

export class BocciaScene extends Phaser.Scene {
  private courtBounds = new Phaser.Geom.Rectangle(0, 0, 0, 0);

  private phase: BocciaPhase = 'p1_aiming';

  private activeMode: MatchMode = matchManager.getMatchState().mode;

  private aimAngle = Phaser.Math.DegToRad(-5);

  private power = 0;

  private powerDirection: 1 | -1 = 1;

  private previousPrimary = false;

  private playerStart = { x: 0, y: 0 };

  private opponentStart = { x: 0, y: 0 };

  private cpuThinkingEvent?: Phaser.Time.TimerEvent;

  private cpuNote = 'CPU waits for the player throw.';

  private jackPosition = { x: 0, y: 0 };


  private staticBallCircles = new Map<string, Phaser.GameObjects.Arc>();

  private scoringPreview: BocciaScoringPreview | null = null;

  private playerBall: BocciaBallState = {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    isThrown: false,
    side: 'player',
  };

  private opponentBall: BocciaBallState = {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    isThrown: false,
    side: 'opponent',
  };

  private aimGraphics?: Phaser.GameObjects.Graphics;

  private powerGraphics?: Phaser.GameObjects.Graphics;

  private scoringGraphics?: Phaser.GameObjects.Graphics;

  private playerBallShadow?: Phaser.GameObjects.Arc;

  private playerBallCircle?: Phaser.GameObjects.Arc;

  private playerBallLabel?: Phaser.GameObjects.Text;

  private opponentBallShadow?: Phaser.GameObjects.Arc;

  private opponentBallCircle?: Phaser.GameObjects.Arc;

  private opponentBallLabel?: Phaser.GameObjects.Text;

  private phaseText?: Phaser.GameObjects.Text;

  private powerText?: Phaser.GameObjects.Text;

  private hintText?: Phaser.GameObjects.Text;

  private scoringText?: Phaser.GameObjects.Text;

  private readonly handleRetryRequest = (): void => {
    this.resetThrowPreview();
  };

  constructor() {
    super('BocciaScene');
  }

  create() {
    markSportPlayed('boccia');
    completeMission('boccia_shell_visit');

    this.cameras.main.setBackgroundColor('#101827');
    this.drawSceneFoundation();
    window.addEventListener('boccia:retry', this.handleRetryRequest);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.cpuThinkingEvent?.remove(false);
      window.removeEventListener('boccia:retry', this.handleRetryRequest);
    });
  }

  update(_: number, delta: number): void {
    const input = inputManager.getInputState();
    const deltaSeconds = Math.min(delta / 1000, 0.05);

    this.syncModeChange();

    if (document.body.hasAttribute('data-tutorial-open')) {
      this.previousPrimary = input.primary;
      return;
    }

    this.updateAim(input, deltaSeconds);
    this.updateCharge(input, deltaSeconds);
    this.updateRollingBalls(deltaSeconds);
    this.previousPrimary = input.primary;
  }

  private drawSceneFoundation(): void {
    const { width } = this.scale;
    const courtX = (width - BOCCIA_CONFIG.court.width) / 2;
    const courtY = 72;
    const staticGraphics = this.add.graphics();

    this.courtBounds.setTo(courtX, courtY, BOCCIA_CONFIG.court.width, BOCCIA_CONFIG.court.height);
    this.playerStart = {
      x: courtX + BOCCIA_CONFIG.throwingArea.width - 36,
      y: courtY + BOCCIA_CONFIG.court.height / 2,
    };
    this.opponentStart = {
      x: courtX + BOCCIA_CONFIG.throwingArea.width - 36,
      y: courtY + BOCCIA_CONFIG.court.height / 2 + 34,
    };
    this.playerBall = {
      ...this.playerStart,
      vx: 0,
      vy: 0,
      isThrown: false,
      side: 'player',
    };
    this.opponentBall = {
      ...this.opponentStart,
      vx: 0,
      vy: 0,
      isThrown: false,
      side: 'opponent',
    };

    this.add
      .text(width / 2, 26, 'Boccia Match Preview', {
        color: '#f8fafc',
        fontFamily: 'Arial, sans-serif',
        fontSize: '24px',
        fontStyle: '700',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, 52, `${BOCCIA_PLACEHOLDERS.objective} VS CPU or Local 2P throws once each for preview scoring.`, {
        color: '#bae6fd',
        fontFamily: 'Arial, sans-serif',
        fontSize: '13px',
      })
      .setOrigin(0.5);

    this.drawCourt(staticGraphics, courtX, courtY);
    this.drawBalls(courtX, courtY);
    this.aimGraphics = this.add.graphics();
    this.powerGraphics = this.add.graphics();
    this.scoringGraphics = this.add.graphics();
    this.drawHudLabels(courtX, courtY);
    this.redrawAimLine();
    this.redrawPowerMeter();
    this.refreshHudLabels();
    this.updateShellScoringHud();
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

    this.staticBallCircles.clear();

    const ballVisuals: BallVisual[] = [
      {
        x: courtX + court.width * 0.63,
        y: centerY - 12,
        color: balls.jackColor,
        label: 'Jack',
      },
    ];

    this.jackPosition = { x: ballVisuals[0].x, y: ballVisuals[0].y };
    ballVisuals.forEach((ball) => {
      const radius = ball.label === 'Jack' ? balls.jackRadius : balls.ballRadius;
      this.add.circle(ball.x, ball.y, radius + 2, balls.strokeColor, 0.45);
      const circle = this.add.circle(ball.x, ball.y, radius, ball.color, 1).setStrokeStyle(2, balls.strokeColor, 0.7);
      if (ball.id) {
        this.staticBallCircles.set(ball.id, circle);
      }
      this.addLabel(ball.label, ball.x, ball.y + radius + 13, '#e5edf8');
    });

    this.playerBallShadow = this.add.circle(this.playerBall.x, this.playerBall.y, balls.ballRadius + 2, balls.strokeColor, 0.24);
    this.playerBallCircle = this.add
      .circle(this.playerBall.x, this.playerBall.y, balls.ballRadius, balls.playerColor, 1)
      .setStrokeStyle(2, balls.strokeColor, 0.9);
    this.playerBallLabel = this.addLabel('P1', this.playerBall.x, this.playerBall.y + balls.ballRadius + 13, '#e5edf8');

    this.opponentBallShadow = this.add.circle(this.opponentBall.x, this.opponentBall.y, balls.ballRadius + 2, balls.strokeColor, 0.24);
    this.opponentBallCircle = this.add
      .circle(this.opponentBall.x, this.opponentBall.y, balls.ballRadius, balls.opponentColor, 1)
      .setStrokeStyle(2, balls.strokeColor, 0.9);
    this.opponentBallLabel = this.addLabel(this.getOpponentBallLabel(), this.opponentBall.x, this.opponentBall.y + balls.ballRadius + 13, '#e5edf8');
  }

  private redrawAimLine(): void {
    if (!this.aimGraphics || !this.isHumanAimingPhase()) {
      this.aimGraphics?.clear();
      return;
    }

    const { aimLine } = BOCCIA_CONFIG;
    const aimingBall = this.getCurrentHumanBall();
    const startX = aimingBall.x;
    const startY = aimingBall.y;
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
    this.powerGraphics.fillStyle(powerMeter.fillColor, this.isHumanChargingPhase() ? 0.95 : 0.62);
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

    this.scoringText = this.add.text(hudX, hudY + 52, '', {
      color: '#fde68a',
      fontFamily: 'Arial, sans-serif',
      fontSize: '12px',
      lineSpacing: 5,
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

  private syncModeChange(): void {
    const nextMode = matchManager.getMatchState().mode;

    if (nextMode === this.activeMode) {
      return;
    }

    this.activeMode = nextMode;
    this.resetThrowPreview();
  }

  private isLocal2P(): boolean {
    return this.activeMode === 'local_2p';
  }

  private isHumanAimingPhase(): boolean {
    return (
      this.phase === 'p1_aiming' ||
      this.phase === 'p1_charging' ||
      this.phase === 'p2_aiming' ||
      this.phase === 'p2_charging'
    );
  }

  private isHumanChargingPhase(): boolean {
    return this.phase === 'p1_charging' || this.phase === 'p2_charging';
  }

  private getCurrentHumanBall(): BocciaBallState {
    return this.phase === 'p2_aiming' || this.phase === 'p2_charging' ? this.opponentBall : this.playerBall;
  }

  private getOpponentBallLabel(): string {
    return this.isLocal2P() ? 'P2' : 'CPU';
  }

  private getOpponentSideLabel(): string {
    return this.isLocal2P() ? 'P2' : 'Opponent';
  }

  private getSideLabel(side: BocciaSide): string {
    return side === 'player' ? sideLabels.player : this.getOpponentSideLabel();
  }

  private getModeLabel(): string {
    return this.isLocal2P() ? 'Local 2P' : 'VS CPU';
  }

  private updateAim(input: InputState, deltaSeconds: number): void {
    if (!this.isHumanAimingPhase()) {
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
    if (!this.isHumanAimingPhase()) {
      return;
    }

    if (input.primary) {
      if (!this.previousPrimary) {
        this.setPhase(this.phase === 'p2_aiming' ? 'p2_charging' : 'p1_charging');
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

    if (this.previousPrimary && this.isHumanChargingPhase()) {
      this.throwBall();
    }
  }

  private throwBall(): void {
    const throwPower = Math.max(this.power, 0.08);
    const speed = Phaser.Math.Linear(minThrowSpeed, maxThrowSpeed, throwPower);

    this.scoringPreview = null;
    this.scoringGraphics?.clear();
    this.resetBallHighlight();
    const ball = this.getCurrentHumanBall();

    ball.vx = Math.cos(this.aimAngle) * speed;
    ball.vy = Math.sin(this.aimAngle) * speed;
    ball.isThrown = true;
    this.setPhase(ball.side === 'opponent' ? 'p2_rolling' : 'p1_rolling');
    this.aimGraphics?.clear();
    this.updateShellScoringHud();
    audioManager.playSe('throw');
  }

  private updateRollingBalls(deltaSeconds: number): void {
    if (this.phase === 'p1_rolling') {
      this.updateRollingBall(this.playerBall, deltaSeconds);
      this.syncPlayerBallVisuals();

      if (this.isBallStopped(this.playerBall)) {
        this.stopBall(this.playerBall);
        this.syncPlayerBallVisuals();
        if (this.isLocal2P()) {
          this.startP2Turn();
        } else {
          this.startCpuThinking();
        }
      }
    }

    if (this.phase === 'cpu_rolling' || this.phase === 'p2_rolling') {
      this.updateRollingBall(this.opponentBall, deltaSeconds);
      this.syncOpponentBallVisuals();

      if (this.isBallStopped(this.opponentBall)) {
        this.stopBall(this.opponentBall);
        this.syncOpponentBallVisuals();
        this.setPhase('scoring_preview');
        this.calculateScoringPreview();
      }
    }
  }

  private updateRollingBall(ball: BocciaBallState, deltaSeconds: number): void {
    const radius = BOCCIA_CONFIG.balls.ballRadius;
    const friction = Math.pow(frictionPerSixtyFpsFrame, deltaSeconds * 60);

    ball.x += ball.vx * deltaSeconds;
    ball.y += ball.vy * deltaSeconds;
    ball.vx *= friction;
    ball.vy *= friction;

    if (ball.x < this.courtBounds.left + radius) {
      ball.x = this.courtBounds.left + radius;
      ball.vx = Math.abs(ball.vx) * 0.35;
    } else if (ball.x > this.courtBounds.right - radius) {
      ball.x = this.courtBounds.right - radius;
      ball.vx = -Math.abs(ball.vx) * 0.35;
    }

    if (ball.y < this.courtBounds.top + radius) {
      ball.y = this.courtBounds.top + radius;
      ball.vy = Math.abs(ball.vy) * 0.35;
    } else if (ball.y > this.courtBounds.bottom - radius) {
      ball.y = this.courtBounds.bottom - radius;
      ball.vy = -Math.abs(ball.vy) * 0.35;
    }
  }

  private isBallStopped(ball: BocciaBallState): boolean {
    return Math.hypot(ball.vx, ball.vy) <= stopSpeed;
  }

  private stopBall(ball: BocciaBallState): void {
    ball.vx = 0;
    ball.vy = 0;
  }

  private syncPlayerBallVisuals(): void {
    this.playerBallShadow?.setPosition(this.playerBall.x, this.playerBall.y);
    this.playerBallCircle?.setPosition(this.playerBall.x, this.playerBall.y);
    this.playerBallLabel?.setPosition(this.playerBall.x, this.playerBall.y + BOCCIA_CONFIG.balls.ballRadius + 13);
  }

  private syncOpponentBallVisuals(): void {
    this.opponentBallShadow?.setPosition(this.opponentBall.x, this.opponentBall.y);
    this.opponentBallCircle?.setPosition(this.opponentBall.x, this.opponentBall.y);
    this.opponentBallLabel?.setPosition(this.opponentBall.x, this.opponentBall.y + BOCCIA_CONFIG.balls.ballRadius + 13);
  }

  private startP2Turn(): void {
    this.cpuNote = 'Local 2P: P2 uses the same controls for the blue ball.';
    this.aimAngle = Phaser.Math.DegToRad(-5);
    this.power = 0;
    this.powerDirection = 1;
    this.previousPrimary = false;
    this.setPhase('p2_aiming');
    this.redrawAimLine();
    this.redrawPowerMeter();
  }

  private startCpuThinking(): void {
    this.cpuNote = 'CPU is aiming near the jack.';
    this.cpuThinkingEvent?.remove(false);
    this.setPhase('cpu_thinking');
    audioManager.playSe('select');
    this.cpuThinkingEvent = this.time.delayedCall(cpuThinkingDelayMs, () => {
      this.cpuThinkingEvent = undefined;
      this.throwCpuBall();
    });
  }

  private throwCpuBall(): void {
    const difficulty = matchManager.getMatchState().difficulty;
    const error = cpuErrorByDifficulty[difficulty];
    const baseTarget = this.chooseCpuTarget();
    const target = {
      x: baseTarget.x + Phaser.Math.FloatBetween(-1, 1) * error.aim * 120,
      y: baseTarget.y + Phaser.Math.FloatBetween(-1, 1) * error.aim * 120,
    };
    const dx = target.x - this.opponentBall.x;
    const dy = target.y - this.opponentBall.y;
    const angle = Math.atan2(dy, dx);
    const distance = Math.hypot(dx, dy);
    const estimatedTravelScale = 1.05;
    const baseSpeed = Phaser.Math.Clamp(distance / estimatedTravelScale, minThrowSpeed, maxThrowSpeed);
    const speed = Phaser.Math.Clamp(
      baseSpeed * (1 + Phaser.Math.FloatBetween(-error.power, error.power)),
      minThrowSpeed,
      maxThrowSpeed,
    );

    this.opponentBall.vx = Math.cos(angle) * speed;
    this.opponentBall.vy = Math.sin(angle) * speed;
    this.opponentBall.isThrown = true;
    this.cpuNote = `${difficultyLabels[difficulty]} CPU aimed near the jack.`;
    this.setPhase('cpu_rolling');
    audioManager.playSe('throw');
  }

  private chooseCpuTarget(): { x: number; y: number } {
    const playerDistance = Phaser.Math.Distance.Between(
      this.playerBall.x,
      this.playerBall.y,
      this.jackPosition.x,
      this.jackPosition.y,
    );

    if (this.playerBall.isThrown && playerDistance < BOCCIA_CONFIG.court.width * 0.24) {
      return {
        x: Phaser.Math.Linear(this.playerBall.x, this.jackPosition.x, 0.64),
        y: Phaser.Math.Linear(this.playerBall.y, this.jackPosition.y, 0.64),
      };
    }

    return { ...this.jackPosition };
  }

  private setPhase(phase: BocciaPhase): void {
    if (this.phase === phase) {
      return;
    }

    this.phase = phase;

    if (phase === 'p1_aiming' || phase === 'p1_charging' || phase === 'p1_rolling') {
      matchManager.setTurn('player', 1);
    }

    if (phase === 'p2_aiming' || phase === 'p2_charging' || phase === 'p2_rolling' || phase === 'cpu_thinking' || phase === 'cpu_rolling') {
      matchManager.setTurn('opponent', 2);
    }

    this.refreshHudLabels();
    this.redrawPowerMeter();
    this.updateShellScoringHud();
  }

  private getScoringBalls(): BocciaScoringBall[] {
    const scoringBalls: BocciaScoringBall[] = [];

    if (this.playerBall.isThrown) {
      scoringBalls.push({
        id: 'player-1',
        side: 'player',
        x: this.playerBall.x,
        y: this.playerBall.y,
      });
    }

    if (this.opponentBall.isThrown) {
      scoringBalls.push({
        id: this.isLocal2P() ? 'p2-1' : 'cpu-1',
        side: 'opponent',
        x: this.opponentBall.x,
        y: this.opponentBall.y,
      });
    }

    return scoringBalls;
  }

  private distanceToJack(ball: BocciaScoringBall): number {
    return Phaser.Math.Distance.Between(ball.x, ball.y, this.jackPosition.x, this.jackPosition.y);
  }

  private calculateScoringPreview(): void {
    const scoredBalls = this.getScoringBalls()
      .map((ball): BocciaScoredBall => ({ ...ball, distance: this.distanceToJack(ball) }))
      .sort((a, b) => a.distance - b.distance);

    if (scoredBalls.length < 2) {
      return;
    }
    const closestPlayerDistance = Math.min(
      ...scoredBalls.filter((ball) => ball.side === 'player').map((ball) => ball.distance),
    );
    const closestOpponentDistance = Math.min(
      ...scoredBalls.filter((ball) => ball.side === 'opponent').map((ball) => ball.distance),
    );
    const closestBall = scoredBalls[0];
    const isTie = Math.abs(closestPlayerDistance - closestOpponentDistance) <= tieDistanceTolerance;
    let playerScore = 0;
    let opponentScore = 0;
    let closestSide: BocciaScoringPreview['closestSide'] = closestBall.side;
    let label = 'Draw / no preview score';

    if (isTie) {
      closestSide = 'draw';
    } else if (closestBall.side === 'player') {
      playerScore = scoredBalls.filter(
        (ball) => ball.side === 'player' && ball.distance < closestOpponentDistance - tieDistanceTolerance,
      ).length;
      label = `P1 +${playerScore}`;
    } else {
      opponentScore = scoredBalls.filter(
        (ball) => ball.side === 'opponent' && ball.distance < closestPlayerDistance - tieDistanceTolerance,
      ).length;
      label = `${this.getOpponentSideLabel()} +${opponentScore}`;
    }

    this.scoringPreview = {
      closestSide,
      closestBallId: isTie ? null : closestBall.id,
      playerScore,
      opponentScore,
      closestDistance: isTie ? null : closestBall.distance,
      label,
    };

    matchManager.setScore(playerScore, opponentScore);
    matchManager.setResultPreview(this.getResultPreviewText());
    this.drawScoringFeedback(scoredBalls);
    this.refreshHudLabels();
    this.updateShellScoringHud();
    if (closestSide === 'player') {
      audioManager.playSe('score');
    } else if (closestSide === 'opponent') {
      audioManager.playSe('fail');
    }
  }

  private drawScoringFeedback(scoredBalls: BocciaScoredBall[]): void {
    const closestBall = scoredBalls.find((ball) => ball.id === this.scoringPreview?.closestBallId);

    this.scoringGraphics?.clear();
    this.resetBallHighlight();

    if (!closestBall || !this.scoringPreview?.closestDistance) {
      return;
    }

    const { balls } = BOCCIA_CONFIG;
    const highlightColor = closestBall.side === 'player' ? 0xfde047 : 0x93c5fd;

    this.scoringGraphics?.lineStyle(2, highlightColor, 0.76);
    this.scoringGraphics?.lineBetween(this.jackPosition.x, this.jackPosition.y, closestBall.x, closestBall.y);
    this.scoringGraphics?.strokeCircle(closestBall.x, closestBall.y, balls.ballRadius + 8);

    if (closestBall.side === 'player') {
      this.playerBallCircle?.setStrokeStyle(4, highlightColor, 1);
      return;
    }

    if (closestBall.id === 'cpu-1' || closestBall.id === 'p2-1') {
      this.opponentBallCircle?.setStrokeStyle(4, highlightColor, 1);
      return;
    }

    this.staticBallCircles.get(closestBall.id)?.setStrokeStyle(4, highlightColor, 1);
  }

  private resetBallHighlight(): void {
    const { balls } = BOCCIA_CONFIG;

    this.playerBallCircle?.setStrokeStyle(2, balls.strokeColor, 0.9);
    this.opponentBallCircle?.setStrokeStyle(2, balls.strokeColor, 0.9);
    this.staticBallCircles.forEach((circle) => {
      circle.setStrokeStyle(2, balls.strokeColor, 0.7);
    });
  }

  private resetThrowPreview(): void {
    this.activeMode = matchManager.getMatchState().mode;
    this.cpuThinkingEvent?.remove(false);
    this.cpuThinkingEvent = undefined;
    this.phase = 'p1_aiming';
    this.aimAngle = Phaser.Math.DegToRad(-5);
    this.power = 0;
    this.powerDirection = 1;
    this.previousPrimary = false;
    this.cpuNote = this.isLocal2P() ? 'Local 2P waits for P1 to throw.' : 'CPU waits for the player throw.';
    this.playerBall = {
      ...this.playerStart,
      vx: 0,
      vy: 0,
      isThrown: false,
      side: 'player',
    };
    this.opponentBall = {
      ...this.opponentStart,
      vx: 0,
      vy: 0,
      isThrown: false,
      side: 'opponent',
    };
    this.scoringPreview = null;
    this.scoringGraphics?.clear();
    this.resetBallHighlight();
    this.syncPlayerBallVisuals();
    this.syncOpponentBallVisuals();
    this.opponentBallLabel?.setText(this.getOpponentBallLabel());
    matchManager.setTurn('player', 1);
    matchManager.setScore(0, 0);
    matchManager.setResultPreview(this.getResultPreviewText());
    this.redrawAimLine();
    this.redrawPowerMeter();
    this.refreshHudLabels();
    this.updateShellScoringHud();
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

    if (this.scoringText) {
      this.scoringText.text = this.getScoringText();
    }
  }

  private getHintText(): string {
    if (this.phase === 'p1_aiming' || this.phase === 'p2_aiming') {
      const playerLabel = this.phase === 'p2_aiming' ? 'P2' : 'P1';
      return `${playerLabel}: A/D or arrows aim • Hold Space/Enter or Primary to charge`;
    }

    if (this.phase === 'p1_charging' || this.phase === 'p2_charging') {
      const playerLabel = this.phase === 'p2_charging' ? 'P2' : 'P1';
      return `${playerLabel}: release Space/Enter or Primary to throw`;
    }

    if (this.phase === 'p1_rolling') {
      return 'P1 ball is rolling with friction';
    }

    if (this.phase === 'p2_rolling') {
      return 'P2 ball is rolling with the same friction';
    }

    if (this.phase === 'cpu_thinking') {
      return 'CPU thinking • Player input is locked';
    }

    if (this.phase === 'cpu_rolling') {
      return 'CPU ball is rolling with the same friction';
    }

    return this.isLocal2P()
      ? 'Scoring preview compares the thrown P1 ball against the thrown P2 ball'
      : 'Scoring preview compares the thrown P1 ball against the thrown CPU ball';
  }

  private getScoringText(): string {
    if (!this.scoringPreview) {
      const difficulty = difficultyLabels[matchManager.getMatchState().difficulty];

      if (this.isLocal2P()) {
        return `Mode: ${this.getModeLabel()}
Scoring preview: waiting for P1 + P2 throws
Closest side: —
Turn note: ${this.cpuNote}`;
      }

      return `Mode: ${this.getModeLabel()}
Scoring preview: waiting for P1 + CPU throws
Closest side: —
CPU difficulty: ${difficulty}
CPU note: ${this.cpuNote}`;
    }

    if (this.scoringPreview.closestSide === 'draw') {
      return `Closest: Draw
Preview score: no score preview
Distance to jack: tied
${this.isLocal2P() ? 'Turn note' : 'CPU note'}: ${this.cpuNote}`;
    }

    return [
      `Closest: ${this.getSideLabel(this.scoringPreview.closestSide)} ball`,
      `Preview score: ${this.scoringPreview.label}`,
      `Distance to jack: ${Math.round(this.scoringPreview.closestDistance ?? 0)} px`,
      `${this.isLocal2P() ? 'Turn note' : 'CPU note'}: ${this.cpuNote}`,
    ].join('\n');
  }

  private getResultPreviewText(): string {
    if (!this.scoringPreview) {
      return this.isLocal2P()
        ? 'Boccia Local 2P preview waits for P1 throw, P2 throw, then scoring preview.'
        : 'Boccia VS CPU preview waits for P1 throw, CPU throw, then scoring preview.';
    }

    if (this.scoringPreview.closestSide === 'draw') {
      return this.isLocal2P()
        ? 'Scoring preview: draw / no score after one P1 throw and one P2 throw.'
        : 'Scoring preview: draw / no score after one P1 throw and one CPU throw.';
    }

    return `Scoring preview: ${this.scoringPreview.label}. Closest side: ${this.getSideLabel(this.scoringPreview.closestSide)}. Full round flow and official Boccia rules are saved for a later PR.`;
  }

  private updateShellScoringHud(): void {
    const phase = document.querySelector<HTMLElement>('[data-boccia-phase]');
    const preview = document.querySelector<HTMLElement>('[data-boccia-scoring-preview]');
    const closest = document.querySelector<HTMLElement>('[data-boccia-closest-side]');
    const cpuDifficulty = document.querySelector<HTMLElement>('[data-boccia-cpu-difficulty]');
    const cpuNote = document.querySelector<HTMLElement>('[data-boccia-cpu-note]');

    phase && (phase.textContent = phaseLabels[this.phase]);
    cpuDifficulty && (cpuDifficulty.textContent = difficultyLabels[matchManager.getMatchState().difficulty]);
    cpuNote && (cpuNote.textContent = this.cpuNote);

    if (!this.scoringPreview) {
      preview && (preview.textContent = this.isLocal2P() ? 'Waiting for P1 + P2 throws' : 'Waiting for P1 + CPU throws');
      closest && (closest.textContent = '—');
      return;
    }

    preview && (preview.textContent = this.scoringPreview.label);
    closest &&
      (closest.textContent =
        this.scoringPreview.closestSide === 'draw' ? 'Draw' : this.getSideLabel(this.scoringPreview.closestSide));
  }
}
