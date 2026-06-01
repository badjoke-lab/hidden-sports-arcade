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
  balls: 'Player 1 thrown / Opponent 3 static',
  phase: 'Aiming',
  objective: 'Place your ball closest to the jack.',
  scoringPreview: 'Waiting for stopped ball',
  closestSide: '—',
  note: 'CPU and full round flow start in later PRs.',
} as const;
