/* global describe, it, expect */

import GotoMap, { isSkipped, Skips } from './GotoMap';

function makeGotoMap(gotos: [number, number][]) {
  const map = new GotoMap();
  for (const [source, target] of gotos) {
    map.addGoto(source, target);
  }
  return map;
}

describe('GotoMap', () => {
  it('empty GotoMap', () => {
    const { _gotoMap, _skipMap } = makeGotoMap([]);
    expect({ _gotoMap, _skipMap }).toEqual({
      _gotoMap: {},
      _skipMap: {},
    });
  });
  it('goto 2,0', () => {
    const { _gotoMap, _skipMap } = makeGotoMap([[2, 0]]);
    expect({ _gotoMap, _skipMap }).toEqual({
      _gotoMap: {
        2: 0,
      },
      _skipMap: {
        2: [[0, 1]],
      },
    });
  });

  it('goto 6,3', () => {
    const { _gotoMap, _skipMap } = makeGotoMap([[6, 3]]);
    expect({ _gotoMap, _skipMap }).toEqual({
      _gotoMap: {
        6: 3,
      },
      _skipMap: {
        6: [[3, 5]],
      },
    });
  });
  it('goto 2,0 4,2', () => {
    const { _gotoMap, _skipMap } = makeGotoMap([
      // 0: draw (cursor 1)
      // 1: draw (cursor 2)
      [2, 0], // 2: goto cursor 0 (cursor 3)
      // 3: draw (cursor 4)
      [4, 2], // 4: goto cursor 2 (cursor 5)
    ]);
    expect({ _gotoMap, _skipMap }).toEqual({
      _gotoMap: {
        2: 0,
        4: 2,
      },
      _skipMap: {
        2: [[0, 1]],
        4: [
          [0, 1],
          [2, 3],
        ],
      },
    });
  });
  it('goto 2,0 5,3', () => {
    const { _gotoMap, _skipMap } = makeGotoMap([
      // 0: draw (cursor 1)
      // 1: draw (cursor 2)
      [2, 0], // 2: goto cursor 0 (cursor 3)
      // 3: draw (cursor 4)
      // 4: draw (cursor 5)
      [5, 3], // 5: goto cursor 3, which is really goto cursor 0 (cursor 6)
    ]);
    expect({ _gotoMap, _skipMap }).toEqual({
      _gotoMap: {
        2: 0,
        5: 0,
      },
      _skipMap: {
        2: [[0, 1]],
        5: [[0, 4]],
      },
    });
  });
  it('goto 2,0 4,0', () => {
    const { _gotoMap, _skipMap } = makeGotoMap([
      [2, 0],
      [4, 0],
    ]);
    expect({ _gotoMap, _skipMap }).toEqual({
      _gotoMap: {
        2: 0,
        4: 0,
      },
      _skipMap: {
        2: [[0, 1]],
        4: [[0, 3]],
      },
    });
  });
});

describe('GotoMap errors', () => {
  it('goto 2,2 should fail', () => {
    expect(makeGotoMap([[2, 2]])._gotos).toEqual([]);
  });
  it('goto 2,3 should fail', () => {
    expect(makeGotoMap([[2, 3]])._gotos).toEqual([]);
  });
  it('goto 2,0 1,0 should fail', () => {
    expect(
      makeGotoMap([
        [2, 0],
        [1, 0],
      ])._gotos,
    ).toEqual([2]);
  });
  it('goto 2,0 2,0 should fail', () => {
    expect(
      makeGotoMap([
        [2, 0],
        [2, 0],
      ])._gotos,
    ).toEqual([2]);
  });
  it('out of order keyframes should fail', () => {
    expect(() => {
      const map = makeGotoMap([]);
      map.addKeyframe(2);
      map.addKeyframe(1);
    }).toThrowError('keyframes must be added in order');
  });
  it('duplicate keyframe should fail', () => {
    expect(() => {
      const map = makeGotoMap([]);
      map.addKeyframe(2);
      map.addKeyframe(2);
    }).toThrowError('keyframes must be added in order');
  });
});

describe('GotoMap.planGoto', () => {
  it('errors', () => {
    const map = makeGotoMap([
      [2, 0],
      [4, 0],
    ]);
    expect(() => map.planGoto(1, 1)).toThrowError('cannot goto self');
    expect(() => map.planGoto(5, 5)).toThrowError('cannot goto self');
    expect(() => map.planGoto(3, 2)).toThrowError('invalid start');
    expect(() => map.planGoto(5, 3)).toThrowError('invalid start');
    expect(() => map.planGoto(6, 3)).toThrowError('invalid end');
    expect(() => map.planGoto(6, 5)).toThrowError('invalid end');
  });
  it('basic', () => {
    const map = makeGotoMap([
      // 0 draw
      // 1 draw
      [2, 0], // 2 undo (goto 0)
    ]);
    expect(map.planGoto(0, 2)).toEqual({ skips: [] });
  });
  it('various plans backward', () => {
    const map = makeGotoMap([
      [2, 0],
      [4, 0],
    ]);
    expect(map.planGoto(4, 2)).toEqual({ revert: 0, skips: [] });
    expect(map.planGoto(6, 2)).toEqual({ revert: 0, skips: [] });
    expect(map.planGoto(6, 0)).toEqual({ revert: 0, skips: [] });
    expect(map.planGoto(6, 4)).toEqual({ revert: 4, skips: [[0, 1]] });
    expect(map.planGoto(7, 6)).toEqual({ revert: 6, skips: [[0, 3]] });
    expect(map.planGoto(4, 2)).toEqual({ revert: 0, skips: [] });
    expect(map.planGoto(1, 0)).toEqual({ revert: 0, skips: [] });
    expect(map.planGoto(4, 0)).toEqual({ revert: 0, skips: [] });
    expect(map.planGoto(6, 0)).toEqual({ revert: 0, skips: [] });
  });

  it('simple step forward', () => {
    const map = makeGotoMap([]);
    expect(map.planGoto(0, 1)).toEqual({ skips: [] });
    expect(map.planGoto(1, 2)).toEqual({ skips: [] });
    expect(map.planGoto(0, 4)).toEqual({ skips: [] });
  });
  it('simple step backward', () => {
    const map = makeGotoMap([]);
    expect(map.planGoto(1, 0)).toEqual({ revert: 0, skips: [] });
    expect(map.planGoto(4, 0)).toEqual({ revert: 0, skips: [] });
    expect(map.planGoto(3, 2)).toEqual({ revert: 2, skips: [] });
  });
  it('step forward with gotos', () => {
    const map = makeGotoMap([[4, 1]]);
    expect(map.planGoto(0, 6)).toEqual({ skips: [[1, 3]] });
    expect(map.planGoto(2, 3)).toEqual({ skips: [] });
    expect(map.planGoto(2, 6)).toEqual({ revert: 1, skips: [[1, 3]] });
    expect(map.planGoto(3, 6)).toEqual({ revert: 1, skips: [[1, 3]] });
  });
  it('step backward with gotos', () => {
    const map = makeGotoMap([[4, 1]]);
    // Outside undone region (1-4), going into it
    expect(map.planGoto(4, 3)).toEqual({ revert: 1, skips: [] });
    expect(map.planGoto(6, 3)).toEqual({ revert: 1, skips: [] });
    expect(map.planGoto(6, 4)).toEqual({ revert: 4, skips: [] });
    expect(map.planGoto(7, 6)).toEqual({ revert: 6, skips: [[1, 3]] });
    expect(map.planGoto(3, 2)).toEqual({ revert: 2, skips: [] });
  });
  it('step from goto to after', () => {
    const map = makeGotoMap([[4, 1]]);
    // Outside undone region (1-4), going into it
    expect(map.planGoto(4, 8)).toEqual({ revert: 1, skips: [[1, 3]] });
  });
  it('step forward with multiple gotos', () => {
    const map = makeGotoMap([
      [2, 0],
      [4, 0],
    ]);
    expect(map.planGoto(0, 1)).toEqual({ skips: [] });
    expect(map.planGoto(0, 2)).toEqual({ skips: [] });
    expect(map.planGoto(0, 4)).toEqual({ skips: [[0, 1]] });
    expect(map.planGoto(0, 6)).toEqual({ skips: [[0, 3]] });
  });
  it('step backward with multiple gotos', () => {
    const map = makeGotoMap([
      [2, 0],
      [4, 0],
    ]);
    expect(map.planGoto(1, 0)).toEqual({ revert: 0, skips: [] });
    expect(map.planGoto(6, 0)).toEqual({ revert: 0, skips: [] });
  });
});

describe('GotoMap.computeRedo', () => {
  it('no gotos', () => {
    const map = makeGotoMap([]);
    expect(map.computeRedo(0)).toBe(undefined);
    expect(map.computeRedo(1)).toBe(undefined);
    expect(map.computeRedo(2)).toBe(undefined);
  });
  it('one goto', () => {
    const map = makeGotoMap([
      // 0: draw (cursor 1)
      // 1: draw (cursor 2)
      [2, 0], // 2: goto cursor 0 (cursor 3) should redo to 2
    ]);
    expect(map.computeRedo(0)).toEqual(2);
    expect(() => map.computeRedo(1)).toThrowError(
      'unexpected computeRedo from 1, expected 0',
    );
    expect(() => map.computeRedo(2)).toThrowError(
      'unexpected computeRedo from 2, expected 0',
    );
    expect(map.computeRedo(3)).toBe(undefined); // no redo
    expect(map.computeRedo(4)).toBe(undefined); // no redo
  });
  it('test two gotos', () => {
    const map = makeGotoMap([
      // 0: draw (cursor 1)
      // 1: draw (cursor 2)
      [2, 0], // 2: goto cursor 0 (cursor 3)
      // 3: draw (cursor 4)
      // 4: draw (cursor 5)
      [5, 4], // 5: goto cursor 4 (cursor 6)
    ]);
    expect(() => map.computeRedo(0)).toThrowError(
      'unexpected computeRedo from 0, expected 4',
    );
    expect(() => map.computeRedo(1)).toThrowError(
      'unexpected computeRedo from 1, expected 4',
    );
    expect(() => map.computeRedo(2)).toThrowError(
      'unexpected computeRedo from 2, expected 4',
    );
    expect(() => map.computeRedo(3)).toThrowError(
      'unexpected computeRedo from 3, expected 4',
    );
    expect(map.computeRedo(4)).toEqual(5);
    expect(() => map.computeRedo(5)).toThrowError(
      'unexpected computeRedo from 5, expected 4',
    );
    expect(map.computeRedo(6)).toBe(undefined); // no redo
    expect(map.computeRedo(7)).toBe(undefined); // no redo
  });
  it('test two adjacent gotos', () => {
    const map = makeGotoMap([
      // 0: draw (cursor 1)
      // 1: draw (cursor 2)
      [2, 0], // 2: goto cursor 0 (cursor 3) should redo to 2
      [3, 1], // 3: goto cursor 1 (cursor 4) no redo
    ]);
    expect(() => map.computeRedo(0)).toThrowError(
      'unexpected computeRedo from 0, expected 1',
    );
    expect(map.computeRedo(1)).toBe(undefined);
    expect(() => map.computeRedo(2)).toThrowError(
      'unexpected computeRedo from 2, expected 1',
    );
    expect(() => map.computeRedo(3)).toThrowError(
      'unexpected computeRedo from 3, expected 1',
    );
    expect(map.computeRedo(4)).toBe(undefined);
    expect(map.computeRedo(5)).toBe(undefined);
  });
  it('test post redo', () => {
    const map = makeGotoMap([
      // 0: draw (cursor 1)
      // 1: draw (cursor 2)
      [2, 0], // 2: goto cursor 0 (cursor 3) should redo to 2
      [3, 2], // 3: goto cursor 2 (cursor 4) should have no redo
    ]);
    expect(() => map.computeRedo(0)).toThrowError(
      'unexpected computeRedo from 0, expected 2',
    );
    expect(() => map.computeRedo(1)).toThrowError(
      'unexpected computeRedo from 1, expected 2',
    );
    expect(map.computeRedo(2)).toBe(undefined);
    expect(() => map.computeRedo(3)).toThrowError(
      'unexpected computeRedo from 3, expected 2',
    );
    expect(map.computeRedo(4)).toBe(undefined);
    expect(map.computeRedo(5)).toBe(undefined);
  });
  it('test undo', () => {
    const map = makeGotoMap([
      // 0: draw (cursor 1)
      // 1: draw (cursor 2)
      [2, 1], // 2: goto cursor 1 (cursor 3) should redo to 2
    ]);
    expect(() => map.computeRedo(0)).toThrowError(
      'unexpected computeRedo from 0, expected 1',
    );
    expect(map.computeRedo(1)).toEqual(2);
    expect(() => map.computeRedo(2)).toThrowError(
      'unexpected computeRedo from 2, expected 1',
    );
    expect(map.computeRedo(3)).toBe(undefined);
    expect(map.computeRedo(4)).toBe(undefined);
  });
  it('test undo-undo', () => {
    const map = makeGotoMap([
      // 0: draw (cursor 1)
      // 1: draw (cursor 2)
      [2, 1], // 2: goto cursor 1 (cursor 3) should redo to 2
      [3, 0], // 3: goto cursor 0 (cursor 4) should redo to 1
    ]);
    expect(map.computeRedo(0)).toEqual(1);
    expect(() => map.computeRedo(1)).toThrowError(
      'unexpected computeRedo from 1, expected 0',
    );
    expect(() => map.computeRedo(2)).toThrowError(
      'unexpected computeRedo from 2, expected 0',
    );
    expect(() => map.computeRedo(3)).toThrowError(
      'unexpected computeRedo from 3, expected 0',
    );
    expect(map.computeRedo(4)).toBe(undefined);
    expect(map.computeRedo(5)).toBe(undefined);
  });
  it('test undo-undo-redo', () => {
    const map = makeGotoMap([
      // 0: draw (cursor 1)
      // 1: draw (cursor 2)
      [2, 1], // 2: goto cursor 1 (cursor 3) should redo to 2
      [3, 0], // 3: goto cursor 0 (cursor 4) should redo to 1
      [4, 1], // 3: goto cursor 1 (cursor 5) should redo to 2
    ]);
    expect(() => map.computeRedo(0)).toThrowError(
      'unexpected computeRedo from 0, expected 1',
    );
    expect(map.computeRedo(1)).toEqual(2);
    expect(() => map.computeRedo(2)).toThrowError(
      'unexpected computeRedo from 2, expected 1',
    );
    expect(() => map.computeRedo(3)).toThrowError(
      'unexpected computeRedo from 3, expected 1',
    );
    expect(() => map.computeRedo(4)).toThrowError(
      'unexpected computeRedo from 4, expected 1',
    );
    expect(map.computeRedo(5)).toBe(undefined);
    expect(map.computeRedo(6)).toBe(undefined);
  });
  it('test post undo-redo-undo', () => {
    const map = makeGotoMap([
      // 0: draw (cursor 1)
      // 1: draw (cursor 2)
      [2, 0], // 2: goto cursor 0 (cursor 3) should redo to 2
      [3, 2], // 3: goto cursor 2 (cursor 4) should have no redo
      [4, 0], // 4: goto cursor 0 (cursor 5) should redo to 2
    ]);
    expect(map.computeRedo(0)).toEqual(2);
    expect(() => map.computeRedo(1)).toThrowError(
      'unexpected computeRedo from 1, expected 0',
    );
    expect(() => map.computeRedo(2)).toThrowError(
      'unexpected computeRedo from 2, expected 0',
    );
    expect(() => map.computeRedo(3)).toThrowError(
      'unexpected computeRedo from 3, expected 0',
    );
    expect(() => map.computeRedo(4)).toThrowError(
      'unexpected computeRedo from 4, expected 0',
    );
    expect(map.computeRedo(5)).toBe(undefined);
    expect(map.computeRedo(6)).toBe(undefined);
  });
  it('test post undo-redo-undo-redo', () => {
    const map = makeGotoMap([
      // 0: draw (cursor 1)
      // 1: draw (cursor 2)
      [2, 0], // 2: goto cursor 0 (cursor 3) should redo to 2
      [3, 2], // 3: goto cursor 2 (cursor 4) should have no redo
      [4, 0], // 4: goto cursor 0 (cursor 5) should redo to 2
      [5, 2], // 5: goto cursor 2 (cursor 6) should have no redo
    ]);
    expect(() => map.computeRedo(0)).toThrowError(
      'unexpected computeRedo from 0, expected 2',
    );
    expect(() => map.computeRedo(1)).toThrowError(
      'unexpected computeRedo from 1, expected 2',
    );
    expect(map.computeRedo(2)).toBe(undefined);
    expect(() => map.computeRedo(3)).toThrowError(
      'unexpected computeRedo from 3, expected 2',
    );
    expect(() => map.computeRedo(4)).toThrowError(
      'unexpected computeRedo from 4, expected 2',
    );
    expect(() => map.computeRedo(5)).toThrowError(
      'unexpected computeRedo from 5, expected 2',
    );
    expect(map.computeRedo(6)).toBe(undefined);
    expect(map.computeRedo(7)).toBe(undefined);
  });
  it('test three adjacent gotos', () => {
    const map = makeGotoMap([
      // 0: draw (cursor 1)
      // 1: draw (cursor 2)
      [2, 0], // 2: goto cursor 0 (cursor 3) should redo to 2
      [3, 1], // 3: goto cursor 1 (cursor 4) should have no redo
      [4, 0], // 4: goto cursor 0 (cursor 5) should redo to 2
    ]);
    expect(map.computeRedo(0)).toEqual(2);
    expect(() => map.computeRedo(1)).toThrowError(
      'unexpected computeRedo from 1, expected 0',
    );
    expect(() => map.computeRedo(2)).toThrowError(
      'unexpected computeRedo from 2, expected 0',
    );
    expect(() => map.computeRedo(3)).toThrowError(
      'unexpected computeRedo from 3, expected 0',
    );
    expect(() => map.computeRedo(4)).toThrowError(
      'unexpected computeRedo from 4, expected 0',
    );
    expect(map.computeRedo(5)).toBe(undefined);
    expect(map.computeRedo(6)).toBe(undefined);
  });
});

describe('GotoMap keyframes', () => {
  it('no gotos, no keyframes', () => {
    const map = makeGotoMap([]);
    expect(map._keyframes).toEqual([]);
  });
  it('no gotos, 3 keyframes', () => {
    const map = makeGotoMap([]);
    map.addKeyframe(0);
    map.addKeyframe(5);
    map.addKeyframe(10);
    expect(map._keyframes).toEqual([0, 5, 10]);
  });
  it('no gotos, 3 keyframes', () => {
    const map = makeGotoMap([]);
    map.addKeyframe(0);
    map.addKeyframe(5);
    map.addKeyframe(10);
    expect(map._keyframes).toEqual([0, 5, 10]);
  });
});

describe('GotoMap.computeUndo', () => {
  it('no gotos, no keyframes', () => {
    const map = makeGotoMap([]);
    expect(map.computeUndo(0)).toBe(undefined);
    expect(map.computeUndo(1)).toBe(undefined);
  });
  it('no gotos, 3 keyframes', () => {
    const map = makeGotoMap([]);
    map.addKeyframe(0);
    map.addKeyframe(5);
    map.addKeyframe(10);
    expect(map.computeUndo(0)).toBe(undefined);
    expect(map.computeUndo(1)).toEqual(0);
    expect(map.computeUndo(2)).toEqual(0);
    expect(map.computeUndo(3)).toEqual(0);
    expect(map.computeUndo(4)).toEqual(0);
    expect(map.computeUndo(5)).toEqual(0);
    expect(map.computeUndo(6)).toEqual(5);
    expect(map.computeUndo(7)).toEqual(5);
    expect(map.computeUndo(8)).toEqual(5);
    expect(map.computeUndo(9)).toEqual(5);
    expect(map.computeUndo(10)).toEqual(5);
    expect(map.computeUndo(11)).toEqual(10);
    expect(map.computeUndo(12)).toEqual(10);
  });
  it('1 keyframes with gotos', () => {
    const map = makeGotoMap([[2, 0]]);
    map.addKeyframe(0);
    map.addKeyframe(3);
    map.addKeyframe(5);
    expect(map.computeUndo(0)).toBe(undefined);
    expect(map.computeUndo(1)).toEqual(0);
    expect(map.computeUndo(2)).toEqual(0);
    expect(map.computeUndo(3)).toBe(undefined);
    expect(map.computeUndo(4)).toEqual(0);
    expect(map.computeUndo(5)).toEqual(0);
    expect(map.computeUndo(6)).toEqual(5);
    expect(map.computeUndo(7)).toEqual(5);
  });
  it('draw, undo, draw', () => {
    // [0, DRAW_START_EVENT], // draw
    // [1, DRAW_EVENT],
    // [2, GOTO_EVENT, 0],  // undo draw
    // [3, DRAW_START_EVENT], // draw again
    // [4, DRAW_EVENT]

    const map = new GotoMap();
    map.addKeyframe(0);
    // 0: draw (cursor 1)
    // 1: draw (cursor 2)
    map.addGoto(2, 0); // 2: goto cursor 0 (cursor 3)
    map.addKeyframe(3);
    // 3: draw (cursor 4)
    // 4: draw (cursor 5)

    expect(map.computeUndo(0)).toBe(undefined);
    expect(map.computeUndo(1)).toEqual(0);
    expect(map.computeUndo(2)).toEqual(0);
    expect(map.computeUndo(3)).toBe(undefined);
    expect(map.computeUndo(4)).toEqual(0);
    expect(map.computeUndo(5)).toEqual(0);
    expect(map.computeUndo(6)).toEqual(0);
  });
  it('draw, draw, draw, undo, undo, undo, redo, redo redo', () => {
    const map = new GotoMap();
    map.addKeyframe(0);
    // 0: draw (cursor 1) undo to cursor 0
    // 1: draw (cursor 2) undo to cursor 0
    map.addKeyframe(2);
    // 2: draw (cursor 3) undo to cursor 2
    // 3: draw (cursor 4) undo to cursor 2
    map.addKeyframe(4);
    // 4: draw (cursor 5) undo to cursor 4
    // 5: draw (cursor 6) undo to cursor 4

    expect(map.computeUndo(0)).toBe(undefined);
    expect(map.computeUndo(1)).toEqual(0);
    expect(map.computeUndo(2)).toEqual(0);
    expect(map.computeUndo(3)).toEqual(2);
    expect(map.computeUndo(4)).toEqual(2);
    expect(map.computeUndo(5)).toEqual(4);

    expect(map.computeUndo(6)).toEqual(4);
    expect(map.computeRedo(6)).toBe(undefined);

    // 6: goto 4 (cursor 7) (undo)
    map.addGoto(6, map.computeUndo(6)!);
    expect(map.computeUndo(4)).toEqual(2);
    expect(map.computeRedo(4)).toEqual(6);
    // 7: goto 2 (cursor 8)
    map.addGoto(7, map.computeUndo(7)!);
    expect(map.computeUndo(2)).toEqual(0);
    expect(map.computeRedo(2)).toEqual(4);
    // 8: goto 0 (cursor 9)
    map.addGoto(8, map.computeUndo(8)!);
    expect(map.computeUndo(0)).toBe(undefined);
    expect(map.computeRedo(0)).toEqual(2);
    // 9: goto 2 (cursor 10)
    map.addGoto(9, map.computeRedo(0)!);
    expect(map.computeUndo(2)).toEqual(0);
    expect(map.computeRedo(2)).toEqual(4);
    // 10: goto 4 (cursor 11)
    map.addGoto(10, map.computeRedo(2)!);
    expect(map.computeUndo(4)).toEqual(2);
    expect(map.computeRedo(4)).toEqual(6);
    // 11: goto 6 (cursor 12)
    map.addGoto(11, map.computeRedo(4)!);
    expect(map.computeUndo(6)).toEqual(4);
    expect(map.computeRedo(6)).toBe(undefined);
  });
  it('draw, draw, undo, undo, redo, redo', () => {
    const map = new GotoMap();
    map.addKeyframe(0);
    map.addKeyframe(2);

    // expect(map.computeRedo(4)).toBe(false)
    // expect(map.computeUndo(4)).toEqual(2)

    map.addGoto(4, 2);
    // expect(map.computeRedo(2)).toEqual(4)
    // expect(map.computeUndo(2)).toEqual(0)

    map.addGoto(5, 0);
    // expect(map.computeRedo(0)).toEqual(2)
    // expect(map.computeUndo(0)).toBe(false)

    map.addGoto(6, 2);
    // expect(map.computeRedo(2)).toEqual(4)
    // expect(map.computeUndo(2)).toEqual(0)

    map.addGoto(7, 4);
    expect(map.computeRedo(4)).toBe(undefined);
    expect(map.computeUndo(4)).toEqual(2);
  });
  // TODO: more complicated goto sets
});

describe('isSkipped', () => {
  it('empty', () => {
    const skips: Skips = [];
    expect(isSkipped(skips, 0)).toBe(false);
    expect(isSkipped(skips, 1)).toBe(false);
    expect(isSkipped(skips, 2)).toBe(false);
  });
  it('[0,1]', () => {
    const skips: Skips = [[0, 1]];
    expect(isSkipped(skips, 0)).toBe(true);
    expect(isSkipped(skips, 1)).toBe(true);
    expect(isSkipped(skips, 2)).toBe(false);
  });
  it('[0,0]', () => {
    const skips: Skips = [[0, 0]];
    expect(isSkipped(skips, 0)).toBe(true);
    expect(isSkipped(skips, 1)).toBe(false);
    expect(isSkipped(skips, 2)).toBe(false);
  });
  it('[1,5]', () => {
    const skips: Skips = [[1, 5]];
    expect(isSkipped(skips, 0)).toBe(false);
    expect(isSkipped(skips, 1)).toBe(true);
    expect(isSkipped(skips, 2)).toBe(true);
    expect(isSkipped(skips, 5)).toBe(true);
    expect(isSkipped(skips, 6)).toBe(false);
  });
  it('[1,2], [3, 4]', () => {
    const skips: Skips = [
      [1, 2],
      [3, 4],
    ];
    expect(isSkipped(skips, 0)).toBe(false);
    expect(isSkipped(skips, 1)).toBe(true);
    expect(isSkipped(skips, 2)).toBe(true);
    expect(isSkipped(skips, 3)).toBe(true);
    expect(isSkipped(skips, 4)).toBe(true);
    expect(isSkipped(skips, 5)).toBe(false);
    expect(isSkipped(skips, 6)).toBe(false);
  });
  it('[1,2], [4, 5]', () => {
    const skips: Skips = [
      [1, 2],
      [4, 5],
    ];
    expect(isSkipped(skips, 0)).toBe(false);
    expect(isSkipped(skips, 1)).toBe(true);
    expect(isSkipped(skips, 2)).toBe(true);
    expect(isSkipped(skips, 3)).toBe(false);
    expect(isSkipped(skips, 4)).toBe(true);
    expect(isSkipped(skips, 5)).toBe(true);
    expect(isSkipped(skips, 6)).toBe(false);
    expect(isSkipped(skips, 7)).toBe(false);
  });
});
