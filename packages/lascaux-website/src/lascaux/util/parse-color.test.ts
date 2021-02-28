import parseColor, { toCssRgbaColor } from './parse-color';

describe('parseColor', () => {
  it.each`
    color          | expected
    ${'#ffffff'}   | ${[1, 1, 1, 1]}
    ${'#'}         | ${[0, 0, 0, 0]}
    ${'red'}       | ${[0, 0, 0, 0]}
    ${'#000000'}   | ${[0, 0, 0, 1]}
    ${'#00000000'} | ${[0, 0, 0, 0]}
    ${'#808080'}   | ${[128 / 255, 128 / 255, 128 / 255, 1]}
    ${'#80808080'} | ${[128 / 255, 128 / 255, 128 / 255, 128 / 255]}
  `('parseColor($value) => $expected', ({ color, expected }) => {
    expect(parseColor(color)).toEqual(expected);
  });
});

describe('toCssRgbaColor', () => {
  it.each`
    color           | expected
    ${[1, 1, 1, 1]} | ${'rgba(255.0,255.0,255.0,1)'}
    ${[0, 0, 0, 0]} | ${'rgba(0.0,0.0,0.0,0)'}
  `('toCssRgbaColor($value) => $expected', ({ color, expected }) => {
    expect(toCssRgbaColor(color)).toEqual(expected);
  });
});
