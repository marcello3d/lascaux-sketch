import LRU from 'lru-cache';

import {
  getNormalizedModePayload,
  GOTO_EVENT,
  isKeyframeEvent,
  isModeEvent,
} from './events';
import {
  GetRangeMetadataCallback,
  RangeMetadata,
  Stroke, StrokePayload,
} from './StorageModel';
import GotoMap from './GotoMap';
import { Snapshot } from '../Drawlet';

function rangeKey([start, end]: [number, number]) {
  return `${start}-${end}`;
}

export type StorageOptions = {
  rangeCacheSize?: number;
  rangeMaxTime?: number;
  rangeMaxCount?: number;
  snapshotCacheSize?: number;
  snapshotLinkCacheSize?: number;
};

export default abstract class RemoteStorageModel {
  private _rangeCache: LRU<string, Stroke[]>;
  private _snapshotCache: LRU<string, Snapshot>;
  private _snapshotLinkCache: LRU<string, string>;
  private _initializing = true;
  private _pendingRangeMetadataGets = [];
  private _pendingRangeGets = [];
  private _rangeError: Error | undefined;
  private _rangeMaxTime: number;
  private _rangeMaxCount: number;
  private _nextRange: number | undefined;
  private _strokes: Stroke[] | undefined;
  private _gotos = null;
  private _modes = null;
  private _keys = null;
  private _strokeTimeout: number | undefined;

  constructor({
    rangeCacheSize = 50,
    rangeMaxTime = 10000,
    rangeMaxCount = 500,
    snapshotCacheSize = 50,
    snapshotLinkCacheSize = 50,
  }: StorageOptions) {
    // TODO: item-size based cache size?
    this._rangeCache = new LRU(rangeCacheSize);
    this._snapshotCache = new LRU(snapshotCacheSize);
    this._snapshotLinkCache = new LRU(snapshotLinkCacheSize);
    this._initializing = true;
    this._pendingRangeMetadataGets = [];
    this._pendingRangeGets = [];
    this._rangeMaxTime = rangeMaxTime;
    this._rangeMaxCount = rangeMaxCount;
    this._getRangeMetadata((error, rangeMetadata) => {
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

  protected abstract _getRangeMetadata(
    callback: (error: any, rangeMetadata: RangeMetadata) => {},
  ): void;

  getRangeMetadata(callback: GetRangeMetadataCallback) {
    if (this._initializing) {
      this._pendingRangeMetadataGets.push(callback);
    } else {
      callback(this._rangeError, this._rangeMetadata);
    }
  }
  abstract _uploadRange({ start, end, strokes, gotos, modes, keys }: {
    start: number,
    end: number;
    strokes: Stroke[];
    gotos: EncodedGotos;
    modes: Modes[];
    keys: number[];
  }, callback);

  _addRange(strokes: Stroke[], gotos: GotoMap, modes, keys, callback) {
    const ranges = this._ranges;
    const start = this._nextRange;
    const end = start + strokes.length - 1;
    const range = [start, end];
    ranges.push(range);
    this._nextRange = end + 1;
    this._strokes = undefined;
    this._gotos = undefined;
    this._modes = undefined;
    this._keys = undefined;
    const key = rangeKey(range);
    this._uploadRange({ start, end, strokes, gotos, modes, keys }, callback);
    this._rangeCache.set(key, strokes);
  }

  _findRange(index: number) {
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

  addStroke(type: string, time: number, payload: StrokePayload) {
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
