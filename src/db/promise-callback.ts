import { Callback } from '../drawlets/file-format/types';

export function promiseToCallback<T>(
  promise: Promise<T>,
  callback: Callback<T>,
) {
  promise.then((value) => callback(undefined, value)).catch((x) => callback(x));
}
