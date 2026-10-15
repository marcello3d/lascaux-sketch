/**
 * The player's replay: shows the drawing after any number of its stroke
 * events exactly as the editor had it then — the editor's own GlDrawingContext
 * and brush (fiver.ts handleCommand), and its own way of carrying out undo and
 * redo. A !goto event sends the canvas back: to the start, or to one of the
 * editor's snapshots (taken every 250 events or so), then forward again over
 * the events up to its target, skipping the undone ones. How the editor did
 * each one is noted when the drawing is loaded (model.ts GotoPlan); here it is
 * done again on the GPU. Quirks included: the editor's snapshots are whole
 * 64px tiles, so going back to one leaves a partial tile at the right or
 * bottom edge as it was — and the stored picture has it so too.
 *
 * The state after n events depends only on n, so the replay keeps in-memory
 * keyframes (keyframes.ts: whole layers) to start a seek from the nearest one
 * instead of from the start. A replay from a keyframe draws the same pixels as
 * one from the start. The editor snapshots the gotos go back to are kept as
 * well (outside the keyframe budget: correctness, not speed).
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
import { decodeBand, Keyframe, KeyframeOptions, KeyframeStore, keepLayer, KeptBuffer } from './keyframes';
import { GotoPlan, LoadedDrawing } from './model';

/** How often (events) the replay looks at the clock. */
const CLOCK_EVERY = 32;

/** A goto being carried out: events next..target-1, skipping `skips`. */
interface PendingGoto {
  next: number;
  target: number;
  skips: Skips;
}

export class Replay {
  readonly ctx: GlDrawingContext;
  readonly keyframes: KeyframeStore | null;
  /** Events applied: the canvas's layers are the drawing after them (unless
   * a goto is under way, `pending`). */
  cursor = 0;
  /** Where the replay is headed (events). */
  target = 0;
  /**
   * The replay restored a keyframe or went back to the start since it was
   * last on a target: what it has drawn so far isn't a frame to show.
   */
  rewound = false;
  /** Replay work since the last keyframe (ms). */
  private work = 0;
  /** The editor's CanvasModel render cursor (a goto starts from it). */
  private renderCursor = 0;
  private pending: PendingGoto | null = null;
  private artboard: Artboard;
  private state: DrawingState = makeInitialState();
  /** The keyframe the layers were restored from or last kept as, with the
   * tiles drawn on since (ctx.takeDirtyTiles); null: read whole layers. */
  private base: Keyframe | null = null;
  /** The last keyframe or snapshot kept (to share tiles with when there is
   * no base). */
  private lastCapture: Keyframe | null = null;
  /** The drawing at the editor snapshots gotos go back to. */
  private readonly snapshots = new Map<number, Keyframe>();
  private snapshotBytes = 0;
  private readonly model: DrawingModel;
  private readonly strokes: readonly Stroke[];
  private readonly gotoPlans: Map<number, GotoPlan>;
  private readonly snapshotBases: Set<number>;
  private readonly initialArtboard: Artboard;
  private readonly wordsPerPixel: number;
  private readonly height: number;

  constructor(
    drawing: LoadedDrawing,
    keyframes: KeyframeOptions | false = {},
    /** Tests: the framebuffer precision to use at most. */
    maxPrecision?: 'float32' | 'float16' | 'uint8',
  ) {
    this.model = drawing.model;
    this.strokes = drawing.strokes;
    this.gotoPlans = drawing.gotoPlans;
    this.snapshotBases = drawing.snapshotBases;
    this.initialArtboard = drawing.doc.artboard;
    this.artboard = this.initialArtboard;
    this.height = Number(this.initialArtboard.height);
    this.ctx = new GlDrawingContext(this.initialArtboard, 64, { fixedSize: true, maxPrecision });
    this.keyframes = keyframes === false ? null : new KeyframeStore(keyframes);
    const bytesPerElement = new this.ctx.storedArrayType(1).BYTES_PER_ELEMENT;
    this.wordsPerPixel = bytesPerElement;
  }

  get length(): number {
    return this.strokes.length;
  }

  /** Bytes the kept editor snapshots use (bands they don't share). */
  get snapshotMemory(): number {
    return this.snapshotBytes;
  }

  /** The replay has reached its target. */
  get done(): boolean {
    return this.cursor === this.target && this.pending === null;
  }

  /**
   * Head for the drawing after `wanted` events: on from where the replay is,
   * or from the latest keyframe (or the start) before it, whichever is
   * further along.
   */
  plan(wanted: number): void {
    const target = Math.max(0, Math.min(Math.round(wanted), this.strokes.length));
    const here = this.cursor <= target ? this.cursor : -1;
    this.target = target;
    if (here === target && this.pending === null) {
      this.rewound = false;
      return;
    }
    let keyframe = this.keyframes?.before(target, () => true) ?? null;
    // the snapshots kept for gotos are whole states too
    for (const snapshot of this.snapshots.values()) {
      if (snapshot.index <= target && (!keyframe || snapshot.index > keyframe.index)) {
        keyframe = snapshot;
      }
    }
    if (keyframe && keyframe.index > here) {
      this.restore(keyframe);
    } else if (here < 0) {
      this.restart();
    }
  }

  /** Replay toward the target for up to `budget` ms; true once there. Takes
   * keyframes (and the snapshots gotos need) as it goes. */
  advance(budget: number): boolean {
    const started = performance.now();
    let last = started;
    let count = 0;
    while (this.pending !== null || this.cursor < this.target) {
      const pending = this.pending;
      if (pending) {
        if (pending.next < pending.target) {
          const index = pending.next++;
          const { type, payload } = this.strokes[index];
          if (type !== GOTO_EVENT && !isSkipped(pending.skips, index)) {
            this.execute(index, type, payload);
          }
        }
        if (pending.next >= pending.target) {
          // the goto is done
          this.renderCursor = pending.target;
          this.pending = null;
          this.cursor++;
          this.atCursor();
        }
      } else {
        const index = this.cursor;
        const { type, payload } = this.strokes[index];
        if (type === GOTO_EVENT) {
          this.startGoto(index);
          if (this.pending === null) {
            this.cursor++;
            this.atCursor();
          }
        } else {
          this.execute(index, type, payload);
          this.renderCursor = index + 1;
          this.cursor++;
          this.atCursor();
        }
      }
      if (++count % CLOCK_EVERY === 0) {
        const now = performance.now();
        this.work += now - last;
        last = now;
        if (this.pending === null && this.keyframes?.due(this.cursor, this.work)) {
          this.keep(this.keyframes);
          last = performance.now();
        }
        if (now - started >= budget && (this.pending !== null || this.cursor < this.target)) {
          return false;
        }
      }
    }
    this.rewound = false;
    return true;
  }

  /** Just reached `cursor` (no goto under way): keep it if a goto needs it. */
  private atCursor(): void {
    if (this.snapshotBases.has(this.cursor) && !this.snapshots.has(this.cursor)) {
      const before = this.snapshotBytes;
      const kept = this.capture();
      this.snapshots.set(this.cursor, kept);
      this.snapshotBytes = before + kept.bytes;
      this.keyframes?.reserve(kept.bytes);
    }
  }

  /** CanvasModel._goto, as the editor carried out the goto at `index`. */
  private startGoto(index: number): void {
    const plan = this.gotoPlans.get(index);
    if (!plan) {
      // nothing to do (it went where the canvas already was)
      return;
    }
    if (plan.renderCursor !== this.renderCursor) {
      throw new Error(`goto ${index}: replay at ${this.renderCursor}, editor at ${plan.renderCursor}`);
    }
    let from = this.renderCursor;
    if (plan.base === 'reset') {
      this.clear();
      from = 0;
    } else if (typeof plan.base === 'number') {
      const snapshot = this.snapshots.get(plan.base);
      if (!snapshot) {
        throw new Error(`goto ${index}: no snapshot ${plan.base}`);
      }
      // CanvasModel's loadSnapshot: the artboard, the brush state, and the
      // snapshot's whole tiles; edges stay as they are.
      this.setArtboard(snapshot.artboard);
      const { width, height } = this.ctx.snapshotRegion;
      this.writeLayers(snapshot, width, height);
      this.state = jsonCopy(snapshot.state);
      // the layers are the snapshot's now, but for the edges
      this.ctx.setDirtyOutside(width, height);
      this.base = snapshot;
      from = plan.base;
    }
    this.renderCursor = from;
    this.pending = { next: from, target: plan.target, skips: plan.skips };
  }

  /** CanvasModel.execute (modes come from the map the editor built). */
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

  /** CanvasModel.reset: blank layers, the first artboard. */
  private clear(): void {
    this.artboard = this.initialArtboard;
    this.state = makeInitialState();
    this.ctx.reset(this.initialArtboard);
    this.ctx.clearDirty();
    this.base = null;
  }

  /** Back to the blank start. */
  private restart(): void {
    this.clear();
    this.cursor = 0;
    this.renderCursor = 0;
    this.pending = null;
    this.work = 0;
    this.rewound = true;
    this.atCursor();
  }

  /** `words` as the stored data's typed array. */
  private stored(words: Uint32Array): any {
    const Type = this.ctx.storedArrayType as any;
    return new Type(words.buffer, words.byteOffset, words.byteLength / Type.BYTES_PER_ELEMENT);
  }

  /**
   * Put `kept`'s layers on the GPU, in the top-left width × height (whole
   * tiles): only the tiles that aren't already there (the same kept tile as
   * the base's, not drawn on since).
   */
  private writeLayers(kept: Keyframe, width: number, height: number): void {
    const { size, tilesX } = this.ctx.dirtyGrid;
    const base = this.base;
    for (const [id, layer] of kept.layers) {
      const old = base?.layers.get(id);
      const scratch = new Uint32Array(size * size * layer.unit);
      layer.tiles.forEach((tile, i) => {
        const x = (i % tilesX) * size;
        const y = Math.floor(i / tilesX) * size;
        const w = Math.min(size, layer.width - x);
        const h = Math.min(size, layer.height - y);
        if (x + w > width || y + h > height) {
          return;
        }
        if (old && old.tiles[i] === tile && !this.ctx.isDirty(id, i)) {
          return;
        }
        const words = scratch.subarray(0, w * h * layer.unit);
        decodeBand(tile, words, 0, layer.unit);
        this.ctx.writeLayerRect(id, x, y, w, h, this.stored(words));
      });
    }
  }

  private restore(keyframe: Keyframe): void {
    this.setArtboard(keyframe.artboard);
    this.writeLayers(keyframe, Infinity, Infinity);
    this.ctx.clearDirty();
    this.base = keyframe;
    this.state = jsonCopy(keyframe.state);
    this.cursor = keyframe.index;
    this.renderCursor = keyframe.renderCursor;
    this.pending = null;
    this.work = 0;
    this.rewound = true;
  }

  /** The drawing as it is now, kept (sharing what it can with `base`). */
  private capture(): Keyframe {
    const keyframe: Keyframe = {
      index: this.cursor,
      renderCursor: this.renderCursor,
      artboard: this.artboard,
      state: jsonCopy(this.state),
      layers: new Map<string, KeptBuffer>(),
      bytes: 0,
    };
    const base = this.base;
    const last = this.lastCapture;
    const { size, tilesX } = this.ctx.dirtyGrid;
    const width = Number(this.initialArtboard.width);
    const shape = { width, height: this.height, size, unit: this.wordsPerPixel };
    for (const id of this.ctx.layerIds()) {
      const dirty = this.ctx.takeDirtyTiles(id);
      const old = base?.layers.get(id);
      if (old && !dirty) {
        keyframe.layers.set(id, old);
        continue;
      }
      const fresh = old && dirty ? dirty : true;
      // read in full: still share the tiles that came out as they were
      const previous = old ?? last?.layers.get(id);
      // read back the box around the tiles to keep
      let x0 = 0;
      let y0 = 0;
      let x1 = width;
      let y1 = this.height;
      if (fresh !== true) {
        x0 = y0 = Infinity;
        x1 = y1 = 0;
        for (const i of fresh) {
          const tx = (i % tilesX) * size;
          const ty = Math.floor(i / tilesX) * size;
          x0 = Math.min(x0, tx);
          y0 = Math.min(y0, ty);
          x1 = Math.max(x1, Math.min(width, tx + size));
          y1 = Math.max(y1, Math.min(this.height, ty + size));
        }
      }
      const data = this.ctx.readLayerRect(id, x0, y0, x1 - x0, y1 - y0);
      const words = new Uint32Array(data.buffer, data.byteOffset, data.byteLength >> 2);
      keyframe.layers.set(id, keepLayer(shape, previous, fresh, { x: x0, y: y0, w: x1 - x0, words }, keyframe));
    }
    this.base = keyframe;
    this.lastCapture = keyframe;
    return keyframe;
  }

  /** Keep a keyframe of the drawing as it is now. */
  private keep(store: KeyframeStore): void {
    store.add(this.capture());
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
