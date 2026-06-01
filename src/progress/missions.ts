import type { MissionDefinition } from './types';

export const missions: MissionDefinition[] = [
  {
    id: 'first_play',
    sportId: 'boccia',
    title: 'First play',
    description: 'Open an arcade sport shell for the first time.',
  },
  {
    id: 'first_favorite',
    sportId: 'boccia',
    title: 'First favorite',
    description: 'Save any sport as a local favorite.',
  },
  {
    id: 'first_start',
    sportId: 'boccia',
    title: 'First start',
    description: 'Press Start in a placeholder match shell.',
  },
  {
    id: 'first_audio_test',
    sportId: 'boccia',
    title: 'First audio test',
    description: 'Use the local audio test control once.',
  },
  {
    id: 'boccia_shell_visit',
    sportId: 'boccia',
    title: 'Boccia shell visit',
    description: 'Visit the Boccia shell placeholder before gameplay exists.',
  },
];
