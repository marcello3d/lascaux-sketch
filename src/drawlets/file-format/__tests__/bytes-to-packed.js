/* global describe, it, expect */

import {
  BytesToPackedEventStream,
  DeflatedToPackedEventStream
} from '../bytes-to-packed'

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

describe('BytesToPackedEventStream', () => {
  it('simple event encoding', () => {
    const results = []
    const stream = new BytesToPackedEventStream({
      onEvent (event) {
        results.push(event)
      },
      onError (error) { throw error },
      onEnd () { results.push('end') }
    })
    stream.supply(
      Buffer.from([131, 161, 101, 166, 99, 117, 114, 115, 111, 114, 161, 116, 205, 35, 42, 161, 112, 132, 164, 116, 121, 112, 101, 166, 115, 116, 121, 108, 117, 115, 165, 102, 111, 114, 99, 101, 195, 168, 102, 111, 114, 99, 101, 77, 97, 120, 203, 64, 16, 170, 170, 170, 170, 170, 171, 164, 116, 105, 108, 116, 195])
    )

    expect(results).toEqual([
      {
        'e': 'cursor',
        't': 9002,
        'p': {'type': 'stylus', 'force': true, 'forceMax': 4.166666666666667, 'tilt': true}
      }
    ])

    stream.supply(
      Buffer.from([131, 161, 101, 164, 100, 114, 97, 119, 161, 116, 205, 35, 42, 161, 70, 149, 161, 120, 161, 121, 165, 102, 111, 114, 99, 101, 168, 97, 108, 116, 105, 116, 117, 100, 101, 167, 97, 122, 105, 109, 117, 116, 104])
    )
    stream.supply(
      Buffer.from([199, 24, 23, 0, 0, 0, 0, 0, 252, 97, 67, 212, 254, 171, 67, 205, 204, 156, 61, 181, 233, 126, 63, 0, 152, 171, 189])
    )
    stream.supply(
      Buffer.from([131, 161, 101, 164, 100, 114, 97, 119, 161, 116, 205, 35, 44, 161, 70, 149, 161, 120, 161, 121, 165, 102, 111, 114, 99, 101, 168, 97, 108, 116, 105, 116, 117, 100, 101, 167, 97, 122, 105, 109, 117, 116, 104])
    )
    stream.supply(
      Buffer.from([199, 24, 23, 0, 0, 0, 0, 0, 252, 97, 67, 212, 254, 171, 67, 205, 204, 156, 61, 181, 233, 126, 63, 0, 152, 171, 189])
    )
    stream.supply(
      Buffer.from([199, 24, 23, 0, 0, 0, 64, 0, 66, 97, 67, 172, 40, 236, 66, 7, 245, 171, 195, 28, 80, 107, 63, 91, 46, 138, 191])
    )

    expect(results).toEqual([
      {
        'e': 'cursor',
        't': 9002,
        'p': {'type': 'stylus', 'force': true, 'forceMax': 4.166666666666667, 'tilt': true}
      },
      {
        'e': 'draw',
        't': 9002,
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
        't': 9004,
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

    stream.end()
    expect(results.length).toEqual(7)
  })
})

describe('DeflatedToPackedEventStream', () => {
  it('flushed encoding of 6 events', () => {
    const results = []
    const stream = new DeflatedToPackedEventStream({
      onEvent (event) {
        results.push(event)
      },
      onError (error) { results.push(error) },
      onEnd () { results.push('end') },
      flush: true
    })
    stream.supply(
      new Uint8Array([106, 94, 152, 186, 44, 185, 180, 168, 56, 191, 104, 97, 201, 89, 101, 173, 133, 5, 45, 75, 74, 42, 11, 82, 151, 21, 151, 84, 230, 148, 22, 47, 77, 203, 47, 74, 78, 61, 188, 2, 76, 249, 38, 86, 156, 118, 16, 88, 5, 2, 171, 151, 148, 100, 230, 148, 28, 6, 0, 0, 0, 255, 255])
    )

    expect(results).toEqual([
      {
        'e': 'cursor',
        't': 9002,
        'p': {'type': 'stylus', 'force': true, 'forceMax': 4.166666666666667, 'tilt': true}
      }
    ])

    stream.supply(new Uint8Array([106, 94, 152, 186, 36, 165, 40, 177, 28, 162, 213, 109, 234, 194, 138, 133, 149, 16, 45, 43, 18, 115, 74, 50, 75, 74, 83, 82, 151, 39, 86, 101, 230, 150, 150, 100, 0, 0, 0, 0, 255, 255]))
    stream.supply(new Uint8Array([58, 46, 33, 206, 0, 2, 127, 18, 157, 175, 252, 91, 237, 124, 246, 204, 28, 219, 173, 47, 235, 236, 25, 102, 172, 222, 11, 0, 0, 0, 255, 255]))
    stream.supply(new Uint8Array([66, 54, 69, 7, 191, 41, 0, 0, 0, 0, 255, 255]))
    stream.supply(new Uint8Array([194, 99, 10, 0, 0, 0, 255, 255]))
    stream.supply(new Uint8Array([130, 72, 57, 48, 56, 37, 58, 175, 209, 120, 227, 196, 254, 117, 245, 97, 153, 128, 108, 251, 104, 189, 174, 253, 0, 0, 0, 0, 255, 255]))

    expect(results).toEqual([
      {
        'e': 'cursor',
        't': 9002,
        'p': {'type': 'stylus', 'force': true, 'forceMax': 4.166666666666667, 'tilt': true}
      },
      {
        'e': 'draw',
        't': 9002,
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
        't': 9004,
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
    stream.end()
    expect(results.length).toEqual(7)
  })

  it('no-flush encoding of 6 events', () => {
    const results = []
    const stream = new DeflatedToPackedEventStream({
      onEvent (event) {
        results.push(event)
      },
      onError (error) { results.push(error) },
      onEnd () { results.push('end') },
      flush: false
    })
    stream.supply(
      new Uint8Array([107, 94, 152, 186, 44, 185, 180, 168, 56, 191, 104, 97, 201, 89, 101, 173, 133, 5, 45, 75, 74, 42, 11, 82, 151, 21, 151, 84, 230, 148, 22, 47, 77, 203, 47, 74, 78, 61, 188, 2, 76, 249, 38, 86, 156, 118, 16, 88, 5, 2, 171, 151, 148, 100, 230, 148, 28, 110, 94, 152, 186, 36, 165, 40, 177, 28, 162, 213, 109, 234, 194, 138, 133, 149, 16, 45, 43, 18, 115, 74, 50, 75, 74, 83, 82, 151, 39, 86, 101, 230, 150, 150, 100, 28, 151, 16, 103, 0, 129, 63, 137, 206, 87, 254, 173, 118, 62, 123, 102, 142, 237, 214, 151, 117, 246, 12, 51, 86, 239, 69, 54, 69, 135, 108, 83, 32, 82, 14, 12, 78, 137, 206, 107, 52, 222, 56, 177, 127, 93, 125, 88, 38, 32, 219, 62, 90, 175, 107, 63, 0])
    )
    stream.end()

    expect(results).toEqual([
      {
        'e': 'cursor',
        't': 9002,
        'p': {'type': 'stylus', 'force': true, 'forceMax': 4.166666666666667, 'tilt': true}
      },
      {
        'e': 'draw',
        't': 9002,
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
        't': 9004,
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
      ]),
      'end'
    ])
  })

  it('split no-flush encoding of 6 events', () => {
    const results = []
    const stream = new DeflatedToPackedEventStream({
      onEvent (event) {
        results.push(event)
      },
      onError (error) { results.push(error) },
      onEnd () { results.push('end') },
      flush: false
    })
    stream.supply(new Uint8Array([107, 94, 152, 186, 44, 185, 180, 168, 56, 191, 104, 97, 201, 89, 101, 173, 133, 5, 45, 75, 74, 42, 11, 82, 151, 21, 151, 84, 230, 148, 22, 47, 77, 203, 47, 74, 78, 61, 188, 2, 76, 249, 38, 86, 156, 118, 16, 88, 5, 2, 171, 151, 148, 100, 230, 148, 28, 110, 94, 152, 186, 36, 165, 40, 177, 28, 162, 213]))

    expect(results).toEqual([
      {
        'e': 'cursor',
        't': 9002,
        'p': {'type': 'stylus', 'force': true, 'forceMax': 4.166666666666667, 'tilt': true}
      }
    ])
    stream.supply(new Uint8Array([109, 234, 194, 138, 133, 149, 16, 45, 43, 18, 115, 74, 50, 75, 74, 83, 82, 151, 39, 86, 101, 230, 150, 150, 100, 28, 151, 16, 103, 0, 129, 63, 137, 206, 87, 254, 173, 118, 62, 123, 102, 142, 237, 214, 151, 117, 246, 12, 51, 86, 239, 69, 54, 69, 135, 108, 83, 32, 82, 14, 12, 78, 137, 206, 107, 52, 222, 56, 177, 127, 93, 125, 88, 38, 32, 219, 62, 90, 175, 107, 63, 0]))

    expect(results).toEqual([
      {
        'e': 'cursor',
        't': 9002,
        'p': {'type': 'stylus', 'force': true, 'forceMax': 4.166666666666667, 'tilt': true}
      },
      {
        'e': 'draw',
        't': 9002,
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
        't': 9004,
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
    stream.end()

    expect(results).toEqual([
      {
        'e': 'cursor',
        't': 9002,
        'p': {'type': 'stylus', 'force': true, 'forceMax': 4.166666666666667, 'tilt': true}
      },
      {
        'e': 'draw',
        't': 9002,
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
        't': 9004,
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
      ]),
      'end'
    ])
  })
})
