import { waitAll } from './promise-or-value';

describe('waitAll', () => {
  it('returns value array as-is', () => {
    const array = [1, 2, 3];
    expect(waitAll(array)).toBe(undefined);
  });
  it('returns promise for array with 1 promise', async () => {
    const array = [1, 2, Promise.resolve(3)];
    const result = waitAll(array);
    expect(result).not.toBe(array);
    await expect(result).resolves.toEqual(undefined);
  });
  it('rejects if a value rejects', async () => {
    const array = [1, Promise.reject(2), 3];
    await expect(waitAll(array)).rejects.toBe(2);
  });
});
