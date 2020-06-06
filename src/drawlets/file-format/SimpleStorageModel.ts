import { Metadata, StorageModel, Stroke, StrokePayload } from './StorageModel';
import { Snap } from '../Drawlet';
import { Callback, VoidCallback } from './types';
import { RgbaImage } from '../drawos/webgl/util';
import { PromiseOrValue } from 'promise-or-value';
import { orThrow } from '../util/promise-or-value';

export class SimpleStorageModel implements StorageModel {
  private snapshots: Record<number, Snap> = {};
  private snapshotLinks: Record<string, RgbaImage> = {};
  private strokes: Stroke[] = [];

  constructor(private readonly initialMetadata: Metadata) {}

  addSnapshot(index: number, snapshot: Snap): void {
    this.snapshots[index] = snapshot;
  }

  addSnapshotLink(link: string, image: RgbaImage): void {
    this.snapshotLinks[link] = image;
  }

  addStroke(type: string, time: number, payload: StrokePayload): void {
    this.strokes.push({ type, time, payload });
  }

  flush(): void {}

  getMetadata(): Metadata {
    return this.initialMetadata;
  }

  getSnapshot(index: number): Snap {
    return orThrow(this.snapshots[index], `snapshot not found`);
  }

  getSnapshotLink(link: string): RgbaImage {
    return orThrow(this.snapshotLinks[link], `link not found`);
  }

  getStroke(index: number): Stroke {
    return orThrow(this.strokes[index], `stroke not found`);
  }
}
