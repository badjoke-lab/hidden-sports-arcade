import type { Difficulty, MatchMode, MatchState } from '../types';

type MatchStateListener = (state: MatchState) => void;

const defaultObjective = 'Place your ball closest to the jack.';

const createInitialMatchState = (): MatchState => ({
  sportId: 'boccia',
  mode: 'vs_cpu',
  difficulty: 'easy',
  status: 'ready',
  score: {
    player: 0,
    opponent: 0,
  },
  turn: {
    currentPlayer: 'player',
    turnNumber: 1,
  },
  result: {
    winner: null,
    reason: 'Scene foundation loaded. Throwing starts in PR-009.',
  },
  objective: defaultObjective,
});

let matchState = createInitialMatchState();
const listeners = new Set<MatchStateListener>();

function cloneMatchState(state: MatchState): MatchState {
  return {
    ...state,
    score: { ...state.score },
    turn: { ...state.turn },
    result: { ...state.result },
  };
}

function emitChange(): void {
  const snapshot = getMatchState();

  listeners.forEach((listener) => listener(snapshot));
}

function updateMatchState(updater: (state: MatchState) => MatchState): MatchState {
  matchState = updater(cloneMatchState(matchState));
  emitChange();

  return getMatchState();
}

export function getMatchState(): MatchState {
  return cloneMatchState(matchState);
}

export function subscribe(listener: MatchStateListener): () => void {
  listeners.add(listener);
  listener(getMatchState());

  return () => {
    listeners.delete(listener);
  };
}

export function startMatch(): MatchState {
  return updateMatchState((state) => ({
    ...state,
    status: 'playing',
    result: {
      winner: null,
      reason: 'Boccia setup placeholder active. Throwing starts in PR-009.',
    },
  }));
}

export function pauseMatch(): MatchState {
  return updateMatchState((state) => ({
    ...state,
    status: 'paused',
  }));
}

export function resumeMatch(): MatchState {
  return updateMatchState((state) => ({
    ...state,
    status: 'playing',
  }));
}

export function retryMatch(): MatchState {
  return updateMatchState((state) => ({
    ...createInitialMatchState(),
    mode: state.mode,
    difficulty: state.difficulty,
  }));
}

export function finishMatchPlaceholder(): MatchState {
  return updateMatchState((state) => ({
    ...state,
    status: 'finished',
    result: {
      winner: null,
      reason: 'Finished placeholder. Real results and scoring arrive in a later PR.',
    },
  }));
}

export function setMode(mode: MatchMode): MatchState {
  return updateMatchState((state) => ({
    ...state,
    mode,
  }));
}

export function setDifficulty(difficulty: Difficulty): MatchState {
  return updateMatchState((state) => ({
    ...state,
    difficulty,
  }));
}

export function setScore(playerScore: number, opponentScore: number): MatchState {
  return updateMatchState((state) => ({
    ...state,
    score: {
      player: Math.max(0, playerScore),
      opponent: Math.max(0, opponentScore),
    },
  }));
}

export function advanceTurnPlaceholder(): MatchState {
  return updateMatchState((state) => ({
    ...state,
    turn: {
      currentPlayer: state.turn.currentPlayer === 'player' ? 'opponent' : 'player',
      turnNumber: state.turn.turnNumber + 1,
    },
  }));
}

export const matchManager = {
  getMatchState,
  subscribe,
  startMatch,
  pauseMatch,
  resumeMatch,
  retryMatch,
  finishMatchPlaceholder,
  setMode,
  setDifficulty,
  setScore,
  advanceTurnPlaceholder,
};
