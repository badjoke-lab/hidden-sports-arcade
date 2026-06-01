export type MatchMode = 'vs_cpu' | 'local_2p';
export type Difficulty = 'easy' | 'normal' | 'hard';
export type MatchStatus = 'ready' | 'playing' | 'paused' | 'finished';
export type MatchParticipant = 'player' | 'opponent';

export interface MatchScore {
  player: number;
  opponent: number;
}

export interface MatchTurnState {
  currentPlayer: MatchParticipant;
  turnNumber: number;
}

export interface MatchResult {
  winner: MatchParticipant | 'draw' | null;
  reason: string;
}

export interface MatchState {
  sportId: string;
  mode: MatchMode;
  difficulty: Difficulty;
  status: MatchStatus;
  score: MatchScore;
  turn: MatchTurnState;
  result: MatchResult;
  objective: string;
}
