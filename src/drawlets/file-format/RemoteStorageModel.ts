import LRU from 'lru-cache';

import {
  GOTO_EVENT,
  isModeEvent,
  isKeyframeEvent,
  getNormalizedModePayload,
} from './events';
import { Callback } from './types';
import { RangeMetadata } from './StorageModel';

function rangeKey([start, end]: [number, number]) {
  return `${start}-${end}`;
}

export type StorageOptions = {
  rangeCacheSize?: number;
  rangeMaxTime?: number;
  rangeMaxCount?: number;
  snapshotCacheSize?: number;
  snapshotLinkCacheSize?: number;
  getRangeMetadata: (callback: Callback<RangeMetadata>) => void;
  uploadRange: () => void;
  downloadRange: () => void;
  uploadSnapshot: () => void;
  downloadSnapshot: () => void;
  uploadSnapshotLink: () => void;
  downloadSnapshotLink: () => void;
};
export default class RemoteStorageModel {
  _rangeCache: LRU<string, Stroke[]>;
  _snapshotCache: LRU;
  _snapshotLinkCache: LRU;
  _initializing = true;
  _pendingRangeMetadataGets = [];
  _pendingRangeGets = [];
  _uploadRange = uploadRange;
  _downloadRange = downloadRange;
  _rangeMaxTime = rangeMaxTime;
  _rangeMaxCount = rangeMaxCount;
  _uploadSnapshot = uploadSnapshot;
  _downloadSnapshot = downloadSnapshot;
  _uploadSnapshotLink = uploadSnapshotLink;
  _downloadSnapshotLink = downloadSnapshotLink;
  _nextRange: number | undefined;
  _strokes: Stroke[] | undefined = undefined;
  _gotos = null;
  _modes = null;
  _keys = null;
  _strokeTimeout: number | undefined;

  constructor({
    rangeCacheSize = 50,
    rangeMaxTime = 10000,
    rangeMaxCount = 500,
    snapshotCacheSize = 50,
    snapshotLinkCacheSize = 50,
    getRangeMetadata,
    uploadRange,
    downloadRange,
    uploadSnapshot,
    downloadSnapshot,
    uploadSnapshotLink,
    downloadSnapshotLink,
  }: StorageOptions) {
    // TODO: item-size based cache size?
    this._rangeCache = new LRU(rangeCacheSize);
    this._snapshotCache = new LRU(snapshotCacheSize);
    this._snapshotLinkCache = new LRU(snapshotLinkCacheSize);
    this._initializing = true;
    this._pendingRangeMetadataGets = [];
    this._pendingRangeGets = [];
    this._uploadRange = uploadRange;
    this._downloadRange = downloadRange;
    this._rangeMaxTime = rangeMaxTime;
    this._rangeMaxCount = rangeMaxCount;
    this._uploadSnapshot = uploadSnapshot;
    this._downloadSnapshot = downloadSnapshot;
    this._uploadSnapshotLink = uploadSnapshotLink;
    this._downloadSnapshotLink = downloadSnapshotLink;
    getRangeMetadata((error, rangeMetadata) => {
      this._initializing = false;
      if (error) {
        this._rangeError = error;
      } else if (rangeMetadata) {
        const { ranges } = rangeMetadata;
        this._ranges = ranges;
        this._rangeMetadata = rangeMetadata;
        this._nextRange =
          ranges && ranges.length > 0 ? ranges[ranges.length - 1][1] + 1 : 0;
        for (const { index, callback } of this._pendingRangeGets) {
          this.getStroke(index, callback);
        }
      } else {
        this._ranges = [];
        this._rangeMetadata = undefined;
        this._nextRange = 0;
      }
      for (const callback of this._pendingRangeMetadataGets) {
        this.getRangeMetadata(callback);
      }
      this._pendingRangeMetadataGets = null;
      this._pendingRangeGets = null;
    });
  }

  getRangeMetadata(callback) {
    if (this._initializing) {
      this._pendingRangeMetadataGets.push(callback);
    } else {
      callback(this._rangeError, this._rangeMetadata);
    }
  }

  _addRange(strokes, gotos, modes, keys, callback) {
    const ranges = this._ranges;
    const start = this._nextRange;
    const end = start + strokes.length - 1;
    const range = [start, end];
    ranges.push(range);
    this._nextRange = end + 1;
    this._strokes = null;
    this._gotos = null;
    this._modes = null;
    this._keys = null;
    const key = rangeKey(range);
    this._uploadRange({ start, end, strokes, gotos, modes, keys }, callback);
    this._rangeCache.set(key, strokes);
  }

  _findRange(index) {
    const ranges = this._ranges;
    // binary search ranges map
    let min = 0;
    let max = ranges.length - 1;
    while (min <= max) {
      const i = (min + max) >> 1;
      const range = ranges[i];
      if (index < range[0]) {
        max = i - 1;
      } else if (index > range[1]) {
        min = i + 1;
      } else {
        return range;
      }
    }
    return null;
  }

  addStroke(type, time, payload) {
    if (this._initializing) {
      throw new Error('cannot add stroke before get');
    }
    if (!this._strokes) {
      this._strokes = [];
      this._strokeTimeout = window.setTimeout(
        () => this.flush(),
        this._rangeMaxTime,
      );
      this._gotos = [];
      this._modes = [];
      this._keys = [];
    }

    if (type === GOTO_EVENT) {
      this._gotos.push(this._nextRange + this._strokes.length, payload);
    } else if (isModeEvent(type)) {
      this._modes.push(
        this._nextRange + this._strokes.length,
        getNormalizedModePayload(type, payload),
      );
    } else if (isKeyframeEvent(type)) {
      this._keys.push(this._nextRange + this._strokes.length);
    }

    this._strokes.push({ type, time, payload });

    if (this._strokes.length >= this._rangeMaxCount) {
      this.flush();
    }
  }

  getStroke(index, callback) {
    if (this._initializing) {
      return this._pendingRangeGets.push({ index, callback });
    }
    if (index >= this._nextRange) {
      if (!this._strokes) {
        return callback(
          new Error(`cannot get ${index}, last stroke ${this._nextRange}`),
        );
      }
      const strokeIndex = index - this._nextRange;
      if (strokeIndex >= this._strokes.length) {
        return callback(
          new Error(`future stroke ${strokeIndex} >= ${this._strokes.length}`),
        );
      }
      return callback(null, this._strokes[strokeIndex]);
    }
    const range = this._findRange(index);
    if (!range) {
      return callback(new Error('no stroke'));
    }
    const key = rangeKey(range);
    const send = (strokes) => {
      callback(null, strokes[index - range[0]]);
    };
    const strokes = this._rangeCache.get(key);
    if (strokes) {
      return send(strokes);
    }
    this._downloadRange(range[0], range[1], (error, strokes) => {
      if (error) {
        callback(error);
      } else {
        this._rangeCache.set(key, strokes);
        send(strokes);
      }
    });
  }

  addSnapshot(index, snapshot, callback) {
    this._snapshotCache.set(index, snapshot);
    this._uploadSnapshot(index, snapshot, callback);
  }

  addSnapshotLink(link, dataUri, callback) {
    if (this._snapshotLinkCache.has(link)) {
      return callback();
    }
    this._snapshotLinkCache.set(link, dataUri);
    this._uploadSnapshotLink(link, dataUri, callback);
  }

  getSnapshot(index, callback) {
    const cached = this._snapshotCache.get(index);
    if (cached) {
      return callback(null, cached);
    }
    this._downloadSnapshot(index, (error, snap) => {
      if (error) {
        return callback(error);
      }
      this._snapshotCache.set(index, snap);
      callback(null, snap);
    });
  }

  getSnapshotLink(link, callback) {
    const cached = this._snapshotLinkCache.get(link);
    if (cached) {
      return callback(null, cached);
    }
    this._downloadSnapshotLink(link, (error, dataUri) => {
      if (error) {
        return callback(error);
      }
      this._snapshotLinkCache.set(link, dataUri);
      callback(null, dataUri);
    });
  }

  flush(callback = () => {}) {
    if (this._strokes) {
      this._addRange(
        this._strokes,
        this._gotos,
        this._modes,
        this._keys,
        callback,
      );
      window.clearTimeout(this._strokeTimeout);
    } else {
      callback();
    }
  }
}
