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
      'Tchoukball is a non-contact team sport built around angled rebound frames instead of defended goals.',
      'Teams attack by throwing into a frame and reading where the rebound will land in the court.',
    ],
  },
  {
    id: 'core-idea',
    title: 'Core idea',
    body: ['Aim at a frame, choose power, hit the frame, and make the rebound land in open court space.'],
  },
  {
    id: 'why-frames-matter',
    title: 'Why rebound frames matter',
    body: ['The frame changes the throw into a rebound. In this preview, missing the frame makes the landing invalid.'],
  },
  {
    id: 'forbidden-zone',
    title: 'Forbidden zone',
    body: ['The pink semicircle near each frame is the forbidden zone. A landing there is not a valid preview.'],
  },
  {
    id: 'arcade-preview',
    title: 'How this arcade preview works',
    body: ['Each side gets one rebound shot. A valid preview means the ball hit the frame, stayed in bounds, and landed outside the forbidden zone.'],
  },
  {
    id: 'vs-cpu',
    title: 'VS CPU',
    body: ['Player 1 aims, charges, and throws first. The CPU then takes one automatic reply shot using the selected difficulty.'],
  },
  {
    id: 'local-2p',
    title: 'Local 2P',
    body: ['Player 1 throws first. Player 2 then uses the same keyboard or mobile controls for one reply shot.'],
  },
  {
    id: 'controls',
    title: 'Controls',
    body: [
      'Keyboard: Aim with A / D or Arrow keys. Charge by holding Space / Enter. Throw by releasing Space / Enter.',
      'Mobile: use Aim Left / Aim Right and Primary. Retry resets the current preview.',
    ],
  },
  {
    id: 'simplified',
    title: 'What is simplified',
    body: [
      tchoukballRulesNotice,
      'Official scoring, full team movement, passing, defense, catching, fouls, substitutions, and complete match flow are intentionally not simulated here.',
    ],
  },
];
