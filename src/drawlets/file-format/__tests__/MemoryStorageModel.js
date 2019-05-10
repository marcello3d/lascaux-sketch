/* eslint-env jest */

import MemoryStorageModel from '../MemoryStorageModel'

function getStroke (model, index) {
  return new Promise((resolve, reject) => {
    model.getStroke(index, (error, stroke) => {
      if (error) {
        reject(error)
      } else {
        resolve(stroke)
      }
    })
  })
}

describe('MemoryStorageModel basic', () => {
  it('add and get', async () => {
    const model = new MemoryStorageModel()
    model.addStroke('foo', 1, {})
    model.addStroke('foo', 2, {})
    model.addStroke('foo', 3, {})
    expect(await getStroke(model, 0)).toEqual({ type: 'foo', time: 1, payload: {} })
    expect(await getStroke(model, 1)).toEqual({ type: 'foo', time: 2, payload: {} })
    expect(await getStroke(model, 2)).toEqual({ type: 'foo', time: 3, payload: {} })
  })
  it('add and get with flush', async () => {
    const model = new MemoryStorageModel()
    model.addStroke('foo', 1, {})
    model.addStroke('foo', 2, {})
    model.addStroke('foo', 3, {})
    model.flush()
    expect(await getStroke(model, 0)).toEqual({ type: 'foo', time: 1, payload: {} })
    expect(await getStroke(model, 1)).toEqual({ type: 'foo', time: 2, payload: {} })
    expect(await getStroke(model, 2)).toEqual({ type: 'foo', time: 3, payload: {} })
  })
  it('add and get with partial flush', async () => {
    const model = new MemoryStorageModel()
    model.addStroke('foo', 1, {})
    model.flush()
    model.addStroke('foo', 2, {})
    model.addStroke('foo', 3, {})
    expect(await getStroke(model, 0)).toEqual({ type: 'foo', time: 1, payload: {} })
    expect(await getStroke(model, 1)).toEqual({ type: 'foo', time: 2, payload: {} })
    expect(await getStroke(model, 2)).toEqual({ type: 'foo', time: 3, payload: {} })
  })
  it('add and get with multi flush', async () => {
    const model = new MemoryStorageModel()
    model.addStroke('foo', 1, {})
    model.flush()
    model.addStroke('foo', 2, {})
    model.flush()
    model.addStroke('foo', 3, {})
    model.flush()
    expect(await getStroke(model, 0)).toEqual({ type: 'foo', time: 1, payload: {} })
    expect(await getStroke(model, 1)).toEqual({ type: 'foo', time: 2, payload: {} })
    expect(await getStroke(model, 2)).toEqual({ type: 'foo', time: 3, payload: {} })
  })
})

describe('MemoryStorageModel no cache', () => {
  it('add and get with flush', async () => {
    const model = new MemoryStorageModel({ rangeCacheSize: 1 })
    model.addStroke('foo', 1, {})
    model.addStroke('foo', 2, {})
    model.addStroke('foo', 3, {})
    model.flush()
    expect(await getStroke(model, 0)).toEqual({ type: 'foo', time: 1, payload: {} })
    expect(await getStroke(model, 1)).toEqual({ type: 'foo', time: 2, payload: {} })
    expect(await getStroke(model, 2)).toEqual({ type: 'foo', time: 3, payload: {} })
  })
  it('add and get with partial flush', async () => {
    const model = new MemoryStorageModel({ rangeCacheSize: 1 })
    model.addStroke('foo', 1, {})
    model.flush()
    model.addStroke('foo', 2, {})
    model.addStroke('foo', 3, {})
    expect(await getStroke(model, 0)).toEqual({ type: 'foo', time: 1, payload: {} })
    expect(await getStroke(model, 1)).toEqual({ type: 'foo', time: 2, payload: {} })
    expect(await getStroke(model, 2)).toEqual({ type: 'foo', time: 3, payload: {} })
  })
  it('add and get with multi flush', async () => {
    const model = new MemoryStorageModel({ rangeCacheSize: 1 })
    model.addStroke('foo', 1, {})
    model.flush()
    model.addStroke('foo', 2, {})
    model.flush()
    model.addStroke('foo', 3, {})
    model.flush()
    expect(await getStroke(model, 0)).toEqual({ type: 'foo', time: 1, payload: {} })
    expect(await getStroke(model, 1)).toEqual({ type: 'foo', time: 2, payload: {} })
    expect(await getStroke(model, 2)).toEqual({ type: 'foo', time: 3, payload: {} })
  })
})
