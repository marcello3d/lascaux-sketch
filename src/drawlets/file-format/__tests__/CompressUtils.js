/* global describe, it, expect */

import { strokesToBytes, bytesToStrokes } from '../CompressUtils'
describe('CompressUtils', () => {
  it('strokes to bytes and back', () => new Promise((resolve, reject) => {
    strokesToBytes([
      {'payload': {x: 1, y: 1}, 'time': 10, 'type': 'foo'},
      {'payload': {x: 2, y: 1}, 'time': 20, 'type': 'foo'},
      {'payload': {x: 1, y: 1}, 'time': 30, 'type': 'foo'},
      {'payload': {x: 2, y: 1}, 'time': 40, 'type': 'foo'}
    ], (error, blobs) => {
      expect(error).toBe(null)
      bytesToStrokes(blobs, (error, strokes) => {
        expect(error).toBe(null)
        expect(strokes).toEqual([
          {'payload': {x: 1, y: 1}, 'time': 10, 'type': 'foo'},
          {'payload': {x: 2, y: 1}, 'time': 20, 'type': 'foo'},
          {'payload': {x: 1, y: 1}, 'time': 30, 'type': 'foo'},
          {'payload': {x: 2, y: 1}, 'time': 40, 'type': 'foo'}
        ])
        resolve()
      })
    })
  }))
})
