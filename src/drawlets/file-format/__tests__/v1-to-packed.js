/* eslint-env jest */

import {
  convertEvent,
  convertMetadata,
  convertEvents,
  convertJson
} from '../v1-to-packed'

import { encode } from 'msgpack-lite'

import {
  readFile,
  writeFileSync
} from 'fs'
import { resolve } from 'path'

function readJson (filename) {
  const path = resolve(__dirname, filename)
  return new Promise((resolve, reject) => {
    readFile(path, 'utf8', (error, contents) => {
      if (error) {
        reject(error)
      } else {
        resolve(JSON.parse(contents))
      }
    })
  })
}

// toBe
// toBeCloseTo
// toBeDefined
// toBeFalsy
// toBeGreaterThan
// toBeLessThan
// toBeNaN
// toBeNull
// toBeTruthy
// toBeUndefined
// toContain
// toEqual
// toHaveBeenCalled
// toHaveBeenCalledWith
// toHaveBeenCalledTimes
// toMatch
// toThrow
// toThrowError

describe('size tests', () => {
  it('size comparison', () => {
    expect(encode(['x', 'y']).length).toEqual(5)
    expect(encode(['x', 'y'].join('|')).length).toEqual(4)

    expect(encode(['x', 'y', 'force']).length).toEqual(11)
    expect(encode(['x', 'y', 'force'].join('|')).length).toEqual(10)

    expect(encode(['x', 'y', 'force', 'altitude', 'azimuth']).length).toEqual(28)
    expect(encode(['x', 'y', 'force', 'altitude', 'azimuth'].join('|')).length).toEqual(27)
  })
})

describe('convertMetadata', () => {
  it('simple metadata conversion', () => {
    const result = convertMetadata({
      'id': '9bnsrg88x7m',
      'name': 'Drawing',
      'drawingSpec': {
        'id': 'fiver-gl',
        'colors': ['#497aa6', '#f2c063', '#f2dbce', '#a6654e', '#f2695c'],
        'sizes': [1, 3, 8, 15, 30],
        'width': 512,
        'height': 512,
        'randomseed': 'ca8a9eqefpa'
      }
    })
    expect(result).toEqual({
      'e': '+metadata',
      'p': {
        'id': '9bnsrg88x7m',
        'name': 'Drawing',
        'drawingSpec': {
          'id': 'fiver-gl',
          'colors': ['#497aa6', '#f2c063', '#f2dbce', '#a6654e', '#f2695c'],
          'sizes': [1, 3, 8, 15, 30],
          'width': 512,
          'height': 512,
          'randomseed': 'ca8a9eqefpa'
        }
      }
    })
  })

  it('size comparison', () => {
    expect(encode({
      '$e': '+metadata',
      'id': '9bnsrg88x7m',
      'name': 'Drawing',
      'drawingSpec': {
        'id': 'fiver-gl',
        'colors': ['#497aa6', '#f2c063', '#f2dbce', '#a6654e', '#f2695c'],
        'sizes': [1, 3, 8, 15, 30],
        'width': 512,
        'height': 512,
        'randomseed': 'ca8a9eqefpa'
      }
    }).length).toEqual(169)
    expect(encode({
      'e': '+metadata',
      'p': {
        'id': '9bnsrg88x7m',
        'name': 'Drawing',
        'drawingSpec': {
          'id': 'fiver-gl',
          'colors': ['#497aa6', '#f2c063', '#f2dbce', '#a6654e', '#f2695c'],
          'sizes': [1, 3, 8, 15, 30],
          'width': 512,
          'height': 512,
          'randomseed': 'ca8a9eqefpa'
        }
      }
    }).length).toEqual(171)
  })
})

describe('convertEvent', () => {
  it('touch event conversion', () => {
    const {
      cursor,
      command,
      floatArray
    } = convertEvent([9002, 'start', {
      'x': 225.984375,
      'phase': 'start',
      'y': 343.9908447265625,
      'ts': 292135.139
    }])

    expect(cursor).toEqual({
      'e': '%cursor',
      'T': 9002,
      'p': { 'type': 'touch' }
    })

    expect(command).toEqual({
      'e': 'start',
      'T': 9002,
      'F': ['x', 'y']
    })

    expect(floatArray).toEqual(new Float32Array([
      0,
      225.984375,
      343.9908447265625
    ]))
  })
  it('force touch event conversion', () => {
    const {
      cursor,
      command,
      floatArray
    } = convertEvent([9002, 'start', {
      'x': 225.984375,
      'phase': 'start',
      'y': 343.9908447265625,
      'ts': 292135.139,
      'force': 0.0765625,
      'forceMax': 4.166666666666667
    }])

    expect(cursor).toEqual({
      'e': '%cursor',
      'T': 9002,
      'p': {
        'type': 'touch',
        'force': true,
        'forceMax': 4.166666666666667
      }
    })

    expect(command).toEqual({
      'e': 'start',
      'T': 9002,
      'F': ['x', 'y', 'force']
    })

    expect(floatArray).toEqual(new Float32Array([
      0,
      225.984375,
      343.9908447265625,
      0.07656250149011612
    ]))
  })
  it('stylus event conversion', () => {
    const {
      cursor,
      command,
      floatArray
    } = convertEvent([9002, 'start', {
      'x': 225.984375,
      'phase': 'start',
      'y': 343.9908447265625,
      'ts': 292135.139,
      'force': 0.0765625,
      'forceMax': 4.166666666666667,
      'type': 'touch',
      'azimuth': -0.08378601074218775,
      'altitude': 0.9957536021855216
    }])

    expect(cursor).toEqual({
      'e': '%cursor',
      'T': 9002,
      'p': {
        'type': 'stylus',
        'force': true,
        'tilt': true,
        'forceMax': 4.166666666666667
      }
    })

    expect(command).toEqual({
      'e': 'start',
      'T': 9002,
      'F': ['x', 'y', 'force', 'altitude', 'azimuth']
    })

    expect(floatArray).toEqual(new Float32Array([
      0,
      225.984375,
      343.9908447265625,
      0.07656250149011612,
      0.9957535862922668,
      -0.0837860107421875
    ]))
  })

  it('draw event with priors', () => {
    const lastCursor = {
      'e': '%cursor',
      'T': 9002,
      'p': {
        'type': 'stylus',
        'force': true,
        'forceMax': 4.166666666666667,
        'tilt': true
      }
    }
    const lastCommand = {
      'e': 'draw',
      'T': 9002,
      'F': ['x', 'y', 'force', 'altitude', 'azimuth']
    }
    const lastFloatArray = new Float32Array([
      0,
      225.984375,
      343.9908447265625,
      0.07656250149011612,
      0.9957535862922668,
      -0.0837860107421875
    ])
    let { cursor, command, floatArray } = convertEvent([2, 'drag', {
      'x': 225.2578125,
      'phase': 'drag',
      'y': 344.0638122558594,
      'ts': 292135.143,
      'force': 0.0765625,
      'forceMax': 4.166666666666667,
      'type': '%cursor',
      'azimuth': -0.08378601074218775,
      'altitude': 0.9957536021855216
    }], lastCursor, lastCommand, lastFloatArray)

    expect(cursor).toBeFalsy()
    expect(command).toBeFalsy()
    expect(floatArray).toEqual(new Float32Array([
      2,
      225.2578125,
      118.07943725585938,
      -343.9142761230469,
      0.9191911220550537,
      -1.0795396566390991
    ]))
  })
  it('draw event with changing forceMax', () => {
    const lastCursor = {
      'e': '%cursor',
      'T': 9002,
      'p': {
        'type': 'stylus',
        'force': true,
        'forceMax': 2,
        'tilt': true
      }
    }
    const lastCommand = {
      'e': 'draw',
      'T': 9002,
      'F': ['x', 'y', 'force', 'altitude', 'azimuth']
    }
    const lastFloatArray = new Float32Array([
      0,
      225.984375,
      343.9908447265625,
      0.07656250149011612,
      0.9957535862922668,
      -0.0837860107421875
    ])
    let { cursor, command, floatArray } = convertEvent([2, 'drag', {
      'x': 225.2578125,
      'phase': 'drag',
      'y': 344.0638122558594,
      'ts': 292135.143,
      'force': 0.0765625,
      'forceMax': 4.166666666666667,
      'type': '%cursor',
      'azimuth': -0.08378601074218775,
      'altitude': 0.9957536021855216
    }], lastCursor, lastCommand, lastFloatArray)

    expect(cursor).toEqual({
      'e': '%cursor',
      'T': 2,
      'p': {
        'type': 'stylus',
        'force': true,
        'forceMax': 4.166666666666667,
        'tilt': true
      }
    })
    // This is emitted a second time because the cursor changed
    expect(command)
      .toEqual({
        'e': 'draw',
        'T': 2,
        'F': ['x', 'y', 'force', 'altitude', 'azimuth']
      })
    expect(floatArray).toEqual(new Float32Array([
      0,
      225.2578125,
      344.0638122558594,
      0.07656250149011612,
      0.9957535862922668,
      -0.0837860107421875
    ]))
  })

  it('draw event with changing command', () => {
    const lastCursor = {
      'e': '%cursor',
      'T': 9002,
      'p': {
        'type': 'stylus',
        'force': true,
        'forceMax': 2,
        'tilt': true
      }
    }
    const lastCommand = {
      'e': 'draw',
      'T': 9002,
      'F': ['x', 'y', 'force', 'altitude', 'azimuth']
    }
    const lastFloatArray = new Float32Array([
      0,
      225.984375,
      343.9908447265625,
      0.07656250149011612,
      0.9957535862922668,
      -0.0837860107421875
    ])

    let { cursor, command, floatArray } = convertEvent([2, '%color', {
      'color': 'red' // this is contrived
    }], lastCursor, lastCommand, lastFloatArray)

    expect(cursor).toBeFalsy()
    // This is emitted a second time because the cursor changed
    expect(command)
      .toEqual({
        'e': '%color',
        'T': 2,
        'p': { 'color': 'red' }
      })
    expect(floatArray).toBeFalsy()
  })

  it('two event conversion draw', () => {
    const {
      command: lastCommand,
      cursor: lastCursor,
      floatArray: lastFloatArray
    } = convertEvent([9002, 'start', {
      'x': 225.984375,
      'phase': 'start',
      'y': 343.9908447265625,
      'ts': 292135.139,
      'force': 0.0765625,
      'forceMax': 4.166666666666667,
      'type': 'touch',
      'azimuth': -0.08378601074218775,
      'altitude': 0.9957536021855216
    }])

    let { cursor, command, floatArray } = convertEvent([2, 'drag', {
      'x': 225.2578125,
      'phase': 'drag',
      'y': 344.0638122558594,
      'ts': 292135.143,
      'force': 0.0765625,
      'forceMax': 4.166666666666667,
      'type': '%cursor',
      'azimuth': -0.08378601074218775,
      'altitude': 0.9957536021855216
    }], lastCursor, lastCommand, lastFloatArray)

    expect(cursor).toBeFalsy()
    expect(command).toEqual({
      e: 'draw',
      T: 2,
      F: ['x', 'y', 'force', 'altitude', 'azimuth']
    })
    expect(floatArray).toEqual(new Float32Array([
      0,
      225.2578125,
      344.0638122558594,
      0.07656250149011612,
      0.9957535862922668,
      -0.0837860107421875
    ]))
  })
  it('two event conversion mode shift', () => {
    const {
      command: lastCommand,
      cursor: lastCursor,
      floatArray: lastFloatArray
    } = convertEvent([9002, 'start', {
      'x': 225.984375,
      'phase': 'start',
      'y': 343.9908447265625,
      'ts': 292135.139,
      'force': 0.0765625,
      'forceMax': 4.166666666666667,
      'type': 'touch',
      'azimuth': -0.08378601074218775,
      'altitude': 0.9957536021855216
    }])

    const {
      command: lastCommand2,
      cursor: lastCursor2,
      floatArray: lastFloatArray2
    } = convertEvent([9002, 'start', {
      'x': 225.984375,
      'phase': 'start',
      'y': 343.9908447265625,
      'ts': 292135.139,
      'force': 0.0765625,
      'forceMax': 4.166666666666667,
      'type': 'touch',
      'azimuth': -0.08378601074218775,
      'altitude': 0.9957536021855216
    }], lastCursor, lastCommand, lastFloatArray)

    let { cursor, command, floatArray } = convertEvent([2, 'drag', {
      'x': 225.2578125,
      'phase': 'drag',
      'y': 344.0638122558594,
      'ts': 292135.143,
      'force': 0.0765625,
      'forceMax': 4.166666666666667,
      'type': '%cursor',
      'azimuth': -0.08378601074218775,
      'altitude': 0.9957536021855216
    }], lastCursor2, lastCommand2, lastFloatArray2)

    expect(command)
      .toEqual({
        'e': 'draw',
        'T': 2,
        'F': ['x', 'y', 'force', 'altitude', 'azimuth']
      })
    expect(cursor).toEqual({
      'e': '%cursor',
      'T': 2,
      'p': {
        'type': 'stylus',
        'force': true,
        'forceMax': 4.166666666666667,
        'tilt': true
      }
    })
    expect(floatArray).toEqual(new Float32Array([
      0,
      225.2578125,
      344.0638122558594,
      0.07656250149011612,
      0.9957535862922668,
      -0.0837860107421875
    ]))
  })
})

describe('convertEvents', () => {
  it('1 event', () => {
    const events = convertEvents([
      [9002, 'start', {
        'x': 225.984375,
        'phase': 'start',
        'y': 343.9908447265625,
        'ts': 292135.139,
        'force': 0.0765625,
        'forceMax': 4.166666666666667,
        'type': 'touch',
        'azimuth': -0.08378601074218775,
        'altitude': 0.9957536021855216
      }]
    ])

    expect(events).toEqual([
      {
        'e': '%cursor',
        'T': 9002,
        'p': {
          'type': 'stylus',
          'force': true,
          'tilt': true,
          'forceMax': 4.166666666666667
        }
      },
      {
        'e': 'start',
        'T': 9002,
        'F': ['x', 'y', 'force', 'altitude', 'azimuth']
      },
      new Float32Array([
        0,
        225.984375,
        343.9908447265625,
        0.07656250149011612,
        0.9957535862922668,
        -0.0837860107421875
      ])
    ])
  })
  it('2 events', () => {
    const events = convertEvents([
      [9002, 'start', {
        'x': 225.984375,
        'phase': 'start',
        'y': 343.9908447265625,
        'ts': 292135.139,
        'force': 0.0765625,
        'forceMax': 4.166666666666667,
        'type': 'touch',
        'azimuth': -0.08378601074218775,
        'altitude': 0.9957536021855216
      }],
      [2, 'drag', {
        'x': 225.2578125,
        'phase': 'drag',
        'y': 344.0638122558594,
        'ts': 292135.143,
        'force': 0.0765625,
        'forceMax': 4.166666666666667,
        'type': '%cursor',
        'azimuth': -0.08378601074218775,
        'altitude': 0.9957536021855216
      }]
    ])

    expect(events).toEqual([
      {
        'e': '%cursor',
        'T': 9002,
        'p': {
          'type': 'stylus',
          'force': true,
          'tilt': true,
          'forceMax': 4.166666666666667
        }
      },
      {
        'e': 'start',
        'T': 9002,
        'F': ['x', 'y', 'force', 'altitude', 'azimuth']
      },
      new Float32Array([
        0,
        225.984375,
        343.9908447265625,
        0.07656250149011612,
        0.9957535862922668,
        -0.0837860107421875
      ]),
      {
        'e': 'draw',
        'T': 2,
        'F': ['x', 'y', 'force', 'altitude', 'azimuth']
      },
      new Float32Array([
        0,
        225.2578125,
        344.0638122558594,
        0.07656250149011612,
        0.9957535862922668,
        -0.0837860107421875
      ])
    ])
  })
  it('3 events', () => {
    const events = convertEvents([
      [9002, 'start', {
        'x': 225.984375,
        'phase': 'start',
        'y': 343.9908447265625,
        'ts': 292135.139,
        'force': 0.0765625,
        'forceMax': 4.166666666666667,
        'type': 'touch',
        'azimuth': -0.08378601074218775,
        'altitude': 0.9957536021855216
      }],
      [9002, 'drag', {
        'x': 225.984375,
        'phase': 'start',
        'y': 343.9908447265625,
        'ts': 292135.139,
        'force': 0.0765625,
        'forceMax': 4.166666666666667,
        'type': 'touch',
        'azimuth': -0.08378601074218775,
        'altitude': 0.9957536021855216
      }],
      [2, 'drag', {
        'x': 225.2578125,
        'phase': 'drag',
        'y': 344.0638122558594,
        'ts': 292135.143,
        'force': 0.0765625,
        'forceMax': 4.166666666666667,
        'type': '%cursor',
        'azimuth': -0.08378601074218775,
        'altitude': 0.9957536021855216
      }]
    ])

    expect(events).toEqual([
      {
        'e': '%cursor',
        'T': 9002,
        'p': {
          'type': 'stylus',
          'force': true,
          'forceMax': 4.166666666666667,
          'tilt': true
        }
      },
      {
        'e': 'start',
        'T': 9002,
        'F': ['x', 'y', 'force', 'altitude', 'azimuth']
      },
      new Float32Array([
        0,
        225.984375,
        343.9908447265625,
        0.07656250149011612,
        0.9957535862922668,
        -0.0837860107421875
      ]),
      {
        'e': 'draw',
        'T': 9002,
        'F': ['x', 'y', 'force', 'altitude', 'azimuth']
      },
      new Float32Array([
        0,
        225.984375,
        343.9908447265625,
        0.07656250149011612,
        0.9957535862922668,
        -0.0837860107421875
      ]),
      new Float32Array([
        2,
        225.2578125,
        118.07943725585938,
        -343.9142761230469,
        0.9191911220550537,
        -1.0795396566390991
      ])
    ])
  })
})

describe('convertJson', () => {
  it('simple json conversion', () => {
    const events = convertJson({
      metadata: { madeUp: 'stuff' },
      events: [
        [100, 'cool', { 'things': 'and stuff' }]
      ]
    })
    expect(events).toEqual([
      {
        'e': '+metadata',
        'p': { 'madeUp': 'stuff' }
      },
      {
        'e': 'cool',
        'T': 100,
        'p': { 'things': 'and stuff' }
      }
    ])
  })
  // Skipped because it's slow
  it.skip('simple json conversion', async () => {
    const json = await readJson('./legacy-drawing.json')
    const events = convertJson(json)
    // eslint-disable-next-line no-constant-condition
    if (false) {
      writeFileSync(resolve(__dirname, './mapped-legacy-drawing.json'), JSON.stringify(events, null, 2), 'utf8')
    } else {
      const expectedEvents = await readJson('./mapped-legacy-drawing.json')
      console.log('got expected events', expectedEvents.length)
      expect(events.length).toEqual(expectedEvents.length)
      events.forEach((event, index) => {
        expect(JSON.parse(JSON.stringify(event))).toEqual(expectedEvents[index])
      })
    }
  })
})
