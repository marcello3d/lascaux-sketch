import { Metadata, StorageModel, Stroke, StrokePayload } from './StorageModel';
import { Snap } from '../Drawlet';
import { Callback, VoidCallback } from './types';
import { RgbaImage } from '../drawos/webgl/util';

export class SimpleStorageModel implements StorageModel {
  private snapshots: Record<number, Snap> = {};
  private snapshotLinks: Record<string, RgbaImage> = {};
  private strokes: Stroke[] = [];

  constructor(private readonly initialMetadata: Metadata) {}

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

  getMetadata(): Metadata {
    return this.initialMetadata;
  }

  getSnapshot(index: number, callback: Callback<Snap | undefined>): void {
    const snapshot = this.snapshots[index];
    if (snapshot) {
      callback(undefined, snapshot);
    } else {
      callback(new Error('snapshot not found'));
    }
  }

  getSnapshotLink(
    link: string,
    callback: Callback<RgbaImage | undefined>,
  ): void {
    const snapshotLink = this.snapshotLinks[link];
    if (snapshotLink) {
      callback(undefined, snapshotLink);
    } else {
      callback(new Error('snapshot link not found'));
    }
  }

  getStroke(index: number, callback: Callback<Stroke | undefined>): void {
    const stroke = this.strokes[index];
    if (stroke) {
      callback(undefined, stroke);
    } else {
      callback(new Error('stroke not found'));
    }
  }
}
