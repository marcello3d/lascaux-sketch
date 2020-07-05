import Dexie from 'dexie';
import { PromiseOrValue } from 'promise-or-value';

import {
  StorageModel,
  Stroke,
  StrokePayload,
} from '../lascaux/data-model/StorageModel';
import { Snap } from '../lascaux/Drawlet';
import { RgbaImage } from '../lascaux/util/rgba-image';
import DrawingModel from '../lascaux/data-model/DrawingModel';

import { db, DbStroke } from './db';

export class DexieStorageModel implements StorageModel {
  private snapshots: Record<number, Snap> = {};
  private snapshotLinks: Record<string, RgbaImage> = {};
  private priorStrokeCount = 0;
  private strokeCount = 0;
  private strokeCache: Record<number, DbStroke> = {};

  constructor(private readonly drawingId: string) {}

  addSnapshot(index: number, snapshot: Snap): void {
    const { links } = snapshot;
    for (const linkId of Object.keys(links)) {
      if (links[linkId]) {
        this.snapshotLinks[linkId] = links[linkId];
      } else {
        delete this.snapshotLinks[linkId];
      }
    }
    this.snapshots[index] = snapshot;
  }

  addStroke(type: string, time: number, payload: StrokePayload): void {
    const index = this.strokeCount++;
    const stroke = { drawingId: this.drawingId, index, type, time, payload };
    this.strokeCache[index] = stroke;
    if (index < this.priorStrokeCount) {
      return;
    }
    db.strokes.add(stroke);
  }

  flush(): void {}

  async replay(model: DrawingModel): Promise<void> {
    const strokes = await db.strokes
      .where('[drawingId+index]')
      .between([this.drawingId, Dexie.minKey], [this.drawingId, Dexie.maxKey])
      .toArray();

    this.strokeCount = 0;
    this.strokeCache = {};
    this.priorStrokeCount = strokes.length;
    let lastPromise;
    for (let i = 0; i < strokes.length; i++) {
      const { index, type, time, payload } = strokes[i];
      if (index !== i) {
        throw new Error(
          `unexpected out of order stroke ${index} (expected ${i})`,
        );
      }
      lastPromise = model.addStroke(type, time, payload);
    }
    return lastPromise;
  }

  getSnapshot(index: number): Snap {
    return this.snapshots[index];
  }

  getSnapshotLink(link: string): RgbaImage {
    return this.snapshotLinks[link];
  }

  getStroke(index: number): PromiseOrValue<Stroke> {
    if (this.strokeCache[index]) {
      return this.strokeCache[index];
    }
    return db.strokes
      .get({ drawingId: this.drawingId, index })
      .then((stroke) => {
        if (!stroke) {
          throw new Error(`stroke not found ${this.drawingId}/${index}`);
        }
        this.strokeCache[index] = stroke;
        return stroke;
      });
  }
}
