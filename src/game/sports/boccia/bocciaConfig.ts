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
  balls: 'P1 thrown / P2 or CPU thrown',
  phase: 'P1 aiming',
  objective: 'Place your ball closest to the jack.',
  scoringPreview: 'Waiting for P1 + P2/CPU throws',
  closestSide: '—',
  note: 'VS CPU uses the CPU throw; Local 2P lets P2 use the same controls. Full rounds come later.',
} as const;
