import React from 'react';
import { PixelSprite } from './PixelSprite';

const PALETTE: Record<string, string> = {
  o: '#1d2733', r: '#FF6B6B', R: '#D94848', y: '#FFD93D', Y: '#E5B91A',
  g: '#7BD3B8', G: '#5BB89B', w: '#FFFFFF', k: '#3D2817', K: '#5C3A1F',
  p: '#FFB1C9', P: '#FF7AA8', b: '#5C8EE8', B: '#3D6BB8', c: '#FFC893',
  C: '#E6A86B', s: '#F4F0E6', t: '#8B7355', n: '#1d2733',
};

const SPRITES: Record<string, string[]> = {
  coin: [
    '....oooooo....', '..oo......oo..', '.oyYYYYYYYYyo.',
    '.oYwYYYYYYwYo.', 'oYYwYYYYYYwYYo', 'oYwYYsssYYwYYo',
    'oYwYYsYsYYwYYo', 'oYwYYsYsYYwYYo', 'oYwYYsYsYYwYYo',
    'oYwYYsssYYwYYo', 'oYYwYYYYYYwYYo', '.oYwYYYYYYwYo.',
    '.oyYYYYYYYYyo.', '..oo......oo..', '....oooooo....',
  ],
  heart: [
    '..oo....oo..', '.orro..orro.', 'orRRroorRRro',
    'orRrrRRrrRro', 'orRRRRRRRRro', 'orRRRRRRRRro',
    '.oRRRRRRRRo.', '..oRRRRRRo..', '...oRRRRo...',
    '....oRRo....', '.....oo.....',
  ],
  apple: [
    '......gg......', '.....gGg......', '....gGG.......',
    '..oo....oo....', '.orrrrrrrro...', 'orRRrrrrRRro..',
    'orRrrrrrrRro..', 'orRrrrrrrRro..', 'orRRrrrrRRro..',
    'orRRRrrRRRro..', '.orRRRRRRRo...', '..oRRRRRRo....',
    '...orRRro.....', '.....oo.......',
  ],
  ramen: [
    '..............', '...wwwwwwww...', '..ww......ww..',
    '.oggssssssggo.', 'orgYssssssgrog', 'orsYsbbssssrog',
    'orgssssbsssrog', 'orsssssssssrog', '.orsssssssro..',
    '..orrrrrrro...', '...oooooo.....',
  ],
  pizza: [
    '......ccccc......', '....ccCCCCCcc....', '...cCrrrrrrCc...',
    '..cCrRRyRRRRCc..', '.cCRRrRRRGRRRCc.', 'cCRyRRRRRgRRRRCc',
    'cCRRRGRRyRRRRCc.', '.cCRRRRRRRRRrCc.', '..cCrRRRyRRRCc..',
    '...cCrRRRRCc....', '....cCCRCc......', '......cc........',
  ],
  cake: [
    '.....pp.....', '....pPPp....', '....pPPp....',
    '....oooo....', '...oppppo...', '..opppppppo.',
    '.oCCCCCCCCo.', 'okCCCCCCCCko', 'okkkkkkkkkko',
    'oKKKKKKKKKKo', '.oooooooooo.',
  ],
  soda: [
    '...oooooo...', '..o......o..', '..obbbbbbo..',
    '..oBBBBBBo..', '..oBwwwwBo..', '..oBwbbwBo..',
    '..oBwwwwBo..', '..oBBBBBBo..', '..oBBBBBBo..',
    '..oBBBBBBo..', '..o......o..', '...oooooo...',
  ],
  candy: [
    '..............', '..oo......oo..', '.opPo....opPo.',
    'oppPPoooppPPo.', 'opPPyyyyyPPPo.', 'opPyyrryyyPPo.',
    'opPyyrryyyPPo.', 'opPPyyyyyPPPo.', 'oppPPoooppPPo.',
    '.opPo....opPo.', '..oo......oo..',
  ],
  star: [
    '......oo......', '.....oyyo.....', '.....oYYo.....',
    'oooo.oyyo.oooo', 'oyYYooyyooYYyo', 'oyYYYYYYYYYYyo',
    '.oYYYYYYYYYYo.', '..oYYYYYYYYo..', '..oYYYYYYYYo..',
    '.oYYYoooYYYo..', 'oYYYo...oYYYo.', 'oYYo.....oYYo.',
    'oo.........oo.',
  ],
  egg: [
    '....oooo....', '...owwwwo...', '..owwwwwwo..',
    '.owwwwwwwwo.', '.owwwyywwwo.', '.owwyYYywwo.',
    '.owwwyywwwo.', '.owwwwwwwwo.', '..owwwwwwo..',
    '...owwwwo...', '....oooo....',
  ],
  flour: [
    '..oooooo..', '.owwwwwwo.', '.owttttwo.',
    '.otttttto.', '.ottsstto.', '.ottsstto.',
    '.otttttto.', '.otttttto.', '.otttttto.',
    '.oottttoo.', '..oooooo..',
  ],
  tomato: [
    '.....g......', '....ggg.....', '...oo.oo....',
    '..orrrrrro..', '.orRRrrRRro.', 'orRrrrrrrRro',
    'orRrrrrrrRro', 'orRRrrrrRRro', '.orRRRRRRo..',
    '..orRRRRo...', '...oooooo...',
  ],
  cheese: [
    'oooooooooooo', 'oyYYYYYYYYyo', 'oYyYYYYoYYYo',
    'oYYYYoYYYYYo', 'oYYYYYYYYoYo', '.oYYoYYYYYYo',
    '..oYYYYYYYYo', '...oYYYYYYoo', '....oooooo..',
  ],
};

interface Props {
  name:   string;
  scale?: number;
}

export function ItemSprite({ name, scale = 3 }: Props) {
  const rows = SPRITES[name];
  if (!rows) return null;
  return <PixelSprite rows={rows} palette={PALETTE} scale={scale} />;
}
