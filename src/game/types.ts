export type MatchMode = 'vs_cpu' | 'local_2p';
export type Difficulty = 'easy' | 'normal' | 'hard';
export type MatchStatus = 'ready' | 'playing' | 'paused' | 'finished';

export interface MatchState {
  sportId: string;
  mode: MatchMode;
  difficulty: Difficulty;
  status: MatchStatus;
  playerScore: number;
  opponentScore: number;
  objective: string;
}
