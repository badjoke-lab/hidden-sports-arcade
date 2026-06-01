import Phaser from 'phaser';
import { audioManager } from '../../audio/audioManager';
import { matchManager } from '../match/matchManager';
import { inputManager } from '../../input/inputManager';
import type { InputState } from '../../input/types';
import { completeMission, markSportPlayed } from '../../progress/progressManager';
import { BOCCIA_CONFIG, BOCCIA_PLACEHOLDERS } from '../sports/boccia/bocciaConfig';

type BocciaPhase = 'aiming' | 'charging' | 'rolling' | 'stopped';
type BocciaSide = 'player' | 'opponent';

interface BocciaBallState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  isThrown: boolean;
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
  aiming: 'Aiming',
  charging: 'Charging',
  rolling: 'Rolling',
  stopped: 'Stopped',
};

const sideLabels: Record<BocciaSide, string> = {
  player: 'Player',
  opponent: 'Opponent',
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
const tieDistanceTolerance = 0.5;

export class BocciaScene extends Phaser.Scene {
  private courtBounds = new Phaser.Geom.Rectangle(0, 0, 0, 0);

  private phase: BocciaPhase = 'aiming';

  private aimAngle = Phaser.Math.DegToRad(-5);

  private power = 0;

  private powerDirection: 1 | -1 = 1;

  private previousPrimary = false;

  private playerStart = { x: 0, y: 0 };

  private jackPosition = { x: 0, y: 0 };

  private opponentScoringBalls: BocciaScoringBall[] = [];

  private staticBallCircles = new Map<string, Phaser.GameObjects.Arc>();

  private scoringPreview: BocciaScoringPreview | null = null;

  private playerBall: BocciaBallState = {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    isThrown: false,
  };

  private aimGraphics?: Phaser.GameObjects.Graphics;

  private powerGraphics?: Phaser.GameObjects.Graphics;

  private scoringGraphics?: Phaser.GameObjects.Graphics;

  private playerBallShadow?: Phaser.GameObjects.Arc;

  private playerBallCircle?: Phaser.GameObjects.Arc;

  private playerBallLabel?: Phaser.GameObjects.Text;

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
      window.removeEventListener('boccia:retry', this.handleRetryRequest);
    });
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
    this.playerStart = {
      x: courtX + BOCCIA_CONFIG.throwingArea.width - 36,
      y: courtY + BOCCIA_CONFIG.court.height / 2,
    };
    this.playerBall = {
      ...this.playerStart,
      vx: 0,
      vy: 0,
      isThrown: false,
    };

    this.add
      .text(width / 2, 26, 'Boccia Scoring Preview', {
        color: '#f8fafc',
        fontFamily: 'Arial, sans-serif',
        fontSize: '24px',
        fontStyle: '700',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, 52, `${BOCCIA_PLACEHOLDERS.objective} Aim, charge, throw, then preview closest-ball scoring.`, {
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
      {
        id: 'opponent-1',
        side: 'opponent',
        x: courtX + court.width * 0.78,
        y: centerY - 52,
        color: balls.opponentColor,
        label: 'O1',
      },
      {
        id: 'opponent-2',
        side: 'opponent',
        x: courtX + court.width * 0.84,
        y: centerY + 4,
        color: balls.opponentColor,
        label: 'O2',
      },
      {
        id: 'opponent-3',
        side: 'opponent',
        x: courtX + court.width * 0.73,
        y: centerY + 58,
        color: balls.opponentColor,
        label: 'O3',
      },
    ];

    this.jackPosition = { x: ballVisuals[0].x, y: ballVisuals[0].y };
    this.opponentScoringBalls = ballVisuals
      .filter((ball): ball is BallVisual & { id: string; side: BocciaSide } => ball.side === 'opponent' && Boolean(ball.id))
      .map(({ id, side, x, y }) => ({ id, side, x, y }));

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

    this.scoringPreview = null;
    this.scoringGraphics?.clear();
    this.resetBallHighlight();
    this.playerBall.vx = Math.cos(this.aimAngle) * speed;
    this.playerBall.vy = Math.sin(this.aimAngle) * speed;
    this.playerBall.isThrown = true;
    this.setPhase('rolling');
    this.aimGraphics?.clear();
    this.updateShellScoringHud();
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
      this.calculateScoringPreview();
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
    this.updateShellScoringHud();
  }

  private getScoringBalls(): BocciaScoringBall[] {
    return [
      {
        id: 'player-1',
        side: 'player',
        x: this.playerBall.x,
        y: this.playerBall.y,
      },
      ...this.opponentScoringBalls,
    ];
  }

  private distanceToJack(ball: BocciaScoringBall): number {
    return Phaser.Math.Distance.Between(ball.x, ball.y, this.jackPosition.x, this.jackPosition.y);
  }

  private calculateScoringPreview(): void {
    const scoredBalls = this.getScoringBalls()
      .map((ball): BocciaScoredBall => ({ ...ball, distance: this.distanceToJack(ball) }))
      .sort((a, b) => a.distance - b.distance);
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

    this.staticBallCircles.get(closestBall.id)?.setStrokeStyle(4, highlightColor, 1);
  }

  private resetBallHighlight(): void {
    const { balls } = BOCCIA_CONFIG;

    this.playerBallCircle?.setStrokeStyle(2, balls.strokeColor, 0.9);
    this.staticBallCircles.forEach((circle) => {
      circle.setStrokeStyle(2, balls.strokeColor, 0.7);
    });
  }

  private resetThrowPreview(): void {
    this.phase = 'aiming';
    this.aimAngle = Phaser.Math.DegToRad(-5);
    this.power = 0;
    this.powerDirection = 1;
    this.previousPrimary = false;
    this.playerBall = {
      ...this.playerStart,
      vx: 0,
      vy: 0,
      isThrown: false,
    };
    this.scoringPreview = null;
    this.scoringGraphics?.clear();
    this.resetBallHighlight();
    this.syncPlayerBallVisuals();
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
    if (this.phase === 'aiming') {
      return 'A/D or arrows aim • Hold Space/Enter or Primary to charge';
    }

    if (this.phase === 'charging') {
      return 'Release Space/Enter or Primary to throw';
    }

    if (this.phase === 'rolling') {
      return 'Ball is rolling with friction';
    }

    return 'Ball stopped • Scoring preview only; CPU and round flow arrive later';
  }

  private getScoringText(): string {
    if (!this.scoringPreview) {
      return 'Scoring preview: waiting for stopped ball\nClosest side: —\nCPU and full round flow start in later PRs.';
    }

    if (this.scoringPreview.closestSide === 'draw') {
      return 'Closest: Draw\nPreview score: no score preview\nDistance to jack: tied';
    }

    return [
      `Closest: ${sideLabels[this.scoringPreview.closestSide]} ball`,
      `Preview score: ${this.scoringPreview.label}`,
      `Distance to jack: ${Math.round(this.scoringPreview.closestDistance ?? 0)} px`,
    ].join('\n');
  }

  private getResultPreviewText(): string {
    if (!this.scoringPreview) {
      return 'Boccia scoring preview waits for the first stopped throw.';
    }

    if (this.scoringPreview.closestSide === 'draw') {
      return 'Scoring preview: draw / no score. Full round flow starts in a later PR.';
    }

    return `Scoring preview: ${this.scoringPreview.label}. Closest side: ${sideLabels[this.scoringPreview.closestSide]}. Full round flow starts in a later PR.`;
  }

  private updateShellScoringHud(): void {
    const phase = document.querySelector<HTMLElement>('[data-boccia-phase]');
    const preview = document.querySelector<HTMLElement>('[data-boccia-scoring-preview]');
    const closest = document.querySelector<HTMLElement>('[data-boccia-closest-side]');

    phase && (phase.textContent = phaseLabels[this.phase]);

    if (!this.scoringPreview) {
      preview && (preview.textContent = 'Waiting for stopped ball');
      closest && (closest.textContent = '—');
      return;
    }

    preview && (preview.textContent = this.scoringPreview.label);
    closest &&
      (closest.textContent =
        this.scoringPreview.closestSide === 'draw' ? 'Draw' : sideLabels[this.scoringPreview.closestSide]);
  }
}
