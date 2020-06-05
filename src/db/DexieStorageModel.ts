import {
  Metadata,
  StorageModel,
  Stroke,
  StrokePayload,
} from '../drawlets/file-format/StorageModel';
import { Snap } from '../drawlets/Drawlet';
import { Callback, VoidCallback } from '../drawlets/file-format/types';
import { RgbaImage } from '../drawlets/drawos/webgl/util';
import { db, DbStroke } from './db';
import { promiseToCallback } from './promise-callback';
import GotoMap from '../drawlets/file-format/GotoMap';
import SnapshotMap from '../drawlets/file-format/SnapshotMap';
import {
  getNormalizedModePayload,
  isKeyframeEvent,
  isModeEvent,
} from '../drawlets/file-format/events';
import ModeMap from '../drawlets/file-format/ModeMap';
import Dexie from 'dexie';

export class LocalStorageModel implements StorageModel {
  private snapshots: Record<number, Snap> = {};
  private snapshotLinks: Record<string, RgbaImage> = {};
  private strokeCount = 0;
  private strokeCache: Record<number, DbStroke> = {};

  constructor(private readonly drawingId: string) {}

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
    db.strokes.add({
      drawingId: this.drawingId,
      index: this.strokeCount++,
      type,
      time,
      payload,
    });
  }

  flush(callback: VoidCallback): void {
    callback();
  }

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
    if (this.strokeCache[index]) {
      return callback(undefined, this.strokeCache[index]);
    }
    promiseToCallback(
      db.strokes.get({ drawingId: this.drawingId, index }).then((stroke) => {
        if (stroke) {
          this.strokeCache[index] = stroke;
        }
        return stroke;
      }),
      callback,
    );
  }
}
