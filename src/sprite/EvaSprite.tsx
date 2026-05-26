import React from 'react';
import { PixelSprite } from './PixelSprite';

export type EvaMood = 'happy' | 'sleepy' | 'sad' | 'excited' | 'hungry' | 'neutral';

const PALETTE: Record<string, string> = {
  o: '#1d2733', b: '#7BD3B8', l: '#A8E6CF', d: '#5BB89B',
  s: '#FFFFFF',  p: '#1d2733', c: '#FF9DAA', t: '#FFC1A0', z: '#3D5A80',
};

const HAPPY = [
  '........oooooooo........',
  '......oolllllllloo......',
  '.....olllllllllllllo....',
  '....ollllbbbbbblllllo...',
  '...olllbbbbbbbbbbblllo..',
  '..ollbbbbbbbbbbbbbblllo.',
  '..olbbbbbbbbbbbbbbbbblo.',
  '.olbbbbbbbbbbbbbbbbbbblo',
  '.olbbssppbbbbbbssppbbblo',
  '.olbbssppbbbbbbssppbbblo',
  '.olbbsssbbbbbbbsssbbbblo',
  '.olbbbbbbbbbbbbbbbbbbblo',
  '.olbcccbbbbbbbbbbbcccblo',
  '.olbcccbbbpppppbbbcccblo',
  '.olbbbbbbpbbbbbpbbbbblo.',
  '.olbbbbbbbpppppbbbbbblo.',
  '..olbbbbbbbbbbbbbbbblo..',
  '..ollbbbbbbbbbbbbbbllo..',
  '...olllbbbbbbbbbbblllo..',
  '....olllllbbbbbbllllo...',
  '.....ollllllllllllllo...',
  '......oolllllllllooo....',
  '........oooooooooo......',
  '.......oo........oo.....',
];
const SLEEPY = [
  '........oooooooo........',
  '......oolllllllloo......',
  '...zz.olllllllllllllo...',
  '..zz.ollllbbbbbblllllo..',
  '..z.olllbbbbbbbbbbblllo.',
  '...ollbbbbbbbbbbbbbbllo.',
  '..olbbbbbbbbbbbbbbbbblo.',
  '.olbbbbbbbbbbbbbbbbbbblo',
  '.olbbbpppppbbbbpppppblo.',
  '.olbbbbbbbbbbbbbbbbbblo.',
  '.olbbbbbbbbbbbbbbbbbblo.',
  '.olbbbbbbbbbbbbbbbbbblo.',
  '.olbcccbbbbbbbbbbbcccblo',
  '.olbcccbbbbpppppbbcccblo',
  '.olbbbbbbbbbbbbbbbbbblo.',
  '.olbbbbbbbbbbbbbbbbbblo.',
  '..olbbbbbbbbbbbbbbbblo..',
  '..ollbbbbbbbbbbbbbbllo..',
  '...olllbbbbbbbbbbblllo..',
  '....olllllbbbbbbllllo...',
  '.....ollllllllllllllo...',
  '......oolllllllllooo....',
  '........oooooooooo......',
  '.......oo........oo.....',
];
const SAD = [
  '........oooooooo........',
  '......oolllllllloo......',
  '.....olllllllllllllo....',
  '....ollllbbbbbblllllo...',
  '...olllbbbbbbbbbbblllo..',
  '..ollbbbbbbbbbbbbbblllo.',
  '..olbbbbbbbbbbbbbbbbblo.',
  '.olbbbbbpppbbbbpppbbblo.',
  '.olbbbbpsppbbbbpsppbblo.',
  '.olbbbbpppbbbbbpppbbblo.',
  '.olbbbbbbbbbbbbbbbbbblo.',
  '.olbbbbbbbbbbbbbbbbbblo.',
  '.olbbbbbbbbbbbbbbbbbblo.',
  '.olbbbbbbbpppppbbbbbblo.',
  '.olbbbbbpbbbbbbbpbbbblo.',
  '.olbbbbpbbbbbbbbbpbbblo.',
  '..olbbbbbbbbbbbbbbbblo..',
  '..ollbbbbbbbbbbbbbbllo..',
  '...olllbbbbbbbbbbblllo..',
  '....olllllbbbbbbllllo...',
  '.....ollllllllllllllo...',
  '......oolllllllllooo....',
  '........oooooooooo......',
  '.......oo........oo.....',
];
const EXCITED = [
  '........oooooooo........',
  '......oolllllllloo......',
  '.....olllllllllllllo....',
  '....ollllbbbbbblllllo...',
  '...olllbbbbbbbbbbblllo..',
  '..ollbbbsbbbbbbbsbblllo.',
  '..olbbsbsbbbbbbsbsbblo..',
  '.olbbbbsbbbbbbbbsbbbblo.',
  '.olbbssspsssbsssspsssblo',
  '.olbbssspsssbsssspsssblo',
  '.olbbsspsssbbsssspsssblo',
  '.olbbbbbbbbbbbbbbbbbblo.',
  '.olbccsbbbbbbbbbbbccsblo',
  '.olbccbbpppppppppbccbblo',
  '.olbbbbpttttttttpbbbblo.',
  '.olbbbbpttttttttpbbbblo.',
  '..olbbbbpppppppppbbblo..',
  '..ollbbbbbbbbbbbbbbllo..',
  '...olllbbbbbbbbbbblllo..',
  '....olllllbbbbbbllllo...',
  '.....ollllllllllllllo...',
  '......oolllllllllooo....',
  '........oooooooooo......',
  '.......oo........oo.....',
];
const HUNGRY = [
  '........oooooooo........',
  '......oolllllllloo......',
  '.....olllllllllllllo....',
  '....ollllbbbbbblllllo...',
  '...olllbbbbbbbbbbblllo..',
  '..ollbbbbbbbbbbbbbblllo.',
  '..olbbbbbbbbbbbbbbbbblo.',
  '.olbbbbbbbbbbbbbbbbbbblo',
  '.olbbbpsppbbbbbpsppbbblo',
  '.olbbbpppbbbbbbbpppbbblo',
  '.olbbbbbbbbbbbbbbbbbblo.',
  '.olbbbbbbbbbbbbbbbbbblo.',
  '.olbcccbbbbbbbbbbbcccblo',
  '.olbcccbbbpppppbbbcccblo',
  '.olbbbbbbpttttttpbbbblo.',
  '.olbbbbbbbpppppbbbbbblo.',
  '..olbbbbbbbbbbbbbbbblo..',
  '..ollbbbbbbbbbbbbbbllo..',
  '...olllbbbbbbbbbbblllo..',
  '....olllllbbbbbbllllo...',
  '.....ollllllllllllllo...',
  '......oolllllllllooo....',
  '........oooooooooo......',
  '.......oo........oo.....',
];

const SPRITES: Record<EvaMood, string[]> = {
  happy: HAPPY, sleepy: SLEEPY, sad: SAD, excited: EXCITED, hungry: HUNGRY,
  neutral: HAPPY,
};

interface Props {
  mood?:    EvaMood;
  scale?:   number;
  palette?: Record<string, string>;
}

export function EvaSprite({ mood = 'happy', scale = 4, palette = PALETTE }: Props) {
  return <PixelSprite rows={SPRITES[mood] ?? HAPPY} palette={palette} scale={scale} />;
}
