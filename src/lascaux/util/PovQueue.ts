import { PromiseOrValue, then } from 'promise-or-value';

export class PovQueue<T> {
  private readonly queue: Array<T> = [];
  private promise: PromiseOrValue<void> = undefined;

  constructor(
    private readonly processValue: (value: T) => PromiseOrValue<void>,
  ) {}

  push(...values: readonly T[]): void {
    this.queue.push(...values);
  }

  processNext(): PromiseOrValue<void> {
    if (this.promise) {
      return this.promise;
    }
    if (this.queue.length === 0) {
      return undefined;
    }
    const val = this.queue.shift()!;
    return (this.promise = then(this.processValue(val), () => {
      this.promise = undefined;
    }));
  }
  processAll(): PromiseOrValue<void> {
    return then(this.processNext(), () => {
      if (this.queue.length > 0) {
        return this.processAll();
      }
      return undefined;
    });
  }
}
