import Phaser from 'phaser';
import { audioManager } from '../../audio/audioManager';
import { matchManager } from '../match/matchManager';
import { inputManager } from '../../input/inputManager';
import type { InputState } from '../../input/types';
import { completeMission, markSportPlayed } from '../../progress/progressManager';
import { BOCCIA_CONFIG, BOCCIA_PLACEHOLDERS } from '../sports/boccia/bocciaConfig';

type BocciaPhase =
  | 'player_aiming'
  | 'player_charging'
  | 'player_rolling'
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
  player_aiming: 'Player aiming',
  player_charging: 'Player charging',
  player_rolling: 'Player rolling',
  cpu_thinking: 'CPU thinking',
  cpu_rolling: 'CPU rolling',
  scoring_preview: 'Scoring preview',
};

const sideLabels: Record<BocciaSide, string> = {
  player: 'Player',
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

  private phase: BocciaPhase = 'player_aiming';

  private aimAngle = Phaser.Math.DegToRad(-5);

  private power = 0;

  private powerDirection: 1 | -1 = 1;

  private previousPrimary = false;

  private playerStart = { x: 0, y: 0 };

  private cpuStart = { x: 0, y: 0 };

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

  private cpuBall: BocciaBallState = {
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

  private cpuBallShadow?: Phaser.GameObjects.Arc;

  private cpuBallCircle?: Phaser.GameObjects.Arc;

  private cpuBallLabel?: Phaser.GameObjects.Text;

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
    this.cpuStart = {
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
    this.cpuBall = {
      ...this.cpuStart,
      vx: 0,
      vy: 0,
      isThrown: false,
      side: 'opponent',
    };

    this.add
      .text(width / 2, 26, 'Boccia VS CPU Preview', {
        color: '#f8fafc',
        fontFamily: 'Arial, sans-serif',
        fontSize: '24px',
        fontStyle: '700',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, 52, `${BOCCIA_PLACEHOLDERS.objective} Player throws once, then CPU throws once for preview scoring.`, {
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

    this.cpuBallShadow = this.add.circle(this.cpuBall.x, this.cpuBall.y, balls.ballRadius + 2, balls.strokeColor, 0.24);
    this.cpuBallCircle = this.add
      .circle(this.cpuBall.x, this.cpuBall.y, balls.ballRadius, balls.opponentColor, 1)
      .setStrokeStyle(2, balls.strokeColor, 0.9);
    this.cpuBallLabel = this.addLabel('CPU', this.cpuBall.x, this.cpuBall.y + balls.ballRadius + 13, '#e5edf8');
  }

  private redrawAimLine(): void {
    if (!this.aimGraphics || (this.phase !== 'player_aiming' && this.phase !== 'player_charging')) {
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
    this.powerGraphics.fillStyle(powerMeter.fillColor, this.phase === 'player_charging' ? 0.95 : 0.62);
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

  private updateAim(input: InputState, deltaSeconds: number): void {
    if (this.phase !== 'player_aiming' && this.phase !== 'player_charging') {
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
    if (this.phase !== 'player_aiming' && this.phase !== 'player_charging') {
      return;
    }

    if (input.primary) {
      if (!this.previousPrimary) {
        this.setPhase('player_charging');
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

    if (this.previousPrimary && this.phase === 'player_charging') {
      this.throwBall();
    }
  }

  private throwBall(): void {
    const throwPower = Math.max(this.power, 0.08);
    const speed = Phaser.Math.Linear(minThrowSpeed, maxThrowSpeed, throwPower);

    this.scoringPreview = null;
    this.scoringGraphics?.clear();
    this.resetBallHighlight();
    this.playerBall.vx = Math.cos(this.aimAngle) * speed;
    this.playerBall.vy = Math.sin(this.aimAngle) * speed;
    this.playerBall.isThrown = true;
    this.setPhase('player_rolling');
    this.aimGraphics?.clear();
    this.updateShellScoringHud();
    audioManager.playSe('throw');
  }

  private updateRollingBalls(deltaSeconds: number): void {
    if (this.phase === 'player_rolling') {
      this.updateRollingBall(this.playerBall, deltaSeconds);
      this.syncPlayerBallVisuals();

      if (this.isBallStopped(this.playerBall)) {
        this.stopBall(this.playerBall);
        this.syncPlayerBallVisuals();
        this.startCpuThinking();
      }
    }

    if (this.phase === 'cpu_rolling') {
      this.updateRollingBall(this.cpuBall, deltaSeconds);
      this.syncCpuBallVisuals();

      if (this.isBallStopped(this.cpuBall)) {
        this.stopBall(this.cpuBall);
        this.syncCpuBallVisuals();
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

  private syncCpuBallVisuals(): void {
    this.cpuBallShadow?.setPosition(this.cpuBall.x, this.cpuBall.y);
    this.cpuBallCircle?.setPosition(this.cpuBall.x, this.cpuBall.y);
    this.cpuBallLabel?.setPosition(this.cpuBall.x, this.cpuBall.y + BOCCIA_CONFIG.balls.ballRadius + 13);
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
    const dx = target.x - this.cpuBall.x;
    const dy = target.y - this.cpuBall.y;
    const angle = Math.atan2(dy, dx);
    const distance = Math.hypot(dx, dy);
    const estimatedTravelScale = 1.05;
    const baseSpeed = Phaser.Math.Clamp(distance / estimatedTravelScale, minThrowSpeed, maxThrowSpeed);
    const speed = Phaser.Math.Clamp(
      baseSpeed * (1 + Phaser.Math.FloatBetween(-error.power, error.power)),
      minThrowSpeed,
      maxThrowSpeed,
    );

    this.cpuBall.vx = Math.cos(angle) * speed;
    this.cpuBall.vy = Math.sin(angle) * speed;
    this.cpuBall.isThrown = true;
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

    if (this.cpuBall.isThrown) {
      scoringBalls.push({
        id: 'cpu-1',
        side: 'opponent',
        x: this.cpuBall.x,
        y: this.cpuBall.y,
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
      label = `Player +${playerScore}`;
    } else {
      opponentScore = scoredBalls.filter(
        (ball) => ball.side === 'opponent' && ball.distance < closestPlayerDistance - tieDistanceTolerance,
      ).length;
      label = `Opponent +${opponentScore}`;
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

    if (closestBall.id === 'cpu-1') {
      this.cpuBallCircle?.setStrokeStyle(4, highlightColor, 1);
      return;
    }

    this.staticBallCircles.get(closestBall.id)?.setStrokeStyle(4, highlightColor, 1);
  }

  private resetBallHighlight(): void {
    const { balls } = BOCCIA_CONFIG;

    this.playerBallCircle?.setStrokeStyle(2, balls.strokeColor, 0.9);
    this.cpuBallCircle?.setStrokeStyle(2, balls.strokeColor, 0.9);
    this.staticBallCircles.forEach((circle) => {
      circle.setStrokeStyle(2, balls.strokeColor, 0.7);
    });
  }

  private resetThrowPreview(): void {
    this.cpuThinkingEvent?.remove(false);
    this.cpuThinkingEvent = undefined;
    this.phase = 'player_aiming';
    this.aimAngle = Phaser.Math.DegToRad(-5);
    this.power = 0;
    this.powerDirection = 1;
    this.previousPrimary = false;
    this.cpuNote = 'CPU waits for the player throw.';
    this.playerBall = {
      ...this.playerStart,
      vx: 0,
      vy: 0,
      isThrown: false,
      side: 'player',
    };
    this.cpuBall = {
      ...this.cpuStart,
      vx: 0,
      vy: 0,
      isThrown: false,
      side: 'opponent',
    };
    this.scoringPreview = null;
    this.scoringGraphics?.clear();
    this.resetBallHighlight();
    this.syncPlayerBallVisuals();
    this.syncCpuBallVisuals();
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
    if (this.phase === 'player_aiming') {
      return 'A/D or arrows aim • Hold Space/Enter or Primary to charge';
    }

    if (this.phase === 'player_charging') {
      return 'Release Space/Enter or Primary to throw';
    }

    if (this.phase === 'player_rolling') {
      return 'Player ball is rolling with friction';
    }

    if (this.phase === 'cpu_thinking') {
      return 'CPU thinking • Player input is locked';
    }

    if (this.phase === 'cpu_rolling') {
      return 'CPU ball is rolling with the same friction';
    }

    return 'Scoring preview compares the thrown player ball against the thrown CPU ball';
  }

  private getScoringText(): string {
    if (!this.scoringPreview) {
      const difficulty = difficultyLabels[matchManager.getMatchState().difficulty];
      return `Scoring preview: waiting for player + CPU throws\nClosest side: —\nCPU difficulty: ${difficulty}\nCPU note: ${this.cpuNote}`;
    }

    if (this.scoringPreview.closestSide === 'draw') {
      return `Closest: Draw\nPreview score: no score preview\nDistance to jack: tied\nCPU note: ${this.cpuNote}`;
    }

    return [
      `Closest: ${sideLabels[this.scoringPreview.closestSide]} ball`,
      `Preview score: ${this.scoringPreview.label}`,
      `Distance to jack: ${Math.round(this.scoringPreview.closestDistance ?? 0)} px`,
      `CPU note: ${this.cpuNote}`,
    ].join('\n');
  }

  private getResultPreviewText(): string {
    if (!this.scoringPreview) {
      return 'Boccia VS CPU preview waits for player throw, CPU throw, then scoring preview.';
    }

    if (this.scoringPreview.closestSide === 'draw') {
      return 'Scoring preview: draw / no score after one player throw and one CPU throw.';
    }

    return `Scoring preview: ${this.scoringPreview.label}. Closest side: ${sideLabels[this.scoringPreview.closestSide]}. Full round flow starts in a later PR; Local 2P is not implemented here.`;
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
      preview && (preview.textContent = 'Waiting for player + CPU throws');
      closest && (closest.textContent = '—');
      return;
    }

    preview && (preview.textContent = this.scoringPreview.label);
    closest &&
      (closest.textContent =
        this.scoringPreview.closestSide === 'draw' ? 'Draw' : sideLabels[this.scoringPreview.closestSide]);
  }
}
