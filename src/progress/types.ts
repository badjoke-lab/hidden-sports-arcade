export interface ProgressState {
  favorites: string[];
  recentSports: string[];
  tutorialSeen: Record<string, boolean>;
  missions: Record<string, boolean>;
}

export interface MissionDefinition {
  id: string;
  sportId: string;
  title: string;
  description: string;
}
