export interface GoalballRuleSection {
  id: string;
  title: string;
  body: string[];
}

export const goalballRulesNotice =
  'This is a simplified arcade version designed to teach the core idea of Goalball. It is not a full simulation of official Goalball rules.';

export const goalballRuleSections: GoalballRuleSection[] = [
  {
    id: 'what-is-goalball',
    title: 'What is Goalball?',
    body: [
      'Goalball is a Paralympic team sport where players track a ball with sound and defend a wide goal across the end line.',
      'Players take turns attacking and defending, with defenders listening for the ball path before moving to block it.',
    ],
  },
  {
    id: 'core-idea',
    title: 'Core idea',
    body: ['Read the ball lane, cover the goal, and stop the rolling shot before it crosses the line.'],
  },
  {
    id: 'sound-based-play',
    title: 'Sound-based play',
    body: ['The ball contains bells in the real sport. This preview will teach the idea with visible sound lanes before adding interactive audio cues.'],
  },
  {
    id: 'defending-wide-goal',
    title: 'Defending a wide goal',
    body: ['A goal stretches across the back of each team area, so defenders must cover space together instead of guarding a small target.'],
  },
  {
    id: 'arcade-preview',
    title: 'How this arcade preview will work',
    body: ['The foundation shows the court, goals, defenders, attacker, ball, and sound lane. Movement, shots, and scoring are planned later.'],
  },
  {
    id: 'vs-cpu-planned',
    title: 'VS CPU planned',
    body: ['A future preview will let Player 1 defend against simple CPU shot lanes.'],
  },
  {
    id: 'local-2p-planned',
    title: 'Local 2P planned',
    body: ['A future local mode will alternate attack and defense between two players on the same device.'],
  },
  {
    id: 'controls-planned',
    title: 'Controls planned',
    body: ['Planned controls: move left and right to cover the lane, then block before the ball reaches the goal.'],
  },
  {
    id: 'simplified',
    title: 'Simplified-vs-official notice',
    body: [
      goalballRulesNotice,
      'Official court markings, penalties, timing rules, substitutions, and full team tactics are intentionally outside this foundation preview.',
    ],
  },
];
