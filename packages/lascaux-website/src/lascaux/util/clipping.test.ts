import { clamp, clampRange } from './clipping';

describe('clamp', () => {
  it.each`
    value   | min  | max   | expected
    ${5}    | ${1} | ${10} | ${5}
    ${0}    | ${1} | ${10} | ${1}
    ${1}    | ${1} | ${10} | ${1}
    ${1.5}  | ${1} | ${10} | ${1.5}
    ${9.5}  | ${1} | ${10} | ${9.5}
    ${10}   | ${1} | ${10} | ${10}
    ${10.1} | ${1} | ${10} | ${10}
    ${15}   | ${1} | ${10} | ${10}
  `('clamp($value,$min,$max) = $expected', ({ value, min, max, expected }) => {
    expect(clamp(value, min, max)).toBe(expected);
  });
});

describe('clampRange', () => {
  it.each`
    position | viewportSize | canvasSize | bufferRatio | scale | expected
    ${0}     | ${1000}      | ${500}     | ${10}       | ${1}  | ${0}
    ${-100}  | ${1000}      | ${500}     | ${10}       | ${1}  | ${-100}
    ${-500}  | ${1000}      | ${500}     | ${10}       | ${1}  | ${-500}
    ${-5000} | ${1000}      | ${500}     | ${10}       | ${1}  | ${-5000}
  `(
    'clampRange($position, $viewportSize, $canvasSize, $bufferRatio, $scale) => $expected',
    ({ position, viewportSize, canvasSize, bufferRatio, scale, expected }) => {
      expect(
        clampRange(position, viewportSize, canvasSize, bufferRatio, scale),
      ).toBe(expected);
    },
  );
});
