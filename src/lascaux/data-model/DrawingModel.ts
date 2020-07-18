import { PromiseOrValue, then } from 'promise-or-value';

import { DRAW_END_EVENT, GOTO_EVENT, isKeyframeEvent } from './events';

import GotoMap, { Skips } from './GotoMap';
import SnapshotMap from './SnapshotMap';

import { DrawletHandleFn } from '../Drawlet';
import { StorageModel } from './StorageModel';
import { DrawingDoc } from '../DrawingDoc';
import { CanvasModel } from './CanvasModel';

/**
 * Manages all the stroke and goto data for a drawing, using StorageModel
 */
export default class DrawingModel {
  readonly _storageModel: StorageModel;
  readonly _handleCommand: DrawletHandleFn;
  private readonly _queue: Array<{
    eventType: string;
    time: number;
    payload: any;
  }> = [];
  _strokeCount: number = 0;
  private _drawingCursor: number = 0;
  readonly _snapshotMap: SnapshotMap;
  private readonly _gotoMap: GotoMap;
  public readonly editCanvas: CanvasModel;
  private _snapshotStrokeCount: number = 0;
  private _strokesSinceSnapshot: number = 0;

  constructor({
    doc: { artboard, mode },
    storageModel,
    handleCommand,
    snapshotStrokeCount = 5000,
  }: {
    doc: DrawingDoc;
    editable: boolean;
    storageModel: StorageModel;
    handleCommand: DrawletHandleFn;
    snapshotStrokeCount: number;
  }) {
    this._storageModel = storageModel;
    this._handleCommand = handleCommand;
    this._queue = [];
    this._strokeCount = 0;
    this._drawingCursor = 0;
    this._gotoMap = new GotoMap();
    this._snapshotMap = new SnapshotMap();
    this._snapshotStrokeCount = snapshotStrokeCount;
    this._strokesSinceSnapshot = 0;
    this.editCanvas = new CanvasModel(this, artboard, mode);
  }

  getInfo() {
    return this.editCanvas.getInfo();
  }

  get drawingCursor() {
    return this._drawingCursor;
  }
  snapshot() {
    const cursor = this._strokeCount;
    this._strokesSinceSnapshot = 0;
    this._snapshotMap.addSnapshot(cursor);
    return this._storageModel.addSnapshot(cursor, this.editCanvas.getSnap());
  }

  flush() {
    return this._storageModel.flush();
  }

  private _recordStroke(eventType: string, time: number, payload: any) {
    this._storageModel.addStroke(eventType, time, payload);
    this._strokesSinceSnapshot++;
    if (
      eventType === DRAW_END_EVENT &&
      this._strokesSinceSnapshot >= this._snapshotStrokeCount
    ) {
      this.snapshot();
    }
  }

  addStroke(
    eventType: string,
    time: number,
    payload: Object,
  ): PromiseOrValue<void> {
    this._queue.push({
      eventType,
      time,
      payload,
    });
    return this.processQueue();
  }

  private processQueue(): PromiseOrValue<void> {
    if (this._queue.length === 0) {
      this.editCanvas.repaint();
      return;
    }
    const next = this._queue.shift()!;
    if (typeof next === 'function') {
      return this.processQueue();
    }
    const { eventType, time, payload } = next;

    const targetCursor = this.editCanvas.targetCursor;
    if (targetCursor !== this._strokeCount) {
      this._drawingCursor = this._gotoMap.addGoto(
        this._strokeCount,
        this.editCanvas.cursor,
      );
      this._recordStroke(GOTO_EVENT, time, targetCursor);
      this._strokeCount++;
    }

    const index = this._strokeCount;

    if (isKeyframeEvent(eventType)) {
      this._gotoMap.addKeyframe(index);
    }
    const isGoto = eventType === GOTO_EVENT;
    this._strokeCount++;
    if (isGoto) {
      this._drawingCursor = this._gotoMap.addGoto(index, payload);
    } else {
      this._drawingCursor = this._strokeCount;
    }
    return then(
      this.editCanvas.addStroke(this._strokeCount, eventType, payload),
      () => {
        this._recordStroke(eventType, time, payload);
        this.processQueue();
      },
    );
  }

  getGotoIndexes() {
    return this._gotoMap.getGotoIndexes();
  }

  computeUndo(): number | undefined {
    return this._gotoMap.computeUndo(this._drawingCursor);
  }

  computeRedo(): number | undefined {
    return this._gotoMap.computeRedo(this._drawingCursor);
  }

  planGoto(
    start: number,
    end: number,
  ): { target?: number; revert?: number; skips?: Skips } {
    end = this._gotoMap.dereference(
      Math.max(0, Math.min(end, this._strokeCount)),
    );
    if (start === end) {
      return {};
    }
    return {
      target: end,
      ...this._gotoMap.planGoto(start, end),
    };
  }
}
