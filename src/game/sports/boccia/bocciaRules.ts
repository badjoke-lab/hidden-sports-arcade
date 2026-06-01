export interface BocciaRuleSection {
  id: string;
  title: string;
  body: string[];
}

export const bocciaSimplifiedNote =
  'This is a simplified arcade version designed to teach the core idea of Boccia. It is not a full simulation of official Boccia rules.';

export const bocciaRuleSections: BocciaRuleSection[] = [
  {
    id: 'what-is-boccia',
    title: 'What is Boccia?',
    body: ['Boccia is a precision target sport where players try to place colored balls closer to a white target ball, called the jack, than their opponent.'],
  },
  {
    id: 'core-idea',
    title: 'Core idea',
    body: ['Aim carefully, choose enough power, and try to finish closer to the jack than the other side.'],
  },
  {
    id: 'arcade-version',
    title: 'How to play this arcade version',
    body: ['Each side throws one ball in this preview build. Player 1 throws first, then the CPU or Player 2 throws, and the game shows a scoring preview.'],
  },
  {
    id: 'scoring-preview',
    title: 'How scoring preview works in this version',
    body: ['The game compares the stopped balls against the jack. The closest side receives the preview point. A very close tie shows no preview score.'],
  },
  {
    id: 'vs-cpu',
    title: 'VS CPU',
    body: ['Player 1 aims, charges, and throws. The CPU then makes one automated throw based on the selected difficulty.'],
  },
  {
    id: 'local-2p',
    title: 'Local 2P',
    body: ['Player 1 throws the red ball. Player 2 then uses the same keyboard or mobile controls to throw the blue ball.'],
  },
  {
    id: 'simplified',
    title: 'What is simplified here',
    body: [bocciaSimplifiedNote, 'Official match formats, ends, multi-ball tactics, classifications, penalties, and complete rule procedures are intentionally not simulated yet.'],
  },
  {
    id: 'controls',
    title: 'Controls',
    body: [
      'Keyboard: Aim with A / D or Arrow keys. Charge by holding Space / Enter. Throw by releasing Space / Enter. Pause with Esc / P.',
      'Mobile: use Aim Left / Aim Right, Primary, and Pause.',
    ],
  },
];
