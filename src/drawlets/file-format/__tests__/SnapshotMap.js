/* eslint-env jest */
import SnapshotMap from '../SnapshotMap'

describe('SnapshotMap addSnapshot basic', () => {
  it('empty', () => {
    const addSnapshot = jest.fn()
    const addSnapshotLink = jest.fn()
    const map = new SnapshotMap({ addSnapshot, addSnapshotLink })
    expect(map._indexes).toEqual([])
    expect(addSnapshot.mock.calls.length).toEqual(0)
    expect(addSnapshotLink.mock.calls.length).toEqual(0)
  })
  it('one snapshot', () => {
    const addSnapshot = jest.fn((index, snap, callback) => callback())
    const addSnapshotLink = jest.fn()
    const map = new SnapshotMap({ addSnapshot, addSnapshotLink })
    const callback = jest.fn()
    map.addSnapshot(0, {}, callback)
    expect(map._indexes).toEqual([ 0 ])
    expect(addSnapshot.mock.calls).toEqual([[0, {}, callback]])
    expect(addSnapshotLink.mock.calls.length).toEqual(0)
    expect(callback.mock.calls.length).toEqual(1)
  })
  it('two snapshots', () => {
    const addSnapshot = jest.fn((index, snap, callback) => callback())
    const addSnapshotLink = jest.fn()
    const map = new SnapshotMap({ addSnapshot, addSnapshotLink })
    const callback = jest.fn()
    map.addSnapshot(1, {}, callback)
    map.addSnapshot(3, {}, callback)
    expect(map._indexes).toEqual([ 1, 3 ])
    expect(addSnapshot.mock.calls).toEqual([
      [1, {}, callback],
      [3, {}, callback]
    ])
    expect(addSnapshotLink.mock.calls.length).toEqual(0)
    expect(callback.mock.calls.length).toEqual(2)
  })
})
describe('SnapshotMap addSnapshot errors', () => {
  it('no callback', () => {
    const map = new SnapshotMap({})
    expect(() => map.addSnapshot(0, {})).toThrow()
  })
  it('upload snapshot error passed through', () => {
    const addSnapshot = jest.fn((index, snap, callback) => callback(new Error('error')))
    const map = new SnapshotMap({ addSnapshot })
    const callback = jest.fn()
    map.addSnapshot(0, {}, callback)
    expect(map._indexes).toEqual([ 0 ])
    expect(addSnapshot.mock.calls).toEqual([[0, {}, callback]])
    expect(callback.mock.calls).toEqual([
      [new Error('error')]
    ])
  })
  it('upload link error passed through', () => {
    const addSnapshot = jest.fn()
    const addSnapshotLink = jest.fn((link, data, callback) => data ? callback(new Error('error')) : callback())
    const map = new SnapshotMap({ addSnapshot, addSnapshotLink })
    const callback = jest.fn()
    map.addSnapshot(0, { links: { a: false, b: true } }, callback)
    expect(map._indexes).toEqual([ 0 ])
    expect(addSnapshot.mock.calls.length).toEqual(0)
    expect(addSnapshotLink.mock.calls.map(([link, data]) => [link, data])).toEqual([
      ['a', false],
      ['b', true]
    ])
    expect(callback.mock.calls).toEqual([
      [ new Error('error') ]
    ])
  })
})

describe('SnapshotMap addSnapshot with links', () => {
  it('one snapshot', () => {
    const addSnapshot = jest.fn((index, snap, callback) => callback())
    const addSnapshotLink = jest.fn((link, data, callback) => callback())
    const map = new SnapshotMap({ addSnapshot, addSnapshotLink })
    const callback = jest.fn()
    map.addSnapshot(
      0,
      {
        state: { hello: 'world' },
        snapshot: { tiles: ['a', 'c'] },
        links: {
          a: 'b',
          c: 'd'
        }
      },
      callback
    )
    expect(map._indexes).toEqual([ 0 ])
    expect(addSnapshot.mock.calls).toEqual([
      [0, {'snapshot': {'tiles': ['a', 'c']}, 'state': { hello: 'world' }}, callback]
    ])
    expect(addSnapshotLink.mock.calls.map(([link, data]) => [link, data])).toEqual([
      ['a', 'b'],
      ['c', 'd']
    ])
  })
})

describe('SnapshotMap getNearestSnapshotIndex', () => {
  it('basic gets', () => {
    const addSnapshot = jest.fn((index, snap, callback) => callback())
    const map = new SnapshotMap({ addSnapshot })
    const callback = jest.fn()
    map.addSnapshot(1, {}, callback)
    map.addSnapshot(3, {}, callback)
    const skips = []
    expect(map.getNearestSnapshotIndex(0, skips)).toEqual(0)
    expect(map.getNearestSnapshotIndex(1, skips)).toEqual(1)
    expect(map.getNearestSnapshotIndex(2, skips)).toEqual(1)
    expect(map.getNearestSnapshotIndex(3, skips)).toEqual(3)
    expect(map.getNearestSnapshotIndex(4, skips)).toEqual(3)
  })
  it('get with skips', () => {
    const addSnapshot = jest.fn((index, snap, callback) => callback())
    const map = new SnapshotMap({ addSnapshot })
    const callback = jest.fn()
    map.addSnapshot(1, {}, callback)
    map.addSnapshot(3, {}, callback)
    const skips = [[0, 1]]
    expect(map.getNearestSnapshotIndex(0, skips)).toEqual(0)
    expect(map.getNearestSnapshotIndex(1, skips)).toEqual(0)
    expect(map.getNearestSnapshotIndex(2, skips)).toEqual(0)
    expect(map.getNearestSnapshotIndex(3, skips)).toEqual(3)
    expect(map.getNearestSnapshotIndex(4, skips)).toEqual(3)
  })
  it('get with skips', () => {
    const addSnapshot = jest.fn((index, snap, callback) => callback())
    const map = new SnapshotMap({ addSnapshot })
    const callback = jest.fn()
    map.addSnapshot(1, {}, callback)
    map.addSnapshot(3, {}, callback)
    const skips = [[2, 3]]
    expect(map.getNearestSnapshotIndex(0, skips)).toEqual(0)
    expect(map.getNearestSnapshotIndex(1, skips)).toEqual(1)
    expect(map.getNearestSnapshotIndex(2, skips)).toEqual(1)
    expect(map.getNearestSnapshotIndex(3, skips)).toEqual(1)
    expect(map.getNearestSnapshotIndex(4, skips)).toEqual(1)
  })
})
