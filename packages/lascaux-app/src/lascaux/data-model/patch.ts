import produce from 'immer';
import { Delta, patch } from 'jsondiffpatch';

/**
 * Apply a jsondiffpatch delta in an immutable manner using immer
 */
export function immerPatch<T>(val: T, delta: Delta | undefined): T {
  if (!delta) {
    return val;
  }
  return produce(val, (draft) => {
    patch(draft, delta);
  });
}
