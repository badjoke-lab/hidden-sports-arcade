export type SportStatus = 'active' | 'foundation' | 'coming-soon';

export type SportDifficulty = 'easy' | 'medium' | 'hard';

export type SportTemplateType =
  | 'target-throw'
  | 'tag-chase'
  | 'pass-invasion'
  | 'sound-awareness'
  | 'race-time-attack'
  | 'net-rally';

export interface Sport {
  id: string;
  name: string;
  shortName?: string;
  summary: string;
  tags: string[];
  status: SportStatus;
  matchLength: string;
  difficulty: SportDifficulty;
  templateType: SportTemplateType;
}

export const sports: Sport[] = [
  {
    id: 'boccia',
    name: 'Boccia',
    summary:
      'A tactical target sport about precision throws, positioning, and pressure around the jack.',
    tags: ['Target', 'Precision', 'Paralympic Sport'],
    status: 'active',
    matchLength: '3–5 min arcade match',
    difficulty: 'easy',
    templateType: 'target-throw',
  },
  {
    id: 'tchoukball',
    name: 'Tchoukball',
    summary:
      'Next sport foundation in progress. A fast rebound-net team sport built around creative angles and non-contact attacking play.',
    tags: ['Team', 'Rebound', 'Non-contact'],
    status: 'foundation',
    matchLength: 'Foundation preview only',
    difficulty: 'medium',
    templateType: 'net-rally',
  },
  {
    id: 'goalball',
    name: 'Goalball',
    summary:
      'A sound-focused sport where players defend a wide goal and track a bell-filled ball.',
    tags: ['Sensory', 'Team', 'Paralympic Sport'],
    status: 'coming-soon',
    matchLength: '3–5 min arcade match',
    difficulty: 'medium',
    templateType: 'sound-awareness',
  },
  {
    id: 'kabaddi',
    name: 'Kabaddi',
    summary:
      'A tag-and-escape sport of raids, holds, timing, and controlled risk.',
    tags: ['Raid', 'Team', 'Strategy'],
    status: 'coming-soon',
    matchLength: '4–7 min arcade match',
    difficulty: 'hard',
    templateType: 'tag-chase',
  },
  {
    id: 'molkky',
    name: 'Molkky',
    shortName: 'Mölkky',
    summary:
      'A Finnish throwing game about knocking numbered pins and managing the race to exactly fifty.',
    tags: ['Throwing', 'Scoring', 'Outdoor'],
    status: 'coming-soon',
    matchLength: '3–6 min arcade match',
    difficulty: 'easy',
    templateType: 'target-throw',
  },
];
