/* global describe, it, expect */

import { PackEventStream } from '../unpacked-to-packed'

export function mapEventsToRaw (rawEvents) {
  const events = []
  const stream = new PackEventStream(
    (event) => events.push(event),
    ['x', 'y', 'force', 'altitude', 'azimuth']
  )
  rawEvents.forEach(({ type, time, payload }) => stream.supply(type, time, payload))
  return events
}

describe('PackEventStream', () => {
  it('simple event conversion', () => {
    const events = mapEventsToRaw([
      {'payload': {x: 1, y: 1}, 'time': 10, 'type': 'foo'},
      {'payload': {x: 2, y: 1}, 'time': 20, 'type': 'foo'},
      {'payload': {x: 1, y: 1}, 'time': 30, 'type': 'foo'},
      {'payload': {x: 2, y: 1}, 'time': 40, 'type': 'foo'}
    ])
    expect(events).toEqual([
      { F: [ 'x', 'y' ], e: 'foo', t: 10 },
      new Float32Array([ 0, 1, 1 ]),
      new Float32Array([ 10, 1, 0 ]),
      new Float32Array([ 10, -1, 0 ]),
      new Float32Array([ 10, 1, 0 ])
    ])
  })
  it('fields change', () => {
    const events = mapEventsToRaw([
      {'payload': {x: 1, y: 1}, 'time': 10, 'type': 'foo'},
      {'payload': {x: 2, y: 1}, 'time': 20, 'type': 'foo'},
      {'payload': {x: 1}, 'time': 30, 'type': 'foo'},
      {'payload': {x: 2}, 'time': 40, 'type': 'foo'}
    ])
    expect(events).toEqual([
      { F: [ 'x', 'y' ], e: 'foo', t: 10 },
      new Float32Array([ 0, 1, 1 ]),
      new Float32Array([ 10, 1, 0 ]),
      { F: [ 'x' ], e: 'foo', t: 30 },
      new Float32Array([ 0, 1 ]),
      new Float32Array([ 10, 1 ])
    ])
  })
  it('drawing event conversion', () => {
    const events = mapEventsToRaw([
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
    expect(events).toEqual([
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
  })
})
