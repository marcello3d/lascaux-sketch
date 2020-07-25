import { PovQueue } from './PovQueue';

describe('PovQueue.processNext', () => {
  it('queues synchronous actions', () => {
    const handler = jest.fn();
    const queue = new PovQueue<string>(handler);
    queue.push('hello');
    queue.push('world');
    queue.push('sup');
    expect(queue.processNext()).toBe(true);
    expect(handler.mock.calls).toMatchInlineSnapshot(`
      Array [
        Array [
          "hello",
        ],
      ]
    `);
    expect(queue.processNext()).toBe(true);
    expect(handler.mock.calls).toMatchInlineSnapshot(`
      Array [
        Array [
          "hello",
        ],
        Array [
          "world",
        ],
      ]
    `);
    expect(queue.processNext()).toBe(true);
    expect(handler.mock.calls).toMatchInlineSnapshot(`
      Array [
        Array [
          "hello",
        ],
        Array [
          "world",
        ],
        Array [
          "sup",
        ],
      ]
    `);
    expect(queue.processNext()).toBe(false);
  });
  it('queues asynchronous actions', async () => {
    const handler = jest.fn(() => Promise.resolve());
    const queue = new PovQueue<string>(handler);
    queue.push('hello');
    queue.push('world');
    queue.push('sup');
    expect(handler).not.toHaveBeenCalled();

    const p1 = queue.processNext();
    expect(p1).toBeInstanceOf(Promise);
    expect(handler.mock.calls).toMatchInlineSnapshot(`
      Array [
        Array [
          "hello",
        ],
      ]
    `);
    await expect(p1).resolves.toBe(true);
    expect(handler.mock.calls).toMatchInlineSnapshot(`
      Array [
        Array [
          "hello",
        ],
      ]
    `);
    const p2 = queue.processNext();
    const p3 = queue.processNext();
    const p4 = queue.processNext();
    expect(p2).toBeInstanceOf(Promise);
    expect(p3).toBeInstanceOf(Promise);
    expect(handler.mock.calls).toMatchInlineSnapshot(`
      Array [
        Array [
          "hello",
        ],
        Array [
          "world",
        ],
      ]
    `);
    await expect(p3).resolves.toBe(true);
    expect(handler.mock.calls).toMatchInlineSnapshot(`
      Array [
        Array [
          "hello",
        ],
        Array [
          "world",
        ],
        Array [
          "sup",
        ],
      ]
    `);
    await expect(p2).resolves.toBe(true);

    expect(queue.processNext()).toBe(false);

    await expect(p4).resolves.toBe(false);

    expect(handler.mock.calls).toMatchInlineSnapshot(`
      Array [
        Array [
          "hello",
        ],
        Array [
          "world",
        ],
        Array [
          "sup",
        ],
      ]
    `);
  });
});
describe('PovQueue.processAll', () => {
  it('queues synchronous actions', () => {
    const handler = jest.fn();
    const queue = new PovQueue<string>(handler);
    queue.push('hello');
    queue.push('world');
    queue.push('sup');
    expect(handler).not.toHaveBeenCalled();
    expect(queue.processAll()).toBeUndefined(); // does not return promise
    expect(handler.mock.calls).toMatchInlineSnapshot(`
      Array [
        Array [
          "hello",
        ],
        Array [
          "world",
        ],
        Array [
          "sup",
        ],
      ]
    `);
  });
  it('queues asynchronous actions', async () => {
    const handler = jest.fn(() => Promise.resolve());
    const queue = new PovQueue<string>(handler);
    queue.push('hello');
    queue.push('world');
    queue.push('sup');
    expect(handler).not.toHaveBeenCalled();
    const p = queue.processAll();
    expect(p).toBeInstanceOf(Promise);
    // Only first one is called
    expect(handler.mock.calls).toMatchInlineSnapshot(`
      Array [
        Array [
          "hello",
        ],
      ]
    `);
    await p;
    // Now the rest are called
    expect(handler.mock.calls).toMatchInlineSnapshot(`
      Array [
        Array [
          "hello",
        ],
        Array [
          "world",
        ],
        Array [
          "sup",
        ],
      ]
    `);
  });
});
