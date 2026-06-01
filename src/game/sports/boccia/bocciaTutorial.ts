export interface TutorialStep {
  id: string;
  title: string;
  body: string;
}

export const bocciaTutorialSteps: TutorialStep[] = [
  {
    id: 'aim-at-jack',
    title: 'Aim at the jack',
    body: 'Turn the aim line toward the small white jack on the court.',
  },
  {
    id: 'charge-power',
    title: 'Hold Primary to charge power',
    body: 'Hold Space, Enter, or the mobile Primary button to fill the power meter.',
  },
  {
    id: 'release-to-throw',
    title: 'Release Primary to throw',
    body: 'Let go when the power looks right. Your ball rolls with arcade friction.',
  },
  {
    id: 'wait-opponent',
    title: 'Wait for the opponent or Player 2',
    body: 'VS CPU throws automatically. Local 2P lets Player 2 use the same controls.',
  },
  {
    id: 'closest-wins-preview',
    title: 'Closest ball wins the scoring preview',
    body: 'After both balls stop, the closest ball to the jack gets the preview point.',
  },
];
