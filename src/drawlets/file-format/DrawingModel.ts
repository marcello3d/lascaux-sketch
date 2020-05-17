import {
  getNormalizedModePayload,
  GOTO_EVENT,
  isKeyframeEvent,
  isModeEvent,
} from './events';

import GotoMap, { isSkipped, Skips } from './GotoMap';
import ModeMap from './ModeMap';
import SnapshotMap from './SnapshotMap';

import seedrandom from 'seedrandom';

import jsonCopy from './json-copy';
import { Dna } from '../drawos/dna';
import {
  DRAW_END_EVENT,
  DrawingContext,
  DrawletHandleContext,
  DrawletHandleFn,
  DrawletInitContext,
  DrawletInitializeFn,
  DrawOs,
  DrawOsConstructor,
} from '../Drawlet';
import { StorageModel } from './StorageModel';
import { FiverDna, FiverMode, FiverState } from '../fiver/fiver';
import { VoidCallback } from './types';

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
function getInitializeContext<DrawletDna extends Dna>(
  dna: DrawletDna,
): DrawletInitContext<DrawletDna> {
  return {
    random: getRandomFn(dna, 0),
    dna,
  };
}

/**
 * Manages all the strokes and goto for a drawing, using external storage
 */
export default class DrawingModel<
  DrawletDna extends Dna = FiverDna,
  Mode extends object = FiverMode,
  State extends object = FiverState
> {
  readonly _storageModel: StorageModel;
  private _loadedCallbacks: VoidCallback[] | undefined = [];
  readonly _dna: DrawletDna;
  private readonly _DrawOs: DrawOsConstructor;
  private readonly _initializeCommand: DrawletInitializeFn<DrawletDna, Mode>;
  readonly _handleCommand: DrawletHandleFn<DrawletDna, Mode, State>;
  private readonly _queue: Array<{
    eventType: string;
    time: number;
    payload: any;
    callback?: VoidCallback;
  }> = [];
  _strokeCount: number = 0;
  private _drawingCursor: number = 0;
  private _loadError: Error | undefined;
  _snapshotMap!: SnapshotMap;
  _modeMap!: ModeMap<Mode>;
  private _gotoMap!: GotoMap;
  private _snapshotStrokeCount: number = 0;
  private _strokesSinceSnapshot: number = 0;
  private _editCanvas: CanvasModel<DrawletDna, Mode, State> | undefined;

  constructor({
    dna,
    editable,
    DrawOs,
    storageModel,
    initializeCommand,
    handleCommand,
    snapshotStrokeCount = 1000,
  }: {
    dna: DrawletDna;
    editable: boolean;
    DrawOs: DrawOsConstructor;
    storageModel: StorageModel;
    initializeCommand: DrawletInitializeFn<DrawletDna, Mode>;
    handleCommand: DrawletHandleFn<DrawletDna, Mode, State>;
    snapshotStrokeCount: number;
  }) {
    this._storageModel = storageModel;
    this._loadedCallbacks = [];
    this._dna = dna;
    this._DrawOs = DrawOs;
    this._initializeCommand = initializeCommand;
    this._handleCommand = handleCommand;
    this._queue = [];
    this._strokeCount = 0;
    this._drawingCursor = 0;
    storageModel.getRangeMetadata((error, metadata) => {
      if (error) {
        console.log('error getting range metadata: ' + error.message);
        this._loadError = error;
      } else {
        if (metadata) {
          const { ranges, gotos, keys, modes, snapshots } = metadata;
          this._gotoMap = GotoMap.deserialize({
            gotos,
            keys,
          });
          this._snapshotMap = new SnapshotMap(storageModel, snapshots);
          this._modeMap = ModeMap.deserialize(modes, this._initialize());
          if (ranges.length > 0) {
            this._strokeCount = ranges[ranges.length - 1][1] + 1;
            this._drawingCursor = this._gotoMap.dereference(this._strokeCount);
          }
        } else {
          this._gotoMap = new GotoMap();
          this._snapshotMap = new SnapshotMap(storageModel);
          this._modeMap = new ModeMap(this._initialize());
        }
      }
      if (this._loadedCallbacks) {
        for (const callback of this._loadedCallbacks) {
          callback(error);
        }
        this._loadedCallbacks = undefined;
      }
    });
    if (editable) {
      this._snapshotStrokeCount = snapshotStrokeCount;
      this._strokesSinceSnapshot = 0;
      this._editCanvas = this.createCanvas();
    }
  }

  _initialize(canvas?: DrawingContext) {
    const initializeCommand = this._initializeCommand;
    return initializeCommand(getInitializeContext(this._dna), canvas);
  }

  onceLoaded(callback: VoidCallback) {
    if (this._loadedCallbacks) {
      this._loadedCallbacks.push(callback);
    } else {
      callback(this._loadError);
    }
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

  createCanvas(): CanvasModel<DrawletDna, Mode, State> {
    return new CanvasModel(this, new this._DrawOs(this._dna));
  }

  snapshot(callback = () => {}) {
    const cursor = this._strokeCount;
    if (!this._editCanvas || !this._snapshotMap) {
      throw new Error('canvas not editable');
    }
    const { snapshot, links } = this._editCanvas._drawos.getSnapshot();
    const state = jsonCopy(this._editCanvas._state);
    this._snapshotMap.addSnapshot(cursor, { snapshot, links, state }, callback);
    this._strokesSinceSnapshot = 0;
  }

  flush(callback: VoidCallback) {
    this._storageModel.flush(callback);
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
    callback?: VoidCallback,
  ) {
    if (this._loadedCallbacks) {
      throw new Error('cannot add stroke before loaded');
    }
    if (this._loadError) {
      throw this._loadError;
    }
    this._queue.push({
      eventType,
      time,
      payload,
      callback,
    });
    this._runQueue();
  }

  _runQueue() {
    if (this._queue.length === 0) {
      return;
    }
    const { eventType, time, payload, callback } = this._queue.shift()!;

    const finished = () => {
      if (callback) {
        callback();
      }
      this._runQueue();
    };

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
      this._editCanvas._execute(this._strokeCount, eventType, payload, () => {
        this._recordStroke(eventType, time, payload);
        finished();
      });
    } else {
      finished();
    }
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

  getMetadata() {
    return {
      ...this._gotoMap.serialize(),
      modes: this._modeMap.serialize(),
      strokes: this._strokeCount,
    };
  }
}

export class CanvasModel<
  DrawletDna extends Dna,
  Mode extends object,
  State extends object
> {
  readonly _drawing: DrawingModel<DrawletDna, Mode, State>;
  readonly _drawos: DrawOs;
  _inGoto: boolean;
  _cursor: number = 0;
  _targetCursor: number = 0;
  _state: object = {};
  constructor(drawing: DrawingModel<DrawletDna, Mode, State>, drawOs: DrawOs) {
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

  get mode(): Mode {
    return this._drawing._modeMap.getMode(this.strokeCount);
  }

  get strokeCount(): number {
    return this._drawing._strokeCount;
  }

  get dom(): HTMLCanvasElement {
    return this._drawos.getDom();
  }

  setTransform(translateX: number, translateY: number, scale: number): void {
    this._drawos.setTransform(translateX, translateY, scale);
  }

  _initialize() {
    this._cursor = 0;
    this._state = {};
    this._drawos.initialize();
    this._drawing._initialize(this._drawos.getDrawingContext());
  }

  _execute(
    cursor: number,
    eventType: string,
    payload: any,
    callback: VoidCallback,
  ) {
    this._targetCursor = cursor;
    if (eventType === GOTO_EVENT) {
      return this._goto(payload, callback);
    }
    this._cursor = cursor;
    if (isModeEvent(eventType)) {
      return callback();
    }
    this._executeRaw(eventType, payload);
    this._drawos.afterExecute();
    callback();
  }

  _executeRaw(eventType: string, payload: any) {
    if (eventType === GOTO_EVENT || isModeEvent(eventType)) {
      return;
    }
    const exec = this._drawing._handleCommand;
    // Call from local variable so `this` is null
    exec(
      this._makeCanvasContext(),
      this._drawos.getDrawingContext(),
      eventType,
      payload,
    );
  }

  _makeCanvasContext(): DrawletHandleContext<DrawletDna, Mode, State> {
    const {
      _drawing: { _dna, _modeMap },
      _state,
      _cursor,
    } = this;
    return {
      random: getRandomFn(_dna, _cursor),
      mode: _modeMap.getMode(_cursor),
      dna: _dna,
      state: _state as State,
    };
  }

  gotoEnd(callback: VoidCallback) {
    this.goto(this.strokeCount, callback);
  }

  redraw() {
    this._drawos.afterExecute();
  }

  goto(targetCursor: number, callback: VoidCallback) {
    this._targetCursor = targetCursor;
    return this._goto(targetCursor, callback);
  }

  _goto(targetCursor: number, callback: VoidCallback) {
    const done = (error?: Error) => {
      this._inGoto = false;
      if (callback) {
        callback(error);
      }
    };
    if (this._inGoto) {
      return callback();
    }

    const { revert, skips, target } = this._drawing._planGoto(
      this._cursor,
      targetCursor,
    );
    if (target === undefined || skips === undefined) {
      return done();
    }

    this._inGoto = true;

    const runLoop = () => {
      if (this._cursor >= target) {
        this._drawos.afterExecute();
        return done();
      }
      let async: null | boolean = null;
      this._drawing._storageModel.getStroke(this._cursor, (error, stroke) => {
        if (error || !stroke) {
          console.error(
            `execution error ${
              error && (error.message || JSON.stringify(error))
            }`,
          );
          return done(error);
        }
        if (async === true) {
          // not immediate
        } else {
          // immediate
          async = false;
        }
        const { type, payload } = stroke;
        if (!isSkipped(skips, this._cursor++)) {
          this._executeRaw(type, payload);
        }
        runLoop();
      });
      if (async === null) {
        this._drawos.afterExecute();
        async = true;
      }
    };

    let waitForSnapshotLoad = false;
    // console.log(`goto ${this._cursor} -> ${targetCursor}: revert ${revert}, target ${target}, skips: ${skips.map(x => '[' + x + ']')}`)
    // Revert back to nearest snapshot
    const loadSnapshot = (index: number) => {
      if (index === 0) {
        this._initialize();
      } else {
        waitForSnapshotLoad = true;
        const storageModel = this._drawing._storageModel;
        storageModel.getSnapshot(index, (error, snap) => {
          if (error || !snap) {
            return done(error);
          }
          const { state, snapshot } = snap;
          this._drawos.loadSnapshot(
            snapshot,
            storageModel.getSnapshotLink.bind(storageModel),
            (error) => {
              if (error) {
                return done(error);
              }
              this._cursor = index;
              this._state = jsonCopy(state);
              runLoop();
            },
          );
        });
      }
    };
    // Do we need to rewind?
    if (revert !== undefined) {
      loadSnapshot(
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
        loadSnapshot(nearestSnapshotIndex);
      }
    }
    if (!waitForSnapshotLoad) {
      runLoop();
    }
  }
}
