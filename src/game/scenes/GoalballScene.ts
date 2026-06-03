import Phaser from 'phaser';
import {
  BALL_RADIUS,
  COURT_HEIGHT,
  COURT_WIDTH,
  GOAL_WIDTH,
  LANE_COLORS,
  PLAYER_RADIUS,
  TEAM_COLORS,
} from '../sports/goalball/goalballConfig';

function color(hex: string): number {
  return Phaser.Display.Color.HexStringToColor(hex).color;
}

export class GoalballScene extends Phaser.Scene {
  constructor() {
    super('GoalballScene');
  }

  create(): void {
    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2 + 8;
    const courtX = centerX - COURT_WIDTH / 2;
    const courtY = centerY - COURT_HEIGHT / 2;
    const graphics = this.add.graphics();
    const leftGoalY = centerY - GOAL_WIDTH / 2;
    const rightGoalY = centerY - GOAL_WIDTH / 2;
    const ball = { x: courtX + COURT_WIDTH - 170, y: centerY - 42 };
    const laneTarget = { x: courtX + 42, y: centerY + 34 };

    graphics.fillStyle(color(TEAM_COLORS.court), 1);
    graphics.fillRoundedRect(courtX, courtY, COURT_WIDTH, COURT_HEIGHT, 18);
    graphics.lineStyle(4, color(TEAM_COLORS.courtLine), 0.96);
    graphics.strokeRoundedRect(courtX, courtY, COURT_WIDTH, COURT_HEIGHT, 18);

    this.drawGoal(graphics, courtX, leftGoalY, 'left');
    this.drawGoal(graphics, courtX + COURT_WIDTH, rightGoalY, 'right');
    this.drawCourtLines(graphics, courtX, courtY, centerX, centerY);
    this.drawSoundLane(graphics, ball.x, ball.y, laneTarget.x, laneTarget.y);
    this.drawPlayers(graphics, courtX, centerY, ball.x, ball.y);
    this.drawBall(graphics, ball.x, ball.y);
    this.drawLabels(courtX, courtY, centerX, centerY, ball.x, ball.y);
  }

  private drawGoal(graphics: Phaser.GameObjects.Graphics, x: number, y: number, side: 'left' | 'right'): void {
    const goalDepth = 16;
    const goalX = side === 'left' ? x - goalDepth : x;

    graphics.fillStyle(color(TEAM_COLORS.goal), 0.94);
    graphics.fillRect(goalX, y, goalDepth, GOAL_WIDTH);
    graphics.fillStyle(color(TEAM_COLORS.goal), 0.18);
    graphics.fillRect(side === 'left' ? x : x - 74, y, 74, GOAL_WIDTH);
  }

  private drawCourtLines(graphics: Phaser.GameObjects.Graphics, courtX: number, courtY: number, centerX: number, centerY: number): void {
    graphics.lineStyle(2, color(TEAM_COLORS.courtLine), 0.7);
    graphics.beginPath();
    graphics.moveTo(centerX, courtY + 16);
    graphics.lineTo(centerX, courtY + COURT_HEIGHT - 16);
    graphics.strokePath();

    graphics.lineStyle(2, color(TEAM_COLORS.courtLine), 0.38);
    [courtX + 116, courtX + 218, courtX + COURT_WIDTH - 218, courtX + COURT_WIDTH - 116].forEach((lineX) => {
      graphics.beginPath();
      graphics.moveTo(lineX, courtY + 24);
      graphics.lineTo(lineX, courtY + COURT_HEIGHT - 24);
      graphics.strokePath();
    });

    graphics.lineStyle(1, color(TEAM_COLORS.courtLine), 0.24);
    [centerY - 74, centerY, centerY + 74].forEach((lineY) => {
      graphics.beginPath();
      graphics.moveTo(courtX + 20, lineY);
      graphics.lineTo(courtX + COURT_WIDTH - 20, lineY);
      graphics.strokePath();
    });
  }

  private drawSoundLane(graphics: Phaser.GameObjects.Graphics, startX: number, startY: number, endX: number, endY: number): void {
    graphics.lineStyle(18, color(LANE_COLORS.lane), 0.16);
    graphics.beginPath();
    graphics.moveTo(startX, startY);
    graphics.lineTo(endX, endY);
    graphics.strokePath();

    graphics.lineStyle(3, color(LANE_COLORS.lane), 0.84);
    graphics.beginPath();
    graphics.moveTo(startX, startY);
    graphics.lineTo(endX, endY);
    graphics.strokePath();

    [0.22, 0.43, 0.64].forEach((amount, index) => {
      const rippleX = Phaser.Math.Linear(startX, endX, amount);
      const rippleY = Phaser.Math.Linear(startY, endY, amount);
      graphics.lineStyle(2, color(LANE_COLORS.ripple), 0.54 - index * 0.1);
      graphics.strokeCircle(rippleX, rippleY, 18 + index * 7);
    });
  }

  private drawPlayers(graphics: Phaser.GameObjects.Graphics, courtX: number, centerY: number, attackX: number, attackY: number): void {
    const defenders = [centerY - 72, centerY, centerY + 72];

    defenders.forEach((defenderY) => {
      graphics.fillStyle(color(TEAM_COLORS.defense), 1);
      graphics.fillCircle(courtX + 96, defenderY, PLAYER_RADIUS);
      graphics.lineStyle(3, color(TEAM_COLORS.courtLine), 0.8);
      graphics.strokeCircle(courtX + 96, defenderY, PLAYER_RADIUS);
    });

    graphics.fillStyle(color(TEAM_COLORS.attack), 1);
    graphics.fillCircle(attackX + 78, attackY - 4, PLAYER_RADIUS);
    graphics.lineStyle(3, color(TEAM_COLORS.courtLine), 0.8);
    graphics.strokeCircle(attackX + 78, attackY - 4, PLAYER_RADIUS);
  }

  private drawBall(graphics: Phaser.GameObjects.Graphics, x: number, y: number): void {
    graphics.fillStyle(color(TEAM_COLORS.ball), 1);
    graphics.fillCircle(x, y, BALL_RADIUS);
    graphics.lineStyle(2, color(TEAM_COLORS.courtLine), 0.8);
    graphics.strokeCircle(x, y, BALL_RADIUS);
  }

  private drawLabels(courtX: number, courtY: number, centerX: number, centerY: number, ballX: number, ballY: number): void {
    const labelStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      color: '#eff6ff',
      fontFamily: 'Arial, sans-serif',
      fontSize: '16px',
      fontStyle: '700',
    };

    this.add.text(courtX + 16, centerY - GOAL_WIDTH / 2 - 24, 'Goal', labelStyle);
    this.add.text(courtX + COURT_WIDTH - 58, centerY - GOAL_WIDTH / 2 - 24, 'Goal', labelStyle);
    this.add.text(courtX + 124, centerY + 88, 'Defense', labelStyle);
    this.add.text(ballX - 18, ballY + 20, 'Ball', labelStyle);
    this.add.text(centerX - 48, courtY + 20, 'Sound lane', labelStyle);
  }
}
