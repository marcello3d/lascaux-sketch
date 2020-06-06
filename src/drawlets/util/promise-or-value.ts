import { all, PromiseOrValue, then } from 'promise-or-value';

export function waitAll<T>(values: PromiseOrValue<T>[]): PromiseOrValue<void> {
  return then(all(values), () => undefined);
}

export function orThrow<T>(value: T | undefined, message: string): T {
  if (value === undefined || value === null) {
    throw new Error(message);
  }
  return value;
}
