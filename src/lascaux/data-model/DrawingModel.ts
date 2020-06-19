import seedrandom from 'seedrandom';
import { PromiseOrValue, then } from 'promise-or-value';

import jsonCopy from '../util/json-copy';

import {
  getNormalizedModePayload,
  GOTO_EVENT,
  isKeyframeEvent,
  isModeEvent,
} from './events';

import GotoMap, { isSkipped, Skips } from './GotoMap';
import ModeMap from './ModeMap';
import SnapshotMap from './SnapshotMap';

import {
  DRAW_END_EVENT,
  DrawContext,
  DrawingContext,
  DrawletHandleFn,
  DrawletInitializeFn,
  DrawBackend,
  InitContext,
} from '../Drawlet';
import { Metadata, StorageModel } from './StorageModel';
import { Dna, DrawingMode, DrawingState, makeInitialState } from '../dna';

function getRandomFn(dna: Dna, cursor: number) {
  let random: () => number;
  return () => {
    if (!random) {
      // initialize on first use to avoid extra computation
      random = seedrandom(dna.randomseed + cursor);
    }
    return random();
  };
}
export function getInitializeContext(dna: Dna): InitContext {
  return {
    random: getRandomFn(dna, 0),
    dna,
  };
}

type DrawOsConstructor = new (
  dna: Dna,
  scale?: number,
  tileSize?: number,
) => DrawBackend;

/**
 * Manages all the stroke and goto data for a drawing, using StorageModel
 */
export default class DrawingModel {
  readonly _storageModel: StorageModel;
  readonly _dna: Dna;
  private readonly _DrawOs: DrawOsConstructor;
  private readonly _initializeCommand: DrawletInitializeFn;
  readonly _handleCommand: DrawletHandleFn;
  private readonly _queue: Array<{
    eventType: string;
    time: number;
    payload: any;
  }> = [];
  _strokeCount: number = 0;
  private _drawingCursor: number = 0;
  _snapshotMap!: SnapshotMap;
  _modeMap!: ModeMap<DrawingMode>;
  private _gotoMap!: GotoMap;
  private _snapshotStrokeCount: number = 0;
  private _strokesSinceSnapshot: number = 0;
  private _editCanvas: CanvasModel | undefined;

  constructor({
    dna,
    editable,
    DrawOs,
    storageModel,
    initializeCommand,
    handleCommand,
    metadata,
    snapshotStrokeCount = 5000,
  }: {
    dna: Dna;
    editable: boolean;
    DrawOs: DrawOsConstructor;
    storageModel: StorageModel;
    initializeCommand: DrawletInitializeFn;
    handleCommand: DrawletHandleFn;
    metadata: Metadata;
    snapshotStrokeCount: number;
  }) {
    this._storageModel = storageModel;
    this._dna = dna;
    this._DrawOs = DrawOs;
    this._initializeCommand = initializeCommand;
    this._handleCommand = handleCommand;
    this._queue = [];
    this._strokeCount = 0;
    this._drawingCursor = 0;
    if (!metadata) {
      throw new Error('unexpected state');
    }
    const { strokeCount, gotoMap, modeMap, snapshotMap } = metadata;
    this._gotoMap = gotoMap;
    this._snapshotMap = snapshotMap;
    if (strokeCount > 0) {
      this._strokeCount = strokeCount;
      this._drawingCursor = this._gotoMap.dereference(strokeCount);
    }
    this._modeMap = modeMap;
    if (editable) {
      this._snapshotStrokeCount = snapshotStrokeCount;
      this._strokesSinceSnapshot = 0;
      this._editCanvas = this.createCanvas();
    }
  }

  getInfo() {
    return this._editCanvas?._drawos.getInfo();
  }

  _initialize(canvas?: DrawingContext) {
    const initializeCommand = this._initializeCommand;
    return initializeCommand(getInitializeContext(this._dna), canvas);
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
    return new CanvasModel(this, new this._DrawOs(this._dna));
  }

  snapshot() {
    const cursor = this._strokeCount;
    if (!this._editCanvas || !this._snapshotMap) {
      throw new Error('canvas not editable');
    }
    const { snapshot, links } = this._editCanvas._drawos.getSnapshot();
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
      return;
    }
    const { eventType, time, payload } = this._queue.shift()!;

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
    const isMode = isModeEvent(eventType);
    this._strokeCount++;
    if (isGoto) {
      this._drawingCursor = this._gotoMap.addGoto(index, payload);
    } else if (isMode) {
      this._modeMap.addMode(
        index,
        getNormalizedModePayload(eventType, payload),
      );
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

export class CanvasModel {
  readonly _drawing: DrawingModel;
  readonly _drawos: DrawBackend;
  _inGoto: boolean;
  _cursor: number = 0;
  _targetCursor: number = 0;
  _state: DrawingState = makeInitialState();
  constructor(drawing: DrawingModel, drawOs: DrawBackend) {
    this._drawing = drawing;
    this._drawos = drawOs;
    this._inGoto = false;
    this._initialize();
  }

  get cursor(): number {
    return this._cursor;
  }

  get targetCursor(): number {
    return this._targetCursor;
  }

  get mode(): DrawingMode {
    return this._drawing._modeMap.getMode(this.strokeCount);
  }

  get strokeCount(): number {
    return this._drawing._strokeCount;
  }

  get dom(): HTMLCanvasElement {
    return this._drawos.getDom();
  }

  getPng(): Promise<Blob> {
    return this._drawos.getPng();
  }

  setTransform(translateX: number, translateY: number, scale: number): void {
    this._drawos.setTransform(translateX, translateY, scale);
  }

  _initialize() {
    this._cursor = 0;
    this._state = makeInitialState();
    this._drawos.initialize();
    this._drawing._initialize(this._drawos.getDrawingContext());
  }

  _execute(
    cursor: number,
    eventType: string,
    payload: any,
  ): PromiseOrValue<void> {
    this._targetCursor = cursor;
    if (eventType === GOTO_EVENT) {
      return this._goto(payload);
    }
    this._cursor = cursor;
    if (isModeEvent(eventType)) {
      return;
    }
    this._executeRaw(eventType, payload);
    this._drawos.afterExecute();
  }

  _executeRaw(eventType: string, payload: any) {
    if (eventType === GOTO_EVENT || isModeEvent(eventType)) {
      return;
    }
    const exec = this._drawing._handleCommand;
    // Call from local variable so `this` is null
    exec(
      this._makeDrawContext(),
      this._drawos.getDrawingContext(),
      eventType,
      payload,
    );
  }

  _makeDrawContext(): DrawContext {
    const {
      _drawing: { _dna, _modeMap },
      _state,
      _cursor,
    } = this;
    return {
      random: getRandomFn(_dna, _cursor),
      mode: _modeMap.getMode(_cursor),
      dna: _dna,
      state: _state,
    };
  }

  gotoEnd(): PromiseOrValue<void> {
    return this.goto(this.strokeCount);
  }

  redraw() {
    this._drawos.afterExecute();
  }

  goto(targetCursor: number): PromiseOrValue<void> {
    this._targetCursor = targetCursor;
    return this._goto(targetCursor);
  }

  async _goto(targetCursor: number): Promise<void> {
    if (this._inGoto) {
      return;
    }

    const { revert, skips, target } = this._drawing._planGoto(
      this._cursor,
      targetCursor,
    );
    if (target === undefined || skips === undefined) {
      return;
    }

    this._inGoto = true;

    // console.log(`goto ${this._cursor} -> ${targetCursor}: revert ${revert}, target ${target}, skips: ${skips.map(x => '[' + x + ']')}`)
    // Revert back to nearest snapshot
    const loadSnapshot = async (index: number) => {
      if (index === 0) {
        this._initialize();
      } else {
        const storageModel = this._drawing._storageModel;
        const snap = await storageModel.getSnapshot(index);
        const { state, snapshot } = snap;
        await this._drawos.loadSnapshot(
          snapshot,
          storageModel.getSnapshotLink.bind(storageModel),
        );
        this._cursor = index;
        this._state = jsonCopy(state);
      }
    };
    // Do we need to rewind?
    if (revert !== undefined) {
      await loadSnapshot(
        this._drawing._snapshotMap.getNearestSnapshotIndex(revert, skips),
      );
    } else {
      // Can we skip ahead using snapshots?
      const nearestSnapshotIndex = this._drawing._snapshotMap.getNearestSnapshotIndex(
        target,
        skips,
      );
      // Don't bother loading snapshot if we're not going to skip more than 100 steps with it
      // (This is very common when playing back!)
      const MIN_STEP_SKIP = 750;
      if (
        nearestSnapshotIndex !== 0 &&
        nearestSnapshotIndex > this._cursor + MIN_STEP_SKIP
      ) {
        await loadSnapshot(nearestSnapshotIndex);
      }
    }

    while (this._cursor < target) {
      const stroke = await this._drawing._storageModel.getStroke(this._cursor);
      const { type, payload } = stroke;
      if (!isSkipped(skips, this._cursor++)) {
        this._executeRaw(type, payload);
      }
    }

    this._drawos.afterExecute();
    this._inGoto = false;
  }
}
