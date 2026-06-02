export interface TutorialStep {
  id: string;
  title: string;
  body: string;
}

export const tchoukballTutorialSteps: TutorialStep[] = [
  {
    id: 'aim-at-frame',
    title: 'Aim at a rebound frame',
    body: 'Turn the aim line toward the angled frame at the end of the court.',
  },
  {
    id: 'charge-power',
    title: 'Hold Primary to charge power',
    body: 'Hold Space, Enter, or the mobile Primary button to build throw power.',
  },
  {
    id: 'release-to-throw',
    title: 'Release to throw',
    body: 'Let go of Primary to send the ball toward the rebound frame.',
  },
  {
    id: 'hit-the-frame',
    title: 'Hit the rebound frame',
    body: 'The ball must touch the frame before any landing can count as a valid preview.',
  },
  {
    id: 'land-outside-zone',
    title: 'Land outside the forbidden zone',
    body: 'A rebound landing in bounds and outside the forbidden zone creates a valid preview.',
  },
  {
    id: 'reply-shot',
    title: 'CPU or P2 replies',
    body: 'VS CPU answers automatically. Local 2P lets Player 2 take the reply shot.',
  },
  {
    id: 'compare-preview',
    title: 'Compare valid landings',
    body: 'The preview score compares which side made a valid rebound landing.',
  },
];
