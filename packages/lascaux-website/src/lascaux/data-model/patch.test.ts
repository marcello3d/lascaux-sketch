import { immerPatch } from './patch';
import { diff } from 'jsondiffpatch';

describe('immerPatch', () => {
  it('patches immutably if no delta', () => {
    const obj1 = {
      hello: 'world',
    };
    const obj2 = {
      hello: 'world',
    };
    const delta = diff(obj1, obj2);
    const obj3 = immerPatch(obj1, delta);
    expect(obj3).toEqual(obj2);
    // No changes, so objects should be identical
    expect(obj3).toBe(obj1);
  });

  it('patches immutably', () => {
    const obj1 = {
      hello: 'world',
      array: [1, 2, 3],
    };
    const obj2 = {
      hello: 'vorld',
      array: [2, 3],
    };
    const delta = diff(obj1, obj2);
    const obj3 = immerPatch(obj1, delta);
    expect(obj3).not.toBe(obj1);
    expect(obj3).not.toBe(obj2);
    expect(obj3).toEqual(obj2);
  });
  it('patches immutably, keeping sub-object', () => {
    const obj1 = {
      hello: 'world',
      array: [1, 2, 3],
    };
    const obj2 = {
      hello: 'vorld',
      array: [1, 2, 3],
    };
    const delta = diff(obj1, obj2);
    const obj3 = immerPatch(obj1, delta);
    expect(obj3).toEqual(obj2);
    // Objects are different because "hello" prop changed
    expect(obj3).not.toEqual(obj1);
    // But the "array" prop hasn't changed, so they should be the same:
    expect(obj3.array).toBe(obj1.array);
  });
});
