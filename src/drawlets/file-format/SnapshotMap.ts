import { isSkipped, Skips } from './GotoMap';
import { StorageModel } from './StorageModel';
import { Snap } from '../Drawlet';
import { Callback } from './types';

export default class SnapshotMap {
  private _indexes: number[];
  constructor(readonly _storageModel: StorageModel, indexes: number[] = []) {
    this._indexes = indexes;
  }

  addSnapshot(
    index: number,
    { state, snapshot, links }: Snap,
    callback: Callback<void>,
  ) {
    if (!callback) throw new Error('callback required');
    this._indexes.push(index);
    if (index < this._indexes[this._indexes.length - 1]) {
      this._indexes.sort();
    }

    const done = () => {
      this._storageModel.addSnapshot(
        index,
        { state, links, snapshot },
        callback,
      );
    };

    let uploaded = 0;
    let needUpload = 0;
    function onUpload(error?: Error | null) {
      if (error) {
        uploaded = Infinity;
        return callback(error);
      }
      uploaded++;
      if (uploaded >= needUpload) {
        done();
      }
    }

    if (links) {
      const linkIds = Object.keys(links);
      needUpload = linkIds.length;
      for (const linkId of linkIds) {
        this._storageModel.addSnapshotLink(linkId, links[linkId], onUpload);
      }
    }

    if (needUpload === 0) {
      done();
    }
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
