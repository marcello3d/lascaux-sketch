import RemoteStorageModel from './RemoteStorageModel';

import { bytesToStrokes, strokesToBytes } from './CompressUtils';

function rangeKey(start, end) {
  return `${start}-${end}`;
}

export default class MemoryStorageModel extends RemoteStorageModel {
  constructor(options, initialRangeMetadata = null) {
    super({
      ...options,
      getRangeMetadata: (callback) => callback(null, initialRangeMetadata),
      uploadRange: ({ start, end, strokes, gotos, modes, keys }, callback) => {
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
      },
      downloadRange: (start, end, callback) => {
        bytesToStrokes(this.ranges[rangeKey(start, end)], callback);
      },
      uploadSnapshot: (index, snap, callback) => {
        this.snapshots[index] = snap;
        callback();
      },
      uploadSnapshotLink: (link, data, callback) => {
        this.snapshotLinks[link] = data;
        callback();
      },
      downloadSnapshot: (index, callback) => {
        if (index in this.snapshots) {
          callback(null, this.snapshots[index]);
        } else {
          callback(new Error('unknown snapshot'));
        }
      },
      downloadSnapshotLink: (link, callback) => {
        if (link in this.snapshotLinks) {
          callback(null, this.snapshotLinks[link]);
        } else {
          callback(new Error('unknown snapshot link'));
        }
      },
    });
    this.snapshots = {};
    this.snapshotLinks = {};
    this.ranges = {};
    this.size = 0;
  }
}
