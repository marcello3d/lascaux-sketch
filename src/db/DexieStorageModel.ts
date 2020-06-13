import {
  Metadata,
  StorageModel,
  Stroke,
  StrokePayload,
} from '../drawlets/file-format/StorageModel';
import { Snap } from '../drawlets/Drawlet';
import { RgbaImage } from '../drawlets/drawos/webgl/util';
import { db, DbStroke } from './db';
import GotoMap from '../drawlets/file-format/GotoMap';
import SnapshotMap from '../drawlets/file-format/SnapshotMap';
import ModeMap from '../drawlets/file-format/ModeMap';
import Dexie from 'dexie';
import { PromiseOrValue } from 'promise-or-value';
import DrawingModel from '../drawlets/file-format/DrawingModel';

export class DexieStorageModel implements StorageModel {
  private snapshots: Record<number, Snap> = {};
  private snapshotLinks: Record<string, RgbaImage> = {};
  private priorStrokeCount = 0;
  private strokeCount = 0;
  private strokeCache: Record<number, DbStroke> = {};

  constructor(private readonly drawingId: string) {}

  addSnapshot(index: number, snapshot: Snap): void {
    this.snapshots[index] = snapshot;
  }

  addSnapshotLink(link: string, image: RgbaImage | undefined): void {
    if (image) {
      this.snapshotLinks[link] = image;
    } else {
      delete this.snapshotLinks[link];
    }
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

  async getMetadata(initialMode: object): Promise<Metadata> {
    return {
      strokeCount: 0,
      gotoMap: new GotoMap(),
      modeMap: new ModeMap(initialMode),
      snapshotMap: new SnapshotMap(this),
    };
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
