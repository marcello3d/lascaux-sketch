import {
  GetRangeMetadataCallback,
  GetSnapshotCallback,
  GetSnapshotLinkCallback,
  GetStrokeCallback,
  RangeMetadata,
  StorageModel,
  Stroke,
  StrokePayload,
} from './StorageModel';
import { Snap } from '../Drawlet';
import { VoidCallback } from './types';
import { RgbaImage } from '../drawos/webgl/util';

export class SimpleStorageModel implements StorageModel {
  private snapshots: Record<number, Snap> = {};
  private snapshotLinks: Record<string, RgbaImage> = {};
  private strokes: Stroke[] = [];

  constructor(private readonly initialRangeMetadata?: RangeMetadata) {}

  addSnapshot(index: number, snapshot: Snap, callback: VoidCallback): void {
    this.snapshots[index] = snapshot;
    callback();
  }

  addSnapshotLink(
    link: string,
    image: RgbaImage | undefined,
    callback: VoidCallback,
  ): void {
    if (image) {
      this.snapshotLinks[link] = image;
    } else {
      delete this.snapshotLinks[link];
    }
    callback();
  }

  addStroke(type: string, time: number, payload: StrokePayload): void {
    this.strokes.push({ type, time, payload });
  }

  flush(callback: VoidCallback): void {
    callback();
  }

  getRangeMetadata(callback: GetRangeMetadataCallback): void {
    callback(undefined, this.initialRangeMetadata);
  }

  getSnapshot(index: number, callback: GetSnapshotCallback): void {
    const snapshot = this.snapshots[index];
    if (snapshot) {
      callback(undefined, snapshot);
    } else {
      callback(new Error('snapshot not found'));
    }
  }

  getSnapshotLink(link: string, callback: GetSnapshotLinkCallback): void {
    const snapshotLink = this.snapshotLinks[link];
    if (snapshotLink) {
      callback(undefined, snapshotLink);
    } else {
      callback(new Error('snapshot link not found'));
    }
  }

  getStroke(index: number, callback: GetStrokeCallback): void {
    const stroke = this.strokes[index];
    if (stroke) {
      callback(undefined, stroke);
    } else {
      callback(new Error('stroke not found'));
    }
  }
}
