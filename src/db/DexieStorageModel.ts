import {
  Metadata,
  StorageModel,
  Stroke,
  StrokePayload,
} from '../drawlets/file-format/StorageModel';
import { Snap } from '../drawlets/Drawlet';
import { VoidCallback } from '../drawlets/file-format/types';
import { RgbaImage } from '../drawlets/drawos/webgl/util';
import { db, DbStroke } from './db';
import GotoMap from '../drawlets/file-format/GotoMap';
import SnapshotMap from '../drawlets/file-format/SnapshotMap';
import {
  getNormalizedModePayload,
  isKeyframeEvent,
  isModeEvent,
} from '../drawlets/file-format/events';
import ModeMap from '../drawlets/file-format/ModeMap';
import Dexie from 'dexie';
import { PromiseOrValue } from 'promise-or-value';

export class LocalStorageModel implements StorageModel {
  private snapshots: Record<number, Snap> = {};
  private snapshotLinks: Record<string, RgbaImage> = {};
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

  async addStroke(
    type: string,
    time: number,
    payload: StrokePayload,
  ): Promise<void> {
    await db.strokes.add({
      drawingId: this.drawingId,
      index: this.strokeCount++,
      type,
      time,
      payload,
    });
  }

  flush(): void {}

  async getMetadata(initialMode: object): Promise<Metadata> {
    let strokeCount = 0;
    const gotoMap = new GotoMap();
    const modeMap = new ModeMap(initialMode);
    const snapshotMap = new SnapshotMap(this);
    await db.strokes
      .where('[drawingId+index]')
      .between([this.drawingId, Dexie.minKey], [this.drawingId, Dexie.maxKey])
      .each((stroke) => {
        const { index, payload, type } = stroke;
        this.strokeCache[index] = stroke;
        if (isKeyframeEvent(type)) {
          gotoMap.addKeyframe(index);
        }
        if (isModeEvent(type)) {
          modeMap.addMode(index, getNormalizedModePayload(type, payload));
        }
        strokeCount++;
      });
    this.strokeCount = strokeCount;
    console.log(`strokeCount=${strokeCount}`);
    return {
      strokeCount,
      gotoMap,
      modeMap,
      snapshotMap,
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
