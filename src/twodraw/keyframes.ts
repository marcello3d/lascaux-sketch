/**
 * In-memory keyframes for the 2draw player: copies of the replayed drawing
 * taken now and then as the replay goes (never stored anywhere), so a seek,
 * backwards especially, starts from the nearest one instead of replaying from
 * the start. Same design and memory budget as the other 2draw players'
 * (Lascaux Classic's and ChickenPaint's).
 *
 * Each layer is kept in bands of BAND_WORDS 32-bit words of its stored data
 * (float32, float16 bits or bytes, as the framebuffer keeps it), each
 * run-length encoded (layers are mostly runs of transparency); a band that
 * hasn't changed since the keyframe the replay came from is shared with it.
 * Only the rows drawn on since then are read back from the GPU.
 */
import { Artboard } from '../lascaux/DrawingDoc';
import { DrawingState } from '../lascaux/legacy-model';

const BAND_WORDS = 16 * 1024;
const RUN_FLAG = 0x80000000;
/** Rough cost of a keyframe's non-pixel state. */
const STATE_BYTES = 4096;
const MB = 1024 * 1024;

export interface KeptBuffer {
  /** 32-bit words in the layer's data */
  readonly words: number;
  readonly bands: Uint32Array[];
}

export interface Keyframe {
  /** stroke events applied (the replay continues with stroke `index`) */
  readonly index: number;
  /** the undo skips the replay used to get here, up to `index` (skipKey) */
  readonly tag: string;
  readonly artboard: Artboard;
  readonly state: DrawingState;
  readonly layers: Map<string, KeptBuffer>;
  /** bytes this keyframe added (bands not shared with an earlier one) */
  bytes: number;
}

export function encodeBand(words: Uint32Array): Uint32Array {
  const out = new Uint32Array(words.length + 2);
  let o = 0;
  let literalStart = 0;
  let i = 0;
  const n = words.length;
  const flushLiterals = (end: number): void => {
    if (end > literalStart) {
      out[o++] = end - literalStart;
      out.set(words.subarray(literalStart, end), o);
      o += end - literalStart;
    }
  };
  while (i < n) {
    const value = words[i];
    let runEnd = i + 1;
    while (runEnd < n && words[runEnd] === value) {
      runEnd++;
    }
    if (runEnd - i >= 3) {
      flushLiterals(i);
      out[o++] = (RUN_FLAG | (runEnd - i)) >>> 0;
      out[o++] = value;
      literalStart = runEnd;
    }
    i = runEnd;
  }
  flushLiterals(n);
  return out.slice(0, o);
}

export function decodeBand(encoded: Uint32Array, dest: Uint32Array, at: number): number {
  for (let i = 0; i < encoded.length; ) {
    const token = encoded[i++];
    if (token & RUN_FLAG) {
      const count = (token & ~RUN_FLAG) >>> 0;
      dest.fill(encoded[i++], at, at + count);
      at += count;
    } else {
      dest.set(encoded.subarray(i, i + token), at);
      i += token;
      at += token;
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

/** A layer's whole data, kept (sharing bands with `previous` where equal). */
export function keepAll(words: Uint32Array, previous: KeptBuffer | undefined, kf: { bytes: number }): KeptBuffer {
  const bands: Uint32Array[] = [];
  const same = previous !== undefined && previous.words === words.length;
  for (let offset = 0, i = 0; offset < words.length; offset += BAND_WORDS, i++) {
    const encoded = encodeBand(words.subarray(offset, Math.min(words.length, offset + BAND_WORDS)));
    const old = same ? previous!.bands[i] : undefined;
    if (old && sameWords(old, encoded)) {
      bands.push(old);
    } else {
      bands.push(encoded);
      kf.bytes += encoded.byteLength;
    }
  }
  return { words: words.length, bands };
}

/**
 * `base` with words [from, from + fresh.length) replaced by `fresh` (the rows
 * drawn on since): only the bands those touch are re-encoded.
 */
export function keepSpliced(base: KeptBuffer, from: number, fresh: Uint32Array, kf: { bytes: number }): KeptBuffer {
  const to = from + fresh.length;
  const scratch = new Uint32Array(BAND_WORDS);
  const bands = base.bands.map((old, i) => {
    const start = i * BAND_WORDS;
    const end = Math.min(base.words, start + BAND_WORDS);
    if (end <= from || start >= to) {
      return old;
    }
    const words = scratch.subarray(0, end - start);
    decodeBand(old, words, 0);
    const a = Math.max(from, start);
    const b = Math.min(to, end);
    words.set(fresh.subarray(a - from, b - from), a - start);
    const encoded = encodeBand(words);
    if (sameWords(old, encoded)) {
      return old;
    }
    kf.bytes += encoded.byteLength;
    return encoded;
  });
  return { words: base.words, bands };
}

/** A kept layer's words. */
export function unpack(kept: KeptBuffer): Uint32Array {
  const words = new Uint32Array(kept.words);
  let at = 0;
  for (const band of kept.bands) {
    at = decodeBand(band, words, at);
  }
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
    while (this.total > this.memory && this.list.length > 2) {
      const last = this.list.length - 1;
      this.list = this.list.filter((_, i) => i % 2 === 0 || i === last);
      this.recount();
      this.interval = this.interval > 0 ? this.interval * 2 : 1;
    }
    if (this.total > this.memory && this.list.length > 1) {
      this.list = this.list.slice(-1);
      this.recount();
    }
    if (this.total > this.memory) {
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
        for (const band of b.bands) {
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
