import { Color } from '../DrawingDoc';

export default function parseColor(cssHexColor: string): Color {
  const matches = /^#([a-f0-9]{2})([a-f0-9]{2})([a-f0-9]{2})([a-f0-9]{2})?$/i.exec(
    cssHexColor,
  );
  return matches
    ? [
        parseInt(matches[1], 16) / 255,
        parseInt(matches[2], 16) / 255,
        parseInt(matches[3], 16) / 255,
        matches[4] ? parseInt(matches[4], 16) / 255 : 1.0,
      ]
    : [0, 0, 0, 0];
}

export function toCssRgbaColor([r, g, b, a]: Color) {
  return `rgba(${r * 255},${g * 255},${b * 255},${a})`;
}
