/* eslint-env jest */

import {
  mapRawEvents
} from '../packed-to-unpacked'

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

describe('UnpackEventStream', () => {
  it('simple event conversion', () => {
    const events = mapRawEvents([
      {
        'e': '%cursor',
        't': 10,
        'p': {'type': 'stylus', 'force': true, 'forceMax': 4.166666666666667, 'tilt': true}
      },
      {
        'e': 'draw',
        't': 20,
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
        'e': '%cursor',
        't': 30,
        'p': {'type': 'stylus', 'force': true, 'forceMax': 4.166666666666667, 'tilt': true}
      },
      {
        'e': 'draw',
        't': 40,
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
        10,
        225.2578125,
        118.07943725585938,
        -343.9142761230469,
        0.9191911220550537,
        -1.0795396566390991
      ])
    ])
    expect(events).toEqual([
      {
        'type': '%cursor',
        'time': 10,
        'payload': {'type': 'stylus', 'force': true, 'forceMax': 4.166666666666667, 'tilt': true}
      },
      {
        'type': 'draw',
        'time': 20,
        'payload': {
          'x': 225.984375,
          'y': 343.9908447265625,
          'force': 0.07656250149011612,
          'altitude': 0.9957535862922668,
          'azimuth': -0.0837860107421875
        }
      },
      {
        'type': '%cursor',
        'time': 30,
        'payload': {'type': 'stylus', 'force': true, 'forceMax': 4.166666666666667, 'tilt': true}
      },
      {
        'type': 'draw',
        'time': 40,
        'payload': {
          'x': 225.984375,
          'y': 343.9908447265625,
          'force': 0.07656250149011612,
          'altitude': 0.9957535862922668,
          'azimuth': -0.0837860107421875
        }
      },
      {
        'type': 'draw',
        'time': 50,
        'payload': {
          'x': 451.2421875,
          'y': 462.0702819824219,
          'force': -343.83771362155676,
          'altitude': 1.9149447083473206,
          'azimuth': -1.1633256673812866
        }
      }
    ])
  })
})
