import { Color } from '../lascaux/DrawingDoc';
import parseColor from '../lascaux/util/parse-color';

export const hexColorPalette: readonly string[] = [
  '#ffffff', // white
  '#33ccff', // light sky-blue
  '#fddebf', // pale skin tone
  '#ffffb9', // light yellow
  '#ffff00', // yellow
  '#0000ff', // blue
  '#ff0000', // red
  '#00ff00', // green
  '#000000', // black
  '#333399', // dark sky-blue
  '#fca672', // darker skin tone
  '#feae0a', // sandstone yellow
  '#cc6600', // brownish-dark yellow
  '#420066', // dark purple-ish blue
  '#b00077', // dark magenta-ish red
  '#006666', // dark blue-ish green
];

export const rgbaColorPalette: readonly Color[] = hexColorPalette.map(
  parseColor,
);
