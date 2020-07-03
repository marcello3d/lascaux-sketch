import { PromiseOrValue, then } from 'promise-or-value';

import jsonCopy from '../util/json-copy';

import { DRAW_END_EVENT, GOTO_EVENT, isKeyframeEvent } from './events';

import GotoMap, { Skips } from './GotoMap';
import SnapshotMap from './SnapshotMap';

import { DrawletHandleFn } from '../Drawlet';
import { Metadata, StorageModel } from './StorageModel';
import { DrawingDoc } from '../DrawingDoc';
import { CanvasModel } from './CanvasModel';

/**
 * Manages all the stroke and goto data for a drawing, using StorageModel
 */
export default class DrawingModel {
  readonly _storageModel: StorageModel;
  readonly _initialDoc: DrawingDoc;
  readonly _handleCommand: DrawletHandleFn;
  private readonly _queue: Array<{
    eventType: string;
    time: number;
    payload: any;
  }> = [];
  _strokeCount: number = 0;
  private _drawingCursor: number = 0;
  _snapshotMap!: SnapshotMap;
  private _gotoMap!: GotoMap;
  private _snapshotStrokeCount: number = 0;
  private _strokesSinceSnapshot: number = 0;
  private _editCanvas: CanvasModel | undefined;

  constructor({
    doc,
    editable,
    storageModel,
    handleCommand,
    metadata,
    snapshotStrokeCount = 5000,
  }: {
    doc: DrawingDoc;
    editable: boolean;
    storageModel: StorageModel;
    handleCommand: DrawletHandleFn;
    metadata: Metadata;
    snapshotStrokeCount: number;
  }) {
    this._storageModel = storageModel;
    this._initialDoc = doc;
    this._handleCommand = handleCommand;
    this._queue = [];
    this._strokeCount = 0;
    this._drawingCursor = 0;
    if (!metadata) {
      throw new Error('unexpected state');
    }
    const { strokeCount, gotoMap, snapshotMap } = metadata;
    this._gotoMap = gotoMap;
    this._snapshotMap = snapshotMap;
    if (strokeCount > 0) {
      this._strokeCount = strokeCount;
      this._drawingCursor = this._gotoMap.dereference(strokeCount);
    }
    if (editable) {
      this._snapshotStrokeCount = snapshotStrokeCount;
      this._strokesSinceSnapshot = 0;
      this._editCanvas = this.createCanvas();
    }
  }

  getInfo() {
    return this._editCanvas?._backend.getInfo();
  }

  get editCanvas() {
    if (!this._editCanvas) {
      throw new Error('canvas not editable');
    }
    return this._editCanvas;
  }

  get drawingCursor() {
    return this._drawingCursor;
  }

  createCanvas(): CanvasModel {
    return new CanvasModel(this);
  }

  snapshot() {
    const cursor = this._strokeCount;
    if (!this._editCanvas || !this._snapshotMap) {
      throw new Error('canvas not editable');
    }
    const { snapshot, links } = this._editCanvas._backend.getSnapshot();
    const state = jsonCopy(this._editCanvas._state);
    this._strokesSinceSnapshot = 0;
    return this._snapshotMap.addSnapshot(cursor, { snapshot, links, state });
  }

  flush() {
    return this._storageModel.flush();
  }

  _recordStroke(eventType: string, time: number, payload: any) {
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
    return this._runQueue();
  }

  _runQueue(): PromiseOrValue<void> {
    if (this._queue.length === 0) {
      if (this._editCanvas) {
        this._editCanvas._backend.repaint();
      }
      return;
    }
    const next = this._queue.shift()!;
    if (typeof next === 'function') {
      return this._runQueue();
    }
    const { eventType, time, payload } = next;

    if (this._editCanvas) {
      const targetCursor = this._editCanvas.targetCursor;
      if (targetCursor !== this._strokeCount) {
        this._drawingCursor = this._gotoMap.addGoto(
          this._strokeCount,
          this._editCanvas.cursor,
        );
        this._recordStroke(GOTO_EVENT, time, targetCursor);
        this._strokeCount++;
      }
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
    if (this._editCanvas) {
      return then(
        this._editCanvas._execute(this._strokeCount, eventType, payload),
        () => {
          this._recordStroke(eventType, time, payload);
          this._runQueue();
        },
      );
    }
    return this._runQueue();
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

  _planGoto(
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
