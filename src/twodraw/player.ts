/**
 * Lascaux Sketch 2 animation player for 2draw.net: replays a drawing's
 * exported strokes (the .json.gz the editor uploads, ExportedDrawingV1) on
 * the editor's own WebGL engine, with the members 2draw's inline animation
 * strip drives (worker/src/client/lsa-player.ts there, the same as
 * LascauxClassicPlayer's): ready, duration, currentTime, isPlaying, seeking,
 * play(), pause(), seek(ms), setSpeed(rate).
 *
 * Builds to a self-contained IIFE (twodraw/build.mjs) exposing
 * window.Lascaux2Player:
 *
 *   const player = new Lascaux2Player({
 *     domRoot: document.getElementById('watch'),
 *     url: '/data/1/12345/12345-v1.json.gz',
 *     fit: 'contain',
 *   });
 *
 * Time is the drawing's own (timeline.ts: the pen's timestamps, pauses
 * shortened); a seek replays in slices from the nearest in-memory keyframe
 * (replay.ts), keeping the last frame on the canvas until it lands.
 */
import { ExportedDrawingV1 } from '../lascaux/ExportedDrawing';
import { loadDrawing } from './model';
import { Replay } from './replay';
import { KeyframeOptions } from './keyframes';
import { buildTimes, cursorAt, durationOf, MAX_IDLE, timeOf } from './timeline';

export interface Lascaux2PlayerOptions {
  domRoot: HTMLElement;
  /** The drawing's .json.gz (any of the three names; or pass `data`). */
  url?: string;
  lsaUrl?: string;
  jsonGzUrl?: string;
  data?: ArrayBuffer | Uint8Array;
  /** Display box (CSS px) for fit 'box'; defaults to the drawing's size. */
  width?: number;
  height?: number;
  /** Start playing once loaded. Default false. */
  autoplay?: boolean;
  /** Playback rate. Default 1. */
  speed?: number;
  /** Accepted for compatibility; this player has no controls of its own. */
  controls?: boolean;
  /** 'box' (default): a width × height box; 'contain': fill domRoot, keeping the aspect. */
  fit?: 'box' | 'contain';
  /** Pauses in the recording are shortened to this many ms. Default 500. */
  maxIdle?: number;
  /** In-memory keyframes (memory budget, interval); false: none. */
  keyframes?: KeyframeOptions | false;
  onLoad?: (info: { width: number; height: number; duration: number }) => void;
  onTimeUpdate?: (info: PlayerTimeInfo) => void;
  onError?: (error: Error) => void;
  onEnd?: () => void;
  /** Never called: a .json.gz keeps no picture to compare the replay with. */
  onDrift?: (drift: unknown) => void;
}

export interface PlayerTimeInfo {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  progress: number;
  seeking: boolean;
}

/** Replay work per slice of a long seek (ms), between which the page runs. */
const SEEK_SLICE_MS = 16;
/** Replay work per animation frame while playing (ms). */
const FRAME_BUDGET_MS = 30;

/** Runs fn in a new task, soon (setTimeout(0) is clamped to 4 ms when nested). */
const nextTask: (fn: () => void) => void = (() => {
  if (typeof MessageChannel === 'undefined') {
    return (fn: () => void) => void setTimeout(fn, 0);
  }
  const channel = new MessageChannel();
  const queue: (() => void)[] = [];
  channel.port1.onmessage = () => queue.shift()?.();
  return (fn: () => void) => {
    queue.push(fn);
    channel.port2.postMessage(null);
  };
})();

/** The exported drawing in `bytes`: gzipped JSON (or plain, if the server
 * already unpacked it). */
export async function readDrawing(bytes: Uint8Array): Promise<ExportedDrawingV1> {
  let text: string;
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
    if (typeof DecompressionStream === 'undefined') {
      throw new Error('this browser cannot unpack the animation');
    }
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    text = await new Response(stream).text();
  } else {
    text = new TextDecoder().decode(bytes);
  }
  return JSON.parse(text);
}

export class Lascaux2Player {
  /** Resolves once the drawing is loaded (rejects on failure). */
  readonly ready: Promise<void>;
  private replay: Replay | null = null;
  private times = new Float64Array(0);
  private playing = false;
  private playhead = 0;
  private lastFrame = 0;
  private raf = 0;
  private speed: number;
  private destroyed = false;
  /** Where an unfinished seek is headed (ms), or null. */
  private seekTarget: number | null = null;
  private slicePending = false;
  private seekGen = 0;
  private canvas: HTMLCanvasElement | null = null;

  constructor(private readonly options: Lascaux2PlayerOptions) {
    this.speed = options.speed && options.speed > 0 ? options.speed : 1;
    this.ready = this.load();
    this.ready.catch((err: unknown) => {
      const error = err instanceof Error ? err : new Error(String(err));
      options.onError?.(error);
    });
  }

  private async load(): Promise<void> {
    const { data } = this.options;
    const url = this.options.url ?? this.options.lsaUrl ?? this.options.jsonGzUrl;
    let bytes: Uint8Array;
    if (data) {
      bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    } else if (url) {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`download failed: ${res.status}`);
      }
      bytes = new Uint8Array(await res.arrayBuffer());
    } else {
      throw new Error('no url or data given');
    }
    const json = await readDrawing(bytes);
    const drawing = await loadDrawing(json);
    const { doc, strokes } = drawing;
    if (this.destroyed) {
      return;
    }
    this.times = buildTimes(strokes, this.options.maxIdle ?? MAX_IDLE);
    const replay = new Replay(drawing, this.options.keyframes ?? {});
    this.replay = replay;
    const width = Number(doc.artboard.width);
    const height = Number(doc.artboard.height);
    const canvas = replay.ctx.getDom();
    this.canvas = canvas;
    canvas.setAttribute('aria-hidden', 'true');
    const style = canvas.style;
    style.position = '';
    style.left = style.top = '';
    style.display = 'block';
    style.objectFit = 'contain';
    if (this.options.fit === 'contain') {
      style.width = style.height = '100%';
    } else {
      style.width = (this.options.width ?? width) + 'px';
      style.height = (this.options.height ?? height) + 'px';
      style.maxWidth = '100%';
    }
    this.options.domRoot.appendChild(canvas);
    // The blank start.
    replay.plan(0);
    replay.advance(Infinity);
    replay.present();
    this.options.onLoad?.({ width, height, duration: this.duration });
    if (this.options.autoplay) {
      this.play();
    } else {
      this.emitTime();
    }
  }

  get duration(): number {
    return durationOf(this.times);
  }

  get currentTime(): number {
    return this.playhead;
  }

  get isPlaying(): boolean {
    return this.playing;
  }

  /** A seek is still on its way: the canvas keeps the frame from before it
   * until the target is drawn (an onTimeUpdate follows then). */
  get seeking(): boolean {
    return this.seekTarget !== null;
  }

  get timeInfo(): PlayerTimeInfo {
    const duration = this.duration;
    return {
      currentTime: this.playhead,
      duration,
      isPlaying: this.playing,
      progress: duration > 0 ? Math.min(1, this.playhead / duration) : 1,
      seeking: this.seekTarget !== null,
    };
  }

  private emitTime(): void {
    this.options.onTimeUpdate?.(this.timeInfo);
  }

  play(): void {
    if (!this.replay || this.playing || this.destroyed) {
      return;
    }
    if (this.playhead >= this.duration && this.seekTarget === null) {
      this.seek(0);
    }
    this.playing = true;
    this.lastFrame = performance.now();
    this.emitTime();
    if (!this.raf) {
      this.raf = requestAnimationFrame(this.frame);
    }
  }

  pause(): void {
    const was = this.playing;
    this.playing = false;
    if (was) {
      this.emitTime();
    }
  }

  setSpeed(speed: number): void {
    if (speed > 0 && Number.isFinite(speed)) {
      this.speed = speed;
    }
  }

  /** Jump to a playback position (ms). */
  seek(ms: number): void {
    const replay = this.replay;
    if (!replay) {
      return;
    }
    this.playhead = Math.max(0, Math.min(this.duration, Number.isFinite(ms) ? ms : ms > 0 ? Infinity : 0));
    this.seekTarget = this.playhead;
    replay.plan(cursorAt(this.times, this.playhead));
    if (!this.slicePending) {
      this.seekSlice();
    }
    if (this.seekTarget !== null) {
      // still on its way: tell the host (it lands with another update)
      this.emitTime();
    }
  }

  /** Replays one slice toward the seek target; lands it or schedules the next. */
  private seekSlice(): void {
    const replay = this.replay;
    if (!replay || this.seekTarget === null || this.destroyed) {
      return;
    }
    if (!replay.advance(SEEK_SLICE_MS)) {
      this.slicePending = true;
      const gen = this.seekGen;
      nextTask(() => {
        if (gen === this.seekGen) {
          this.slicePending = false;
          this.seekSlice();
        }
      });
      return;
    }
    this.seekTarget = null;
    replay.present();
    // playing on from here: no catch-up for the time the seek took
    this.lastFrame = performance.now();
    this.emitTime();
  }

  private frame = (now: number): void => {
    this.raf = 0;
    const replay = this.replay;
    if (!this.playing || !replay || this.destroyed) {
      return;
    }
    if (this.seekTarget !== null) {
      // a seek is landing; playing resumes from it
      this.raf = requestAnimationFrame(this.frame);
      return;
    }
    const elapsed = Math.max(0, Math.min(250, now - this.lastFrame));
    this.lastFrame = now;
    const duration = this.duration;
    this.playhead = Math.min(duration, this.playhead + elapsed * this.speed);
    replay.plan(cursorAt(this.times, this.playhead));
    const reached = replay.advance(FRAME_BUDGET_MS);
    if (!reached && replay.rewound) {
      // an undo sent the drawing back to before the last keyframe: catch up
      // like a seek, the last frame kept
      this.seekTarget = this.playhead;
      this.seekSlice();
      this.emitTime();
      this.raf = requestAnimationFrame(this.frame);
      return;
    }
    replay.present();
    if (!reached) {
      // the replay can't keep up: slow down rather than skip
      this.playhead = timeOf(this.times, replay.cursor);
    }
    if (reached && this.playhead >= duration) {
      this.playing = false;
      this.emitTime();
      this.options.onEnd?.();
      return;
    }
    this.emitTime();
    this.raf = requestAnimationFrame(this.frame);
  };

  destroy(): void {
    this.destroyed = true;
    this.playing = false;
    this.seekGen++;
    this.seekTarget = null;
    if (this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
    this.canvas?.remove();
    this.replay?.dispose();
    this.replay = null;
  }
}

declare global {
  interface Window {
    Lascaux2Player: typeof Lascaux2Player;
  }
}

if (typeof window !== 'undefined') {
  window.Lascaux2Player = Lascaux2Player;
}
