import parseColor from './parse-color';

describe('parseColor', () => {
  it('parses #ffffff', () => {
    expect(parseColor('#ffffff')).toEqual([1, 1, 1]);
  });
  it('parses #808080', () => {
    expect(parseColor('#808080')).toEqual([128 / 255, 128 / 255, 128 / 255]);
  });
});
