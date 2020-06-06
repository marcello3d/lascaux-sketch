import { isSkipped, Skips } from './GotoMap';
import { StorageModel } from './StorageModel';
import { Snap } from '../Drawlet';
import { PromiseOrValue } from 'promise-or-value';
import { waitAll } from '../util/promise-or-value';

export default class SnapshotMap {
  private _indexes: number[];
  constructor(readonly _storageModel: StorageModel, indexes: number[] = []) {
    this._indexes = indexes;
  }

  addSnapshot(
    index: number,
    { state, snapshot, links }: Snap,
  ): PromiseOrValue<void> {
    this._indexes.push(index);
    if (index < this._indexes[this._indexes.length - 1]) {
      this._indexes.sort();
    }

    const promises = [];

    if (links) {
      const linkIds = Object.keys(links);
      for (const linkId of linkIds) {
        if (links[linkId]) {
          promises.push(
            this._storageModel.addSnapshotLink(linkId, links[linkId]),
          );
        }
      }
    }

    return waitAll(promises);
  }

  getNearestSnapshotIndex(targetIndex: number, skips: Skips): number {
    const indexes = this._indexes;
    // binary search mode map
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
