import { all, PromiseOrValue, then } from 'promise-or-value';

export function waitAll<T>(values: PromiseOrValue<T>[]): PromiseOrValue<void> {
  return then(all(values), () => undefined);
}
