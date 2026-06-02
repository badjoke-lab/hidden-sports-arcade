export interface TchoukballRuleSection {
  id: string;
  title: string;
  body: string[];
}

export const tchoukballRulesNotice =
  'This is a simplified arcade version designed to teach the core idea of Tchoukball. It is not a full simulation of official Tchoukball rules.';

export const tchoukballRuleSections: TchoukballRuleSection[] = [
  {
    id: 'what-is-tchoukball',
    title: 'What is Tchoukball?',
    body: [
      'Tchoukball is a fast, non-contact team sport where attacks are aimed at angled rebound frames instead of defended goals.',
      'Players try to create clean throwing angles while the other team reads the rebound and moves to catch the ball.',
    ],
  },
  {
    id: 'core-idea',
    title: 'Core idea',
    body: [
      'Throw the ball into a rebound frame so it bounces back into open court space.',
      'The defending side is not trying to block the throw at the frame; it is trying to predict and catch the rebound.',
    ],
  },
  {
    id: 'simplified-arcade-version',
    title: 'Simplified arcade version',
    body: [
      'The foundation preview shows the court, frames, forbidden zones, player markers, aim/throw flow, a CPU reply, and simplified landing results.',
      'Current arcade controls focus on aiming at the frame, choosing power, and learning how rebounds create space.',
    ],
  },
  {
    id: 'playable-later',
    title: 'What will be playable later',
    body: [
      'Later versions can add catching, rebound prediction, tutorials, local multiplayer shells, and fuller match structure.',
      'For this foundation, the player takes one shot and the CPU takes one automated reply; valid landings are worth non-final preview points, and there is no Local 2P Tchoukball mode, full match flow, or real catch gameplay yet.',
    ],
  },
];
