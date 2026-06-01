export const BOCCIA_CONFIG = {
  court: {
    width: 560,
    height: 280,
    color: 0x1f8a5b,
    borderColor: 0xf8fafc,
    lineColor: 0xdbeafe,
  },
  throwingArea: {
    width: 104,
    color: 0x14532d,
    accentColor: 0xfacc15,
  },
  balls: {
    jackRadius: 9,
    ballRadius: 12,
    playerColor: 0xef4444,
    opponentColor: 0x3b82f6,
    jackColor: 0xf8fafc,
    strokeColor: 0x0f172a,
  },
  aimLine: {
    color: 0xfacc15,
  },
  powerMeter: {
    width: 140,
    height: 14,
    fillColor: 0x38bdf8,
    trackColor: 0x0f172a,
  },
} as const;

export const BOCCIA_PLACEHOLDERS = {
  round: '1',
  balls: 'Player 3 / Opponent 3',
  phase: 'Setup',
  objective: 'Place your ball closest to the jack.',
  note: 'Throwing starts in PR-009.',
} as const;
