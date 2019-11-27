/* eslint-env jest */

import RemoteStorageModel from '../RemoteStorageModel';

function getStroke(model, index) {
  return new Promise((resolve, reject) => {
    model.getStroke(index, (error, stroke) => {
      if (error) {
        reject(error);
      } else {
        resolve(stroke);
      }
    });
  });
}
function waitPromise(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('RemoteStorageModel.addStroke', () => {
  it('null', () => {
    expect(
      new RemoteStorageModel({
        getRangeMetadata: (callback) => callback(),
      }),
    ).toBeTruthy();
  });
  it('empty flush once', () => {
    let uploads = [];
    const model = new RemoteStorageModel({
      getRangeMetadata: (callback) => callback(),
      uploadRange({ start, end, strokes }, callback) {
        uploads.push({ start, end, strokes });
        callback();
      },
    });
    model.addStroke('foo', 1, {});
    model.addStroke('foo', 2, {});
    model.addStroke('foo', 3, {});
    model.addStroke('foo', 4, {});
    model.flush();
    expect(uploads).toEqual([
      {
        start: 0,
        end: 3,
        strokes: [
          { payload: {}, time: 1, type: 'foo' },
          { payload: {}, time: 2, type: 'foo' },
          { payload: {}, time: 3, type: 'foo' },
          { payload: {}, time: 4, type: 'foo' },
        ],
      },
    ]);
  });
  it('empty flush twice', () => {
    let uploads = [];
    const model = new RemoteStorageModel({
      getRangeMetadata: (callback) => callback(),
      uploadRange({ start, end, strokes, gotos, modes, keys }, callback) {
        uploads.push({ start, end, strokes });
        callback();
      },
      downloadRange(start, end, callback) {},
    });
    model.addStroke('foo', 1, {});
    model.addStroke('foo', 2, {});
    model.addStroke('foo', 3, {});
    model.addStroke('foo', 4, {});
    model.flush();
    model.addStroke('foo', 5, {});
    model.addStroke('foo', 6, {});
    model.addStroke('foo', 7, {});
    model.addStroke('foo', 8, {});
    model.flush();
    expect(uploads).toEqual([
      {
        start: 0,
        end: 3,
        strokes: [
          { payload: {}, time: 1, type: 'foo' },
          { payload: {}, time: 2, type: 'foo' },
          { payload: {}, time: 3, type: 'foo' },
          { payload: {}, time: 4, type: 'foo' },
        ],
      },
      {
        start: 4,
        end: 7,
        strokes: [
          { payload: {}, time: 5, type: 'foo' },
          { payload: {}, time: 6, type: 'foo' },
          { payload: {}, time: 7, type: 'foo' },
          { payload: {}, time: 8, type: 'foo' },
        ],
      },
    ]);
  });
  it('empty rangeMaxCount flush', async () => {
    let uploads = [];
    const model = new RemoteStorageModel({
      rangeMaxTime: 5,
      getRangeMetadata: (callback) => callback(),
      uploadRange({ start, end, strokes, gotos, modes, keys }, callback) {
        uploads.push({ start, end, strokes });
        callback();
      },
    });
    model.addStroke('foo', 1, {});
    model.addStroke('foo', 2, {});
    model.addStroke('foo', 3, {});
    model.addStroke('foo', 4, {});
    model.addStroke('foo', 5, {});
    await waitPromise(20);
    model.addStroke('foo', 6, {});
    model.addStroke('foo', 7, {});
    model.addStroke('foo', 8, {});
    await waitPromise(20);
    expect(uploads).toEqual([
      {
        start: 0,
        end: 4,
        strokes: [
          { payload: {}, time: 1, type: 'foo' },
          { payload: {}, time: 2, type: 'foo' },
          { payload: {}, time: 3, type: 'foo' },
          { payload: {}, time: 4, type: 'foo' },
          { payload: {}, time: 5, type: 'foo' },
        ],
      },
      {
        start: 5,
        end: 7,
        strokes: [
          { payload: {}, time: 6, type: 'foo' },
          { payload: {}, time: 7, type: 'foo' },
          { payload: {}, time: 8, type: 'foo' },
        ],
      },
    ]);
  });
  it('empty rangeMaxTime flush', () => {
    let uploads = [];
    const model = new RemoteStorageModel({
      rangeMaxCount: 3,
      getRangeMetadata: (callback) => callback(),
      uploadRange({ start, end, strokes, gotos, modes, keys }, callback) {
        uploads.push({ start, end, strokes, gotos, modes, keys });
        callback();
      },
    });
    model.addStroke('foo', 1, {});
    model.addStroke('foo', 2, {});
    model.addStroke('foo', 3, {});
    model.addStroke('foo', 4, {});
    model.addStroke('foo', 5, {});
    model.addStroke('foo', 6, {});
    model.addStroke('foo', 7, {});
    model.addStroke('foo', 8, {});
    expect(uploads).toEqual([
      {
        start: 0,
        end: 2,
        strokes: [
          { payload: {}, time: 1, type: 'foo' },
          { payload: {}, time: 2, type: 'foo' },
          { payload: {}, time: 3, type: 'foo' },
        ],
        gotos: [],
        modes: [],
        keys: [],
      },
      {
        start: 3,
        end: 5,
        strokes: [
          { payload: {}, time: 4, type: 'foo' },
          { payload: {}, time: 5, type: 'foo' },
          { payload: {}, time: 6, type: 'foo' },
        ],
        gotos: [],
        modes: [],
        keys: [],
      },
    ]);
  });
  it('existing ranges', () => {
    let uploads = [];
    const model = new RemoteStorageModel({
      getRangeMetadata: (callback) =>
        callback(null, {
          ranges: [
            [0, 3],
            [4, 7],
          ],
        }),
      uploadRange({ start, end, strokes, gotos, modes, keys }, callback) {
        uploads.push({ start, end, strokes });
        callback();
      },
    });
    model.addStroke('foo', 1, {});
    model.addStroke('foo', 2, {});
    model.addStroke('foo', 3, {});
    model.addStroke('foo', 4, {});
    model.flush();
    expect(uploads).toEqual([
      {
        start: 8,
        end: 11,
        strokes: [
          { payload: {}, time: 1, type: 'foo' },
          { payload: {}, time: 2, type: 'foo' },
          { payload: {}, time: 3, type: 'foo' },
          { payload: {}, time: 4, type: 'foo' },
        ],
      },
    ]);
  });
  it('delayed existing ranges', () => {
    const getRangeMetadata = jest.fn();
    const uploadRange = jest.fn();
    const model = new RemoteStorageModel({
      getRangeMetadata,
      uploadRange,
    });
    expect(() => model.addStroke('foo', 1, {})).toThrowError(
      'cannot add stroke',
    );
    expect(getRangeMetadata.mock.calls.length).toBe(1);
    expect(uploadRange.mock.calls.length).toBe(0);
  });
});
describe('RemoteStorageModel.getStroke', () => {
  it('get', async () => {
    const getRangeMetadata = jest.fn((callback) =>
      callback(null, { ranges: [[0, 3]] }),
    );
    const downloadRange = jest.fn((start, end, callback) =>
      callback(null, [
        { payload: {}, time: 1, type: 'foo' },
        { payload: {}, time: 2, type: 'foo' },
        { payload: {}, time: 3, type: 'foo' },
        { payload: {}, time: 4, type: 'foo' },
      ]),
    );
    const model = new RemoteStorageModel({ getRangeMetadata, downloadRange });
    expect(downloadRange.mock.calls).toEqual([]);
    expect(await getStroke(model, 1)).toEqual({
      type: 'foo',
      time: 2,
      payload: {},
    });
    expect(
      downloadRange.mock.calls.map(([start, end]) => [start, end]),
    ).toEqual([[0, 3]]);
  });
  it('get multiple ranges', async () => {
    const getRangeMetadata = jest.fn((callback) =>
      callback(null, {
        ranges: [
          [0, 0],
          [1, 1],
          [2, 2],
          [3, 3],
        ],
      }),
    );
    const downloadRange = jest.fn((start, end, callback) => {
      switch (`${start}-${end}`) {
        case '0-0':
          return callback(null, [{ payload: {}, time: 1, type: 'foo' }]);
        case '1-1':
          return callback(null, [{ payload: {}, time: 2, type: 'foo' }]);
        case '2-2':
          return callback(null, [{ payload: {}, time: 3, type: 'foo' }]);
        case '3-3':
          return callback(null, [{ payload: {}, time: 4, type: 'foo' }]);
      }
    });
    const model = new RemoteStorageModel({ getRangeMetadata, downloadRange });
    expect(downloadRange.mock.calls).toEqual([]);
    expect(await getStroke(model, 0)).toEqual({
      type: 'foo',
      time: 1,
      payload: {},
    });
    expect(await getStroke(model, 1)).toEqual({
      type: 'foo',
      time: 2,
      payload: {},
    });
    expect(await getStroke(model, 2)).toEqual({
      type: 'foo',
      time: 3,
      payload: {},
    });
    expect(await getStroke(model, 3)).toEqual({
      type: 'foo',
      time: 4,
      payload: {},
    });
    expect(
      downloadRange.mock.calls.map(([start, end]) => [start, end]),
    ).toEqual([
      [0, 0],
      [1, 1],
      [2, 2],
      [3, 3],
    ]);
  });
  it('get multiple ranges 2', async () => {
    const getRangeMetadata = jest.fn((callback) =>
      callback(null, {
        ranges: [
          [0, 1],
          [2, 5],
          [6, 10],
        ],
      }),
    );
    const downloadRange = jest.fn((start, end, callback) => {
      switch (`${start}-${end}`) {
        case '0-1':
          return callback(null, [
            { payload: {}, time: 1, type: 'foo' },
            { payload: {}, time: 2, type: 'foo' },
          ]);
        case '2-5':
          return callback(null, [
            { payload: {}, time: 3, type: 'foo' },
            { payload: {}, time: 4, type: 'foo' },
            { payload: {}, time: 5, type: 'foo' },
            { payload: {}, time: 6, type: 'foo' },
          ]);
        case '6-10':
          return callback(null, [
            { payload: {}, time: 7, type: 'foo' },
            { payload: {}, time: 8, type: 'foo' },
            { payload: {}, time: 9, type: 'foo' },
            { payload: {}, time: 10, type: 'foo' },
            { payload: {}, time: 11, type: 'foo' },
          ]);
      }
    });
    const model = new RemoteStorageModel({ getRangeMetadata, downloadRange });
    expect(downloadRange.mock.calls).toEqual([]);
    expect(await getStroke(model, 0)).toEqual({
      type: 'foo',
      time: 1,
      payload: {},
    });
    expect(await getStroke(model, 1)).toEqual({
      type: 'foo',
      time: 2,
      payload: {},
    });
    expect(await getStroke(model, 2)).toEqual({
      type: 'foo',
      time: 3,
      payload: {},
    });
    expect(await getStroke(model, 3)).toEqual({
      type: 'foo',
      time: 4,
      payload: {},
    });
    expect(await getStroke(model, 4)).toEqual({
      type: 'foo',
      time: 5,
      payload: {},
    });
    expect(await getStroke(model, 5)).toEqual({
      type: 'foo',
      time: 6,
      payload: {},
    });
    expect(await getStroke(model, 6)).toEqual({
      type: 'foo',
      time: 7,
      payload: {},
    });
    expect(await getStroke(model, 7)).toEqual({
      type: 'foo',
      time: 8,
      payload: {},
    });
    expect(await getStroke(model, 8)).toEqual({
      type: 'foo',
      time: 9,
      payload: {},
    });
    expect(await getStroke(model, 9)).toEqual({
      type: 'foo',
      time: 10,
      payload: {},
    });
    expect(await getStroke(model, 10)).toEqual({
      type: 'foo',
      time: 11,
      payload: {},
    });
    expect(
      downloadRange.mock.calls.map(([start, end]) => [start, end]),
    ).toEqual([
      [0, 1],
      [2, 5],
      [6, 10],
    ]);
  });
  it('cache limit', async () => {
    const getRangeMetadata = jest.fn((callback) =>
      callback(null, {
        ranges: [
          [0, 1],
          [2, 3],
        ],
      }),
    );
    const downloadRange = jest.fn((start, end, callback) => {
      switch (`${start}-${end}`) {
        case '0-1':
          return callback(null, [
            { payload: {}, time: 1, type: 'foo' },
            { payload: {}, time: 2, type: 'foo' },
          ]);
        case '2-3':
          return callback(null, [
            { payload: {}, time: 3, type: 'foo' },
            { payload: {}, time: 4, type: 'foo' },
          ]);
      }
    });
    const model = new RemoteStorageModel({
      rangeCacheSize: 1,
      getRangeMetadata,
      downloadRange,
    });
    expect(downloadRange.mock.calls).toEqual([]);
    expect(await getStroke(model, 0)).toEqual({
      type: 'foo',
      time: 1,
      payload: {},
    });
    expect(await getStroke(model, 1)).toEqual({
      type: 'foo',
      time: 2,
      payload: {},
    });
    expect(await getStroke(model, 2)).toEqual({
      type: 'foo',
      time: 3,
      payload: {},
    });
    expect(await getStroke(model, 3)).toEqual({
      type: 'foo',
      time: 4,
      payload: {},
    });
    expect(
      downloadRange.mock.calls.map(([start, end]) => [start, end]),
    ).toEqual([
      [0, 1],
      [2, 3],
    ]);

    expect(await getStroke(model, 0)).toEqual({
      type: 'foo',
      time: 1,
      payload: {},
    });
    expect(await getStroke(model, 2)).toEqual({
      type: 'foo',
      time: 3,
      payload: {},
    });
    expect(await getStroke(model, 1)).toEqual({
      type: 'foo',
      time: 2,
      payload: {},
    });
    expect(await getStroke(model, 3)).toEqual({
      type: 'foo',
      time: 4,
      payload: {},
    });
    expect(
      downloadRange.mock.calls.map(([start, end]) => [start, end]),
    ).toEqual([
      [0, 1],
      [2, 3],
      [0, 1],
      [2, 3],
      [0, 1],
      [2, 3],
    ]);
  });
  it('get cached', async () => {
    const getRangeMetadata = jest.fn((callback) =>
      callback(null, { ranges: [[0, 3]] }),
    );
    const downloadRange = jest.fn((start, end, callback) =>
      callback(null, [
        { payload: {}, time: 1, type: 'foo' },
        { payload: {}, time: 2, type: 'foo' },
        { payload: {}, time: 3, type: 'foo' },
        { payload: {}, time: 4, type: 'foo' },
      ]),
    );
    const model = new RemoteStorageModel({ getRangeMetadata, downloadRange });
    expect(downloadRange.mock.calls).toEqual([]);
    expect(await getStroke(model, 1)).toEqual({
      type: 'foo',
      time: 2,
      payload: {},
    });
    expect(await getStroke(model, 2)).toEqual({
      type: 'foo',
      time: 3,
      payload: {},
    });
    expect(
      downloadRange.mock.calls.map(([start, end]) => [start, end]),
    ).toEqual([[0, 3]]);
  });
  it('get unavailable', async () => {
    const getRangeMetadata = jest.fn((callback) =>
      callback(null, { ranges: [] }),
    );
    const downloadRange = jest.fn();
    const model = new RemoteStorageModel({ getRangeMetadata, downloadRange });
    try {
      await getStroke(model, 1);
      expect(true).toBe(false);
    } catch (e) {
      expect(e.message).toEqual('cannot get 1, last stroke 0');
    }
    expect(downloadRange.mock.calls).toEqual([]);
  });
  it('get async', async () => {
    const getRangeMetadata = jest.fn((callback) =>
      callback(null, { ranges: [[0, 3]] }),
    );
    const downloadRange = jest.fn((start, end, callback) => {
      setTimeout(
        () =>
          callback(null, [
            { payload: {}, time: 1, type: 'foo' },
            { payload: {}, time: 2, type: 'foo' },
            { payload: {}, time: 3, type: 'foo' },
            { payload: {}, time: 4, type: 'foo' },
          ]),
        10,
      );
    });
    const model = new RemoteStorageModel({ getRangeMetadata, downloadRange });
    expect(downloadRange.mock.calls).toEqual([]);
    expect(await getStroke(model, 1)).toEqual({
      type: 'foo',
      time: 2,
      payload: {},
    });
    expect(
      downloadRange.mock.calls.map(([start, end]) => [start, end]),
    ).toEqual([[0, 3]]);
  });
  it('delayed get', async () => {
    let getRangeCallback;
    const getRangeMetadata = jest.fn((callback) => {
      getRangeCallback = callback;
    });
    const downloadRange = jest.fn((start, end, callback) =>
      callback(null, [
        { payload: {}, time: 1, type: 'foo' },
        { payload: {}, time: 2, type: 'foo' },
        { payload: {}, time: 3, type: 'foo' },
        { payload: {}, time: 4, type: 'foo' },
      ]),
    );
    const model = new RemoteStorageModel({ getRangeMetadata, downloadRange });
    const strokePromise1 = getStroke(model, 1);
    const strokePromise2 = getStroke(model, 3);
    expect(downloadRange.mock.calls).toEqual([]);
    getRangeCallback(null, { ranges: [[0, 3]] });
    expect(
      downloadRange.mock.calls.map(([start, end]) => [start, end]),
    ).toEqual([[0, 3]]);
    expect(await strokePromise1).toEqual({ type: 'foo', time: 2, payload: {} });
    expect(await strokePromise2).toEqual({ type: 'foo', time: 4, payload: {} });
  });

  it('add and get', async () => {
    const getRangeMetadata = jest.fn((callback) => callback());
    const model = new RemoteStorageModel({ getRangeMetadata });
    model.addStroke('foo', 1, {});
    model.addStroke('foo', 2, {});
    model.addStroke('foo', 3, {});
    expect(await getStroke(model, 0)).toEqual({
      type: 'foo',
      time: 1,
      payload: {},
    });
    expect(await getStroke(model, 1)).toEqual({
      type: 'foo',
      time: 2,
      payload: {},
    });
    expect(await getStroke(model, 2)).toEqual({
      type: 'foo',
      time: 3,
      payload: {},
    });
  });
  it('add, flush, and get', async () => {
    const getRangeMetadata = jest.fn((callback) => callback());
    const uploadRange = jest.fn((range, callback) => callback());
    const model = new RemoteStorageModel({ getRangeMetadata, uploadRange });
    model.addStroke('foo', 1, {});
    model.addStroke('foo', 2, {});
    model.flush();
    model.addStroke('foo', 3, {});
    expect(await getStroke(model, 0)).toEqual({
      type: 'foo',
      time: 1,
      payload: {},
    });
    expect(await getStroke(model, 1)).toEqual({
      type: 'foo',
      time: 2,
      payload: {},
    });
    expect(await getStroke(model, 2)).toEqual({
      type: 'foo',
      time: 3,
      payload: {},
    });
  });
  it('get bad range', async () => {
    const getRangeMetadata = jest.fn((callback) =>
      callback(null, {
        ranges: [
          [0, 1],
          [3, 4],
        ],
      }),
    );
    const model = new RemoteStorageModel({ getRangeMetadata });
    try {
      await getStroke(model, 2);
    } catch (e) {
      expect(e.message).toEqual('no stroke');
    }
  });
});
