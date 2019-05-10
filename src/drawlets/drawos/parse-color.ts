export default function parseColor(cssHexColor: string) {
  const matches = /^#([a-f0-9]{2})([a-f0-9]{2})([a-f0-9]{2})$/i.exec(cssHexColor);
  return matches
    ? [
        parseInt(matches[1], 16),
        parseInt(matches[2], 16),
        parseInt(matches[3], 16),
      ]
    : [0, 0, 0];
}
