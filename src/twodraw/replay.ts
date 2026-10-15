/**
 * The player's replay: draws the stroke events on the GPU (the editor's own
 * GlDrawingContext and brush, fiver.ts handleCommand) to show the drawing as
 * it was after any number of them, the way the editor's CanvasModel.goto
 * does — including its undo/redo, where a !goto event sends the drawing back
 * to an earlier point and the events in between are skipped from then on.
 *
 * Where CanvasModel goes back to its stored snapshots, this keeps its own
 * in-memory keyframes (keyframes.ts): whole layers, so they restore exactly
 * (the editor's tile snapshots leave out a partial tile at the right and
 * bottom edges). A replay from a keyframe draws the same pixels as one from
 * the start.
 *
 * The state after n events depends on n and on which of those events are
 * skipped (the undo skips in force at the target). Every state the replay is
 * in, and every keyframe, is tagged with those skips up to its own n
 * (skipKey); one is a valid start for a target only if the target's skips
 * agree up to there.
 */
import produce from 'immer';
import DrawingModel from '../lascaux/data-model/DrawingModel';
import { Stroke } from '../lascaux/data-model/StorageModel';
import { GOTO_EVENT, PATCH_ARTBOARD_EVENT, PATCH_MODE_EVENT } from '../lascaux/data-model/events';
import { isSkipped, Skips } from '../lascaux/data-model/GotoMap';
import { immerPatch } from '../lascaux/data-model/patch';
import { Artboard } from '../lascaux/DrawingDoc';
import { safeMode } from '../lascaux/DrawingDocUtil';
import { handleCommand } from '../lascaux/fiver';
import { DrawingState, handleLegacyEvent, isLegacyEvent, makeInitialState } from '../lascaux/legacy-model';
import jsonCopy from '../lascaux/util/json-copy';
import { GlDrawingContext } from '../lascaux/webgl/GlDrawingContext';
import { Keyframe, KeyframeOptions, KeyframeStore, keepAll, keepSpliced, KeptBuffer, unpack } from './keyframes';

/** The skips `skips` makes before event `index`, as a string (a state's tag). */
export function skipKey(skips: Skips, index: number): string {
  let key = '';
  for (const [from, to] of skips) {
    if (from >= index) {
      break;
    }
    key += from + '-' + Math.min(to, index - 1) + ',';
  }
  return key;
}

/** How often (events) the replay looks at the clock. */
const CLOCK_EVERY = 32;

export class Replay {
  readonly ctx: GlDrawingContext;
  readonly keyframes: KeyframeStore | null;
  /** Events applied (the canvas's layers are the drawing after them). */
  cursor = 0;
  /** Where the replay is headed (events, an undo's target already followed). */
  target = 0;
  /**
   * The replay restored a keyframe or the start since it was last on a
   * target: what it has drawn so far isn't a frame of the animation.
   */
  rewound = false;
  /** Replay work since the last keyframe (ms). */
  private work = 0;
  private skips: Skips = [];
  private artboard: Artboard;
  private state: DrawingState = makeInitialState();
  /** The keyframe the layers were restored from or last kept as, with the
   * rows drawn since (ctx.takeDirtyRows); null: from the start (blank). */
  private base: Keyframe | null = null;
  private readonly initialArtboard: Artboard;
  private readonly wordsPerRow: number;

  constructor(
    private readonly model: DrawingModel,
    private readonly strokes: readonly Stroke[],
    initialArtboard: Artboard,
    keyframes: KeyframeOptions | false = {},
    /** Tests: the framebuffer precision to use at most. */
    maxPrecision?: 'float32' | 'float16' | 'uint8',
  ) {
    this.initialArtboard = initialArtboard;
    this.artboard = initialArtboard;
    this.ctx = new GlDrawingContext(initialArtboard, 64, { fixedSize: true, maxPrecision });
    this.keyframes = keyframes === false ? null : new KeyframeStore(keyframes);
    const bytesPerElement = new this.ctx.storedArrayType(1).BYTES_PER_ELEMENT;
    this.wordsPerRow = (this.ctx.rowLength * bytesPerElement) / 4;
  }

  get length(): number {
    return this.strokes.length;
  }

  /** Where the drawing is after `wanted` events: an undo (a !goto just
   * before) goes to its target. */
  resolve(wanted: number): number {
    return this.model.gotoMap.dereference(Math.max(0, Math.min(wanted, this.strokes.length)));
  }

  /** The replay has reached its target. */
  get done(): boolean {
    return this.cursor === this.target;
  }

  /**
   * Head for the drawing after `wanted` events: from where the replay is, or
   * from the latest keyframe (or the start) that leads there, whichever is
   * further along.
   */
  plan(wanted: number): void {
    const target = this.resolve(wanted);
    const skips = this.model.gotoMap._getSkips(target - 1);
    const here =
      this.cursor <= target && skipKey(skips, this.cursor) === skipKey(this.skips, this.cursor)
        ? this.cursor
        : -1;
    this.target = target;
    this.skips = skips;
    if (here === target) {
      this.rewound = false;
      return;
    }
    const keyframe = this.keyframes?.before(target, (k) => k.tag === skipKey(skips, k.index)) ?? null;
    if (keyframe && keyframe.index > here) {
      this.restore(keyframe);
    } else if (here < 0) {
      this.reset();
    }
  }

  /**
   * Replay toward the target for up to `budget` ms; true once there. Takes
   * keyframes as it goes.
   */
  advance(budget: number): boolean {
    const started = performance.now();
    let last = started;
    let count = 0;
    while (this.cursor < this.target) {
      const index = this.cursor;
      const { type, payload } = this.strokes[index];
      if (type !== GOTO_EVENT && !isSkipped(this.skips, index)) {
        this.execute(index, type, payload);
      }
      this.cursor = index + 1;
      if (++count % CLOCK_EVERY === 0 || this.cursor === this.target) {
        const now = performance.now();
        this.work += now - last;
        last = now;
        if (this.keyframes?.due(this.cursor, this.work)) {
          this.keep();
          last = performance.now();
        }
        if (now - started >= budget && this.cursor < this.target) {
          return false;
        }
      }
    }
    this.rewound = false;
    return true;
  }

  /** CanvasModel.execute (replaying: modes come from the recorded map). */
  private execute(index: number, type: string, payload: any): void {
    switch (type) {
      case PATCH_ARTBOARD_EVENT:
        this.setArtboard(immerPatch(this.artboard, payload));
        return;
      case PATCH_MODE_EVENT:
        return;
    }
    const mode = safeMode(this.artboard, this.model.editCanvas.getModeAt(index));
    if (isLegacyEvent(type)) {
      const [, artboard] = produce([mode, this.artboard], ([modeDraft, artboardDraft]) => {
        handleLegacyEvent(artboardDraft, modeDraft, type, payload);
      });
      this.setArtboard(artboard);
      return;
    }
    handleCommand(mode, this.state, this.ctx, type, payload);
  }

  private setArtboard(artboard: Artboard): void {
    this.artboard = artboard;
    this.ctx.setArtboard(artboard);
  }

  /** Back to the blank start. */
  private reset(): void {
    this.cursor = 0;
    this.artboard = this.initialArtboard;
    this.state = makeInitialState();
    this.ctx.reset(this.initialArtboard);
    this.ctx.clearDirty();
    this.base = null;
    this.work = 0;
    this.rewound = true;
  }

  private restore(keyframe: Keyframe): void {
    this.setArtboard(keyframe.artboard);
    for (const [id, kept] of keyframe.layers) {
      const words = unpack(kept);
      this.ctx.writeLayer(id, new (this.ctx.storedArrayType as any)(words.buffer));
    }
    this.ctx.clearDirty();
    this.base = keyframe;
    this.artboard = keyframe.artboard;
    this.state = jsonCopy(keyframe.state);
    this.cursor = keyframe.index;
    this.work = 0;
    this.rewound = true;
  }

  /** Keep a keyframe of the drawing as it is now. */
  private keep(): void {
    const store = this.keyframes;
    if (!store) {
      return;
    }
    const keyframe: Keyframe = {
      index: this.cursor,
      tag: skipKey(this.skips, this.cursor),
      artboard: this.artboard,
      state: jsonCopy(this.state),
      layers: new Map<string, KeptBuffer>(),
      bytes: 0,
    };
    const base = this.base;
    for (const id of this.ctx.layerIds()) {
      const dirty = this.ctx.takeDirtyRows(id);
      const old = base?.layers.get(id);
      let kept: KeptBuffer;
      if (old && !dirty) {
        kept = old;
      } else if (old && dirty) {
        const data = this.ctx.readLayerRows(id, dirty[0], dirty[1]);
        const words = new Uint32Array(data.buffer, data.byteOffset, data.byteLength >> 2);
        kept = keepSpliced(old, dirty[0] * this.wordsPerRow, words, keyframe);
      } else {
        const data = this.ctx.readLayerRows(id, 0, Number(this.initialArtboard.height));
        kept = keepAll(new Uint32Array(data.buffer, data.byteOffset, data.byteLength >> 2), undefined, keyframe);
      }
      keyframe.layers.set(id, kept);
    }
    store.add(keyframe);
    this.base = keyframe;
    this.work = 0;
  }

  /** Let go of the WebGL context (browsers allow only a few at once). */
  dispose(): void {
    const gl = this.ctx.getDom().getContext('webgl');
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  }

  /** Draw the drawing as the replay has it onto the canvas. */
  present(): void {
    this.ctx.present();
  }
}
