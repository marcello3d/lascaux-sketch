import { float32ArrayToUint16Array } from './float16';

describe('float32ArrayToUint16Array', () => {
  it.each`
    value          | expected
    ${0}           | ${0}
    ${0.5}         | ${0x3800}
    ${1}           | ${0x3c00}
    ${1.5}         | ${0x3e00}
    ${-1}          | ${0xbc00}
    ${-0}          | ${0x8000}
    ${-1}          | ${0xbc00}
    ${-10000}      | ${0xf0e2}
    ${-50}         | ${0xd240}
    ${-0.1234}     | ${0xafe6}
    ${NaN}         | ${0x7c00}
    ${Infinity}    | ${0x7c00}
    ${10000000000} | ${0x7ef9}
    ${1e100}       | ${0x7c00}
    ${1e-5}        | ${0xa8}
    ${1e-10}       | ${0}
    ${1e-50}       | ${0}
    ${1e-100}      | ${0}
    ${-Infinity}   | ${0xfc00}
  `('converts float $value to uint16 $expected', ({ value, expected }) => {
    expect(float32ArrayToUint16Array(new Float32Array([value]))[0]).toBe(
      expected,
    );
  });
  it('converts to existing Uint16Array', () => {
    const array = new Uint16Array(4);
    expect(
      float32ArrayToUint16Array(new Float32Array([3.141, 1.414, 2.718]), array),
    ).toMatchInlineSnapshot(`
      Uint16Array [
        16968,
        15784,
        16752,
        0,
      ]
    `);
  });
});
