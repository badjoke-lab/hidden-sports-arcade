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
  balls: 'Player 1 thrown / CPU 1 thrown',
  phase: 'Player aiming',
  objective: 'Place your ball closest to the jack.',
  scoringPreview: 'Waiting for player + CPU throws',
  closestSide: '—',
  note: 'CPU aims near the jack after the player ball stops; Local 2P and full rounds come later.',
} as const;
