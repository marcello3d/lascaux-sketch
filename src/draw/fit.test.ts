import { containInBox } from './fit';

describe('containInBox', () => {
  it.each<[number, number, number, number, [number, number]]>([
    [100, 100, 100, 100, [100, 100]],
    [100, 100, 200, 200, [200, 200]],
    [100, 100, 20, 20, [20, 20]],
    [100, 100, 200, 100, [100, 100]],
    [100, 100, 100, 200, [100, 100]],
    [200, 100, 100, 100, [100, 50]],
    [100, 200, 100, 100, [50, 100]],
  ])(
    'works with (%d, %d, %d, %d)',
    (width, height, boxWidth, boxHeight, expected) => {
      expect(containInBox(width, height, boxWidth, boxHeight)).toEqual(
        expected,
      );
    },
  );
});
