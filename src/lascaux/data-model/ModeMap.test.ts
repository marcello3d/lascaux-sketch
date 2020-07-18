/* global describe, it, expect */

import ModeMap from './ModeMap';

type TestMode = {
  initial?: number;
  foo?: number;
  bar?: number;
};
function makeModeMap(modes: [number, TestMode][]): ModeMap<TestMode> {
  const map = new ModeMap<TestMode>({});
  for (const [source, target] of modes) {
    map.addMode(source, target);
  }
  return map;
}

describe('ModeMap.getMode', () => {
  it('empty modes', () => {
    const modeMap = makeModeMap([]);
    expect(modeMap.getMode(0)).toEqual({});
    expect(modeMap.getMode(1)).toEqual({});
    expect(modeMap.getMode(2)).toEqual({});
  });
  it('1 mode at start', () => {
    const modeMap = makeModeMap([[0, { foo: 1 }]]);
    expect(modeMap.getMode(0)).toEqual({});
    expect(modeMap.getMode(1)).toEqual({ foo: 1 });
  });
  it('2 modes without overlap 1', () => {
    const modeMap = makeModeMap([
      [1, { foo: 1 }],
      [2, { bar: 2 }],
    ]);
    expect(modeMap.getMode(0)).toEqual({});
    expect(modeMap.getMode(1)).toEqual({});
    expect(modeMap.getMode(2)).toEqual({ foo: 1 });
    expect(modeMap.getMode(3)).toEqual({ bar: 2 });
    expect(modeMap.getMode(4)).toEqual({ bar: 2 });
  });
  it('2 modes without overlap 2', () => {
    const modeMap = makeModeMap([
      [1, { foo: 1 }],
      [3, { bar: 2 }],
    ]);
    expect(modeMap.getMode(0)).toEqual({});
    expect(modeMap.getMode(1)).toEqual({});
    expect(modeMap.getMode(2)).toEqual({ foo: 1 });
    expect(modeMap.getMode(3)).toEqual({ foo: 1 });
    expect(modeMap.getMode(4)).toEqual({ bar: 2 });
    expect(modeMap.getMode(5)).toEqual({ bar: 2 });
    expect(modeMap.getMode(6)).toEqual({ bar: 2 });
  });
  it('2 modes with overlap 1', () => {
    const modeMap = makeModeMap([
      [1, { foo: 1 }],
      [2, { foo: 2 }],
    ]);
    expect(modeMap.getMode(0)).toEqual({});
    expect(modeMap.getMode(1)).toEqual({});
    expect(modeMap.getMode(2)).toEqual({ foo: 1 });
    expect(modeMap.getMode(3)).toEqual({ foo: 2 });
    expect(modeMap.getMode(4)).toEqual({ foo: 2 });
  });
  it('2 modes with overlap 2', () => {
    const modeMap = makeModeMap([
      [1, { foo: 1 }],
      [3, { foo: 2 }],
    ]);
    expect(modeMap.getMode(0)).toEqual({});
    expect(modeMap.getMode(1)).toEqual({});
    expect(modeMap.getMode(2)).toEqual({ foo: 1 });
    expect(modeMap.getMode(3)).toEqual({ foo: 1 });
    expect(modeMap.getMode(4)).toEqual({ foo: 2 });
    expect(modeMap.getMode(5)).toEqual({ foo: 2 });
    expect(modeMap.getMode(6)).toEqual({ foo: 2 });
  });
  it('2 identical modes', () => {
    const modeMap = makeModeMap([
      [1, { foo: 1 }],
      [3, { foo: 2 }],
    ]);
    expect(modeMap.getMode(0)).toEqual({});
    expect(modeMap.getMode(1)).toEqual({});
    expect(modeMap.getMode(2)).toEqual({ foo: 1 });
    expect(modeMap.getMode(3)).toEqual({ foo: 1 });
    expect(modeMap.getMode(4)).toEqual({ foo: 2 });
    expect(modeMap.getMode(5)).toEqual({ foo: 2 });
    expect(modeMap.getMode(6)).toEqual({ foo: 2 });
  });
  it('out-of-order modes', () => {
    expect(() =>
      makeModeMap([
        [2, { foo: 1 }],
        [1, { foo: 2 }],
      ]),
    ).toThrowErrorMatchingInlineSnapshot(`"modes must be added in order"`);
  });
  it('different duplicate mode', () => {
    expect(() =>
      makeModeMap([
        [1, { foo: 1 }],
        [1, { foo: 1 }],
      ]),
    ).toThrowErrorMatchingInlineSnapshot(`"modes must be added in order"`);
  });
  it('duplicate mode OK', () => {
    const mode = { foo: 1 };
    const modeMap = makeModeMap([
      [1, mode],
      [1, mode],
    ]);
    expect(modeMap.getMode(0)).toEqual({});
    expect(modeMap.getMode(1)).toEqual({});
    expect(modeMap.getMode(2)).toEqual({ foo: 1 });
  });
});
