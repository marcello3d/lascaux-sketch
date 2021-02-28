import { isSkipped, Skips } from './GotoMap';

export default class SnapshotMap {
  constructor(private readonly _indexes: number[] = []) {}

  addSnapshot(index: number): void {
    const indexes = this._indexes;
    const lastIndex = indexes[indexes.length - 1];
    if (index === lastIndex) {
      return;
    }
    indexes.push(index);
    if (index < lastIndex) {
      indexes.sort();
    }
  }

  getNearestSnapshotIndex(targetIndex: number, skips: Skips): number {
    const indexes = this._indexes;
    // binary search
    let min = 0;
    let max = indexes.length - 1;
    while (min <= max) {
      const i = (min + max) >> 1;
      let index = indexes[i];
      if (targetIndex < index) {
        max = i - 1;
      } else if (targetIndex >= indexes[i + 1]) {
        min = i + 1;
      } else {
        if (isSkipped(skips, index)) {
          // TODO: more performant solution?
          return this.getNearestSnapshotIndex(index - 1, skips);
        }
        return index;
      }
    }
    return 0;
  }
}
