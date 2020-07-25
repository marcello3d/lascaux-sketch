import { PromiseOrValue } from 'promise-or-value';

export class PovQueue<T> {
  private readonly queue: Array<T> = [];
  private promise: Promise<boolean> | undefined;

  constructor(
    private readonly processValue: (value: T) => PromiseOrValue<void>,
  ) {}

  push(...values: readonly T[]): void {
    this.queue.push(...values);
  }

  /**
   * Returns true once the next value is processed
   */
  processNext(): PromiseOrValue<boolean> {
    if (this.promise) {
      return (this.promise = this.promise.then(() => this.processNext()));
    }
    if (this.queue.length === 0) {
      return false;
    }
    const val = this.queue.shift()!;
    const result = this.processValue(val);
    if (!result) {
      return true;
    }
    return (this.promise = result.then(() => {
      this.promise = undefined;
      return true;
    }));
  }

  processAll(): PromiseOrValue<void> {
    while (true) {
      const next = this.processNext();
      if (next === true) {
        continue;
      }
      if (next === false) {
        return undefined;
      }
      // Waiting for last processing was async
      return next.then(() => this.processAll());
    }
  }
}
