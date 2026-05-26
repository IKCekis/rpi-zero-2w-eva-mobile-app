import React, { useMemo } from 'react';
import Svg, { Rect } from 'react-native-svg';

interface PixelSpriteProps {
  rows?:   string[];
  palette: Record<string, string>;
  scale?:  number;
}

export function PixelSprite({ rows, palette, scale = 4 }: PixelSpriteProps) {
  const safeRows = rows ?? [];
  const h = safeRows.length;
  const w = safeRows[0]?.length ?? 0;

  const cells = useMemo(() => {
    const out: React.ReactElement[] = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const ch = safeRows[y][x];
        const fill = palette[ch];
        if (!fill || ch === ' ' || ch === '.') continue;
        out.push(
          <Rect key={`${x},${y}`} x={x} y={y}
            width={1.02} height={1.02} fill={fill} />
        );
      }
    }
    return out;
  }, [safeRows, palette]);

  return (
    <Svg
      width={w * scale}
      height={h * scale}
      viewBox={`0 0 ${w} ${h}`}
    >
      {cells}
    </Svg>
  );
}
