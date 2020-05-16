import RemoteStorageModel, { StorageOptions } from './RemoteStorageModel';

import { bytesToStrokes, strokesToBytes } from './CompressUtils';

function rangeKey(start: number, end: number) {
  return `${start}-${end}`;
}

export default class MemoryStorageModel extends RemoteStorageModel {
  private snapshots = {};
  private snapshotLinks = {};
  private ranges = {};
  private size = 0;
  constructor(
    options: StorageOptions,
    private readonly initialRangeMetadata: any,
  ) {
    super(options);
  }
  _getRangeMetadata(callback) {
    callback(null, this.initialRangeMetadata);
  }
  _uploadRange({ start, end, strokes, gotos, modes, keys }, callback) {
    // const startTime = Date.now()
    // console.log(`compressing ${end - start + 1} strokes…`)
    strokesToBytes(strokes, (error, blob) => {
      if (error) {
        throw error;
      }
      const size = blob.length;
      this.size += size;
      // console.log(`compressed ${end - start + 1} strokes into ${size} bytes (${blob.length} blobs--${(size / (end - start + 1)).toFixed(1)} bytes per stroke), ${this.size} total for ${end + 1} strokes — in ${Date.now() - startTime} ms`)
      this.ranges[rangeKey(start, end)] = blob;
      callback();
    });
  }
  _downloadRange(start, end, callback) {
    bytesToStrokes(this.ranges[rangeKey(start, end)], callback);
  }
  _uploadSnapshot(index, snap, callback) {
    this.snapshots[index] = snap;
    callback();
  }
  _uploadSnapshotLink(link, data, callback) {
    this.snapshotLinks[link] = data;
    callback();
  }
  _downloadSnapshot(index, callback) {
    if (index in this.snapshots) {
      callback(null, this.snapshots[index]);
    } else {
      callback(new Error('unknown snapshot'));
    }
  }
  _downloadSnapshotLink(link, callback) {
    if (link in this.snapshotLinks) {
      callback(null, this.snapshotLinks[link]);
    } else {
      callback(new Error('unknown snapshot link'));
    }
  }
}
