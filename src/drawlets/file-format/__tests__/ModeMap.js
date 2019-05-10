/* global describe, it, expect */

import ModeMap from '../ModeMap'

function makeModeMap (modes) {
  const map = new ModeMap()
  for (const [source, target] of modes) {
    map.addMode(source, target)
  }
  return map
}

describe('ModeMap', () => {
  it('empty ModeMap', () => {
    const { _modeMap } = makeModeMap([])
    expect({ _modeMap }).toEqual({
      _modeMap: {}
    })
  })
  it('1 mode', () => {
    const { _modeMap } = makeModeMap([
      [2, { foo: 1 }]
    ])
    expect({ _modeMap }).toEqual({
      _modeMap: {
        2: { foo: 1 }
      }
    })
  })
  it('1 mode', () => {
    const { _modeMap } = makeModeMap([
      [0, { foo: 1 }]
    ])
    expect({ _modeMap }).toEqual({
      _modeMap: {
        0: { foo: 1 }
      }
    })
  })
  it('2 modes', () => {
    const { _modeMap } = makeModeMap([
      [2, { foo: 1 }],
      [3, { bar: 1 }]
    ])
    expect({ _modeMap }).toEqual({
      _modeMap: {
        2: { foo: 1 },
        3: { foo: 1, bar: 1 }
      }
    })
  })
  it('2 modes with full overlap', () => {
    const { _modeMap } = makeModeMap([
      [2, { foo: 1 }],
      [3, { foo: 2 }]
    ])
    expect({ _modeMap }).toEqual({
      _modeMap: {
        2: { foo: 1 },
        3: { foo: 2 }
      }
    })
  })
  it('2 modes with some overlap', () => {
    const { _modeMap } = makeModeMap([
      [2, { foo: 1 }],
      [3, { foo: 2, bar: 1 }]
    ])
    expect({ _modeMap }).toEqual({
      _modeMap: {
        2: { foo: 1 },
        3: { foo: 2, bar: 1 }
      }
    })
  })
})

describe('ModeMap errors', () => {
  it('modes 2 then 1 should fail', () => {
    expect(() => makeModeMap([
      [2, {}],
      [1, {}]
    ])).toThrowError('modes must be added in order')
  })
})

describe('ModeMap.serialize', () => {
  it('2 modes with overlap', () => {
    expect(makeModeMap([
      [2, { foo: 1 }],
      [3, { foo: 2 }]
    ]).serialize()).toEqual([
      2, { foo: 1 },
      3, { foo: 2 }
    ])
  })
  it('2 modes without overlap', () => {
    expect(makeModeMap([
      [2, { foo: 1 }],
      [3, { bar: 2 }]
    ]).serialize()).toEqual([
      2, { foo: 1 },
      3, { bar: 2 }
    ])
  })
  it('initial mode', () => {
    const map = new ModeMap({foo: 2})
    map.addMode(1, { foo: 3 })
    expect(map.serialize()).toEqual([
      -1, { foo: 2 },
      1, { foo: 3 }
    ])
  })
  it('empty', () => {
    const map = new ModeMap()
    expect(map.serialize()).toEqual([])
  })
})

describe('ModeMap.deserialize', () => {
  it('empty', () => {
    const { _modeMap } = ModeMap.deserialize([])
    expect({ _modeMap }).toEqual({
      _modeMap: {}
    })
  })
  it('2 modes with overlap', () => {
    const { _modeMap } = ModeMap.deserialize([
      2, { foo: 1 },
      3, { foo: 2 }
    ])
    expect({ _modeMap }).toEqual({
      _modeMap: {
        2: { foo: 1 },
        3: { foo: 2 }
      }
    })
  })
  it('2 modes without overlap', () => {
    const { _modeMap } = ModeMap.deserialize([
      2, { foo: 1 },
      3, { bar: 2 }
    ])
    expect({ _modeMap }).toEqual({
      _modeMap: {
        2: { foo: 1 },
        3: { foo: 1, bar: 2 }
      }
    })
  })
  it('initial mode', () => {
    const { _modeMap } = ModeMap.deserialize([
      -1, { foo: 2 },
      1, { foo: 3 }
    ])
    expect({ _modeMap }).toEqual({
      _modeMap: {
        [-1]: { foo: 2 },
        1: { foo: 3 }
      }
    })
  })
})

describe('ModeMap.getMode', () => {
  it('empty modes', () => {
    const modeMap = makeModeMap([])
    expect(modeMap.getMode(0)).toEqual({})
    expect(modeMap.getMode(1)).toEqual({})
    expect(modeMap.getMode(2)).toEqual({})
  })
  it('1 mode at start', () => {
    const modeMap = makeModeMap([
      [0, { foo: 1 }]
    ])
    expect(modeMap.getMode(0)).toEqual({})
    expect(modeMap.getMode(1)).toEqual({ foo: 1 })
  })
  it('2 modes without overlap 1', () => {
    const modeMap = makeModeMap([
      [1, { foo: 1 }],
      [2, { bar: 2 }]
    ])
    expect(modeMap.getMode(0)).toEqual({})
    expect(modeMap.getMode(1)).toEqual({})
    expect(modeMap.getMode(2)).toEqual({ foo: 1 })
    expect(modeMap.getMode(3)).toEqual({ foo: 1, bar: 2 })
    expect(modeMap.getMode(4)).toEqual({ foo: 1, bar: 2 })
  })
  it('2 modes without overlap 2', () => {
    const modeMap = makeModeMap([
      [1, { foo: 1 }],
      [3, { bar: 2 }]
    ])
    expect(modeMap.getMode(0)).toEqual({})
    expect(modeMap.getMode(1)).toEqual({})
    expect(modeMap.getMode(2)).toEqual({ foo: 1 })
    expect(modeMap.getMode(3)).toEqual({ foo: 1 })
    expect(modeMap.getMode(4)).toEqual({ foo: 1, bar: 2 })
    expect(modeMap.getMode(5)).toEqual({ foo: 1, bar: 2 })
    expect(modeMap.getMode(6)).toEqual({ foo: 1, bar: 2 })
  })
  it('2 modes with overlap 1', () => {
    const modeMap = makeModeMap([
      [1, { foo: 1 }],
      [2, { foo: 2 }]
    ])
    expect(modeMap.getMode(0)).toEqual({})
    expect(modeMap.getMode(1)).toEqual({})
    expect(modeMap.getMode(2)).toEqual({ foo: 1 })
    expect(modeMap.getMode(3)).toEqual({ foo: 2 })
    expect(modeMap.getMode(4)).toEqual({ foo: 2 })
  })
  it('2 modes with overlap 2', () => {
    const modeMap = makeModeMap([
      [1, { foo: 1 }],
      [3, { foo: 2 }]
    ])
    expect(modeMap.getMode(0)).toEqual({})
    expect(modeMap.getMode(1)).toEqual({})
    expect(modeMap.getMode(2)).toEqual({ foo: 1 })
    expect(modeMap.getMode(3)).toEqual({ foo: 1 })
    expect(modeMap.getMode(4)).toEqual({ foo: 2 })
    expect(modeMap.getMode(5)).toEqual({ foo: 2 })
    expect(modeMap.getMode(6)).toEqual({ foo: 2 })
  })
})
