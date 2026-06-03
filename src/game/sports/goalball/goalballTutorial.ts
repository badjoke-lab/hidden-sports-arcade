export interface TutorialStep {
  id: string;
  title: string;
  body: string;
}

export const goalballTutorialSteps: TutorialStep[] = [
  {
    id: 'listen-for-path',
    title: 'Listen for the ball path',
    body: 'Use the sound lane preview to notice where the rolling ball is headed.',
  },
  {
    id: 'cover-lane',
    title: 'Move to cover the lane',
    body: 'Shift the defender toward the lane before the shot reaches the goal.',
  },
  {
    id: 'block-shot',
    title: 'Block the shot before it reaches the goal',
    body: 'Meet the ball path in front of the goal line to stop the attack.',
  },
  {
    id: 'take-turns',
    title: 'Take turns attacking and defending',
    body: 'Goalball alternates pressure: one side attacks while the other defends.',
  },
  {
    id: 'scoring-later',
    title: 'Preview scoring will come later',
    body: 'This foundation shows the court and learning structure before playable scoring is added.',
  },
];
