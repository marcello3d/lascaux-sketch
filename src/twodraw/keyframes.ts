/**
 * In-memory keyframes for the 2draw player: copies of the replayed drawing
 * taken now and then as the replay goes (never stored anywhere), so a seek,
 * backwards especially, starts from the nearest one instead of replaying from
 * the start. Same design and memory budget as the other 2draw players'
 * (Lascaux Classic's and ChickenPaint's).
 *
 * Each layer is kept in 64px tiles of its stored data (float32, float16 bits
 * or bytes, as the framebuffer keeps it), each run-length encoded by pixel
 * (layers are mostly runs of transparency or of one colour); a tile that
 * hasn't been drawn on since the keyframe the replay came from is shared with
 * it, and only the tiles drawn on are read back from the GPU.
 */
import { Artboard } from '../lascaux/DrawingDoc';
import { DrawingState } from '../lascaux/legacy-model';

const RUN_FLAG = 0x80000000;
/** Rough cost of a keyframe's non-pixel state. */
const STATE_BYTES = 4096;
const MB = 1024 * 1024;

/** A layer, kept as run-length encoded tiles (row by row, left to right). */
export interface KeptBuffer {
  readonly width: number;
  readonly height: number;
  /** tile size (px) */
  readonly size: number;
  /** words per pixel (the run-length unit) */
  readonly unit: number;
  readonly tiles: Uint32Array[];
}

export interface Keyframe {
  /** stroke events applied (the replay continues with stroke `index`) */
  readonly index: number;
  /** the editor's render cursor then (where its next goto starts from) */
  readonly renderCursor: number;
  readonly artboard: Artboard;
  readonly state: DrawingState;
  readonly layers: Map<string, KeptBuffer>;
  /** bytes this keyframe added (bands not shared with an earlier one) */
  bytes: number;
}

/**
 * Run-length encodes `words` in units of `unit` words (one pixel: 4 words of
 * float32, 2 of float16, 1 of bytes): a run of one pixel repeated is
 * [RUN_FLAG | count, ...pixel], anything else [count, ...pixels].
 */
export function encodeBand(words: Uint32Array, unit: number = 1): Uint32Array {
  const n = words.length / unit;
  const out = new Uint32Array(words.length + 2 * unit + 2);
  let o = 0;
  let literalStart = 0;
  const same = (a: number, b: number): boolean => {
    for (let k = 0; k < unit; k++) {
      if (words[a * unit + k] !== words[b * unit + k]) {
        return false;
      }
    }
    return true;
  };
  const flushLiterals = (end: number): void => {
    if (end > literalStart) {
      out[o++] = end - literalStart;
      out.set(words.subarray(literalStart * unit, end * unit), o);
      o += (end - literalStart) * unit;
    }
  };
  let i = 0;
  while (i < n) {
    let runEnd = i + 1;
    while (runEnd < n && same(runEnd, i)) {
      runEnd++;
    }
    if (runEnd - i >= 3) {
      flushLiterals(i);
      out[o++] = (RUN_FLAG | (runEnd - i)) >>> 0;
      out.set(words.subarray(i * unit, i * unit + unit), o);
      o += unit;
      literalStart = runEnd;
    }
    i = runEnd;
  }
  flushLiterals(n);
  return out.slice(0, o);
}

/** Decodes a band (encodeBand's) into `dest` from word `at`; returns the end. */
export function decodeBand(encoded: Uint32Array, dest: Uint32Array, at: number, unit: number = 1): number {
  for (let i = 0; i < encoded.length; ) {
    const token = encoded[i++];
    if (token & RUN_FLAG) {
      const count = (token & ~RUN_FLAG) >>> 0;
      if (unit === 1) {
        dest.fill(encoded[i], at, at + count);
      } else {
        const pixel = encoded.subarray(i, i + unit);
        for (let c = 0; c < count; c++) {
          dest.set(pixel, at + c * unit);
        }
      }
      i += unit;
      at += count * unit;
    } else {
      const length = token * unit;
      dest.set(encoded.subarray(i, i + length), at);
      i += length;
      at += length;
    }
  }
  return at;
}

function sameWords(a: Uint32Array, b: Uint32Array): boolean {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}

/**
 * A layer kept from `previous`, with the tiles in `fresh` (true: all) taken
 * from `read` (the stored-data words of the layer's rectangle x, y, w × h,
 * which covers them): tiles that come out the same are shared.
 */
export function keepLayer(
  shape: { width: number; height: number; size: number; unit: number },
  previous: KeptBuffer | undefined,
  fresh: Set<number> | true,
  read: { x: number; y: number; w: number; words: Uint32Array },
  kf: { bytes: number },
): KeptBuffer {
  const { width, height, size, unit } = shape;
  const tilesX = Math.ceil(width / size);
  const tilesY = Math.ceil(height / size);
  const same =
    previous !== undefined &&
    previous.width === width &&
    previous.height === height &&
    previous.size === size &&
    previous.unit === unit;
  const scratch = new Uint32Array(size * size * unit);
  const tiles: Uint32Array[] = [];
  for (let ty = 0, i = 0; ty < tilesY; ty++) {
    for (let tx = 0; tx < tilesX; tx++, i++) {
      const old = same ? previous!.tiles[i] : undefined;
      if (old && fresh !== true && !fresh.has(i)) {
        tiles.push(old);
        continue;
      }
      const x0 = tx * size;
      const y0 = ty * size;
      const tw = Math.min(size, width - x0);
      const th = Math.min(size, height - y0);
      const rowWords = tw * unit;
      const words = scratch.subarray(0, rowWords * th);
      for (let y = 0; y < th; y++) {
        const at = ((y0 + y - read.y) * read.w + (x0 - read.x)) * unit;
        words.set(read.words.subarray(at, at + rowWords), y * rowWords);
      }
      const encoded = encodeBand(words, unit);
      if (old && sameWords(old, encoded)) {
        tiles.push(old);
      } else {
        tiles.push(encoded);
        kf.bytes += encoded.byteLength;
      }
    }
  }
  return { width, height, size, unit, tiles };
}

/** A kept layer's words, row by row from y = 0. */
export function unpack(kept: KeptBuffer): Uint32Array {
  const { width, height, size, unit } = kept;
  const words = new Uint32Array(width * height * unit);
  const tilesX = Math.ceil(width / size);
  const scratch = new Uint32Array(size * size * unit);
  kept.tiles.forEach((tile, i) => {
    const x0 = (i % tilesX) * size;
    const y0 = Math.floor(i / tilesX) * size;
    const tw = Math.min(size, width - x0);
    const th = Math.min(size, height - y0);
    const rowWords = tw * unit;
    decodeBand(tile, scratch, 0, unit);
    for (let y = 0; y < th; y++) {
      words.set(scratch.subarray(y * rowWords, (y + 1) * rowWords), ((y0 + y) * width + x0) * unit);
    }
  });
  return words;
}

/**
 * How much memory keyframes may use on this device: 16MB per GB of RAM
 * where the browser says (navigator.deviceMemory), up to 128MB; otherwise by
 * the screen: 32MB on phones, 64MB on tablets, 128MB on desktops. Over budget
 * the player keeps fewer, evenly spread keyframes: a small budget costs seek
 * speed, never correctness.
 */
export function defaultKeyframeMemory(): number {
  const nav = (typeof navigator !== 'undefined' ? navigator : {}) as { deviceMemory?: number };
  if (typeof nav.deviceMemory === 'number' && nav.deviceMemory > 0) {
    return Math.max(16 * MB, Math.min(128 * MB, nav.deviceMemory * 16 * MB));
  }
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  if (coarse && typeof screen !== 'undefined') {
    return Math.min(screen.width, screen.height) < 600 ? 32 * MB : 64 * MB;
  }
  return 128 * MB;
}

export interface KeyframeOptions {
  /** Take a keyframe after about this much replay work (ms). Default 150; 0: at every chance. */
  interval?: number;
  /** Bytes the keyframes may use. Default defaultKeyframeMemory(). */
  memory?: number;
}

/** The keyframes of one replay, in stroke order. */
export class KeyframeStore {
  private list: Keyframe[] = [];
  private total = 0;
  /** Memory spent elsewhere out of the same budget (the replay's must-keep
   * snapshots). */
  private reserved = 0;
  private interval: number;
  private readonly memory: number;

  constructor(options: KeyframeOptions = {}) {
    this.interval = options.interval ?? 150;
    this.memory = options.memory ?? defaultKeyframeMemory();
  }

  get count(): number {
    return this.list.length;
  }

  /** Memory the keyframes use (shared bands counted once). */
  get bytes(): number {
    return this.total;
  }

  get keyframes(): readonly Keyframe[] {
    return this.list;
  }

  /** Index of the last keyframe (0: none). */
  get frontier(): number {
    return this.list.length > 0 ? this.list[this.list.length - 1].index : 0;
  }

  /** Whether a keyframe is due at stroke `index` after `work` ms of replay. */
  due(index: number, work: number): boolean {
    return index > this.frontier && work >= this.interval && this.interval !== Infinity;
  }

  /** `bytes` more of the budget are spent elsewhere. */
  reserve(bytes: number): void {
    this.reserved += bytes;
    this.fit();
  }

  add(keyframe: Keyframe): void {
    this.list.push(keyframe);
    this.total += keyframe.bytes + STATE_BYTES;
    this.fit();
  }

  /**
   * Over budget: drop every other keyframe (keeping the first and the
   * newest) so they stay evenly spread, and take them half as often.
   */
  private fit(): void {
    while (this.total + this.reserved > this.memory && this.list.length > 2) {
      const last = this.list.length - 1;
      this.list = this.list.filter((_, i) => i % 2 === 0 || i === last);
      this.recount();
      this.interval = this.interval > 0 ? this.interval * 2 : 1;
    }
    if (this.total + this.reserved > this.memory && this.list.length > 1) {
      this.list = this.list.slice(-1);
      this.recount();
    }
    if (this.total + this.reserved > this.memory) {
      // not even one fits: stop (seeks replay from the start, as without keyframes)
      this.list = [];
      this.total = 0;
      this.interval = Infinity;
    }
  }

  private recount(): void {
    const seen = new Set<Uint32Array>();
    let total = 0;
    for (const k of this.list) {
      total += STATE_BYTES;
      for (const b of k.layers.values()) {
        for (const band of b.tiles) {
          if (!seen.has(band)) {
            seen.add(band);
            total += band.byteLength;
          }
        }
      }
    }
    this.total = total;
  }

  /** The latest keyframe at or before stroke `target` that `fits` accepts. */
  before(target: number, fits: (k: Keyframe) => boolean): Keyframe | null {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const k = this.list[i];
      if (k.index <= target && fits(k)) {
        return k;
      }
    }
    return null;
  }
}
