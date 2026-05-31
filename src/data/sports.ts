export type SportStatus = 'active' | 'coming-soon';

export interface Sport {
  id: string;
  name: string;
  summary: string;
  tags: string[];
  status: SportStatus;
}

export const sports: Sport[] = [
  {
    id: 'boccia',
    name: 'Boccia',
    summary:
      'A tactical target sport about precision throws, positioning, and pressure around the jack.',
    tags: ['Target', 'Precision', 'Paralympic Sport'],
    status: 'active',
  },
  {
    id: 'tchoukball',
    name: 'Tchoukball',
    summary:
      'A fast rebound-net team sport built around creative angles and non-contact attacking play.',
    tags: ['Team', 'Rebound', 'Non-contact'],
    status: 'coming-soon',
  },
  {
    id: 'goalball',
    name: 'Goalball',
    summary:
      'A sound-focused sport where players defend a wide goal and track a bell-filled ball.',
    tags: ['Sensory', 'Team', 'Paralympic Sport'],
    status: 'coming-soon',
  },
  {
    id: 'kabaddi',
    name: 'Kabaddi',
    summary:
      'A tag-and-escape sport of raids, holds, timing, and controlled risk.',
    tags: ['Raid', 'Team', 'Strategy'],
    status: 'coming-soon',
  },
  {
    id: 'molkky',
    name: 'Molkky',
    summary:
      'A Finnish throwing game about knocking numbered pins and managing the race to exactly fifty.',
    tags: ['Throwing', 'Scoring', 'Outdoor'],
    status: 'coming-soon',
  },
];
