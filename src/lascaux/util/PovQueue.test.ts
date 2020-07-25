import { PovQueue } from './PovQueue';

describe('PovQueue', () => {
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
