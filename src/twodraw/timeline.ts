/**
 * The animation's clock: when, in the drawing's own time, each recorded
 * stroke event happens. Pure (no DOM), so it can be tested on its own.
 *
 * Pointer events (start/draw/end, and the %cursor event that comes with a
 * start) carry the browser's event.timeStamp — milliseconds since that page
 * loaded, so each session starts over near zero — while the editor's own
 * events (!mode, !art, !goto) carry Date.now(). Only the pointer events'
 * times are used, each against the previous pointer event: a gap that goes
 * backwards (a new session) counts as nothing, and pauses are shortened to
 * maxIdle ms, as in the other 2draw players. Everything else happens in no
 * time, at the moment of the pointer event before it.
 */

export const MAX_IDLE = 500;

const POINTER_EVENTS: Record<string, true> = {
  start: true,
  draw: true,
  end: true,
  '%cursor': true,
};

/** times[i]: the playhead time (ms) at which stroke event i is drawn. */
export function buildTimes(
  strokes: readonly { type: string; time: number }[],
  maxIdle: number = MAX_IDLE,
): Float64Array {
  const times = new Float64Array(strokes.length);
  let now = 0;
  let last: number | null = null;
  for (let i = 0; i < strokes.length; i++) {
    const { type, time } = strokes[i];
    if (POINTER_EVENTS[type] === true && typeof time === 'number' && Number.isFinite(time)) {
      if (last !== null) {
        now += Math.max(0, Math.min(time - last, maxIdle));
      }
      last = time;
    }
    times[i] = now;
  }
  return times;
}

/** The animation's length (ms). */
export function durationOf(times: Float64Array): number {
  return times.length > 0 ? times[times.length - 1] : 0;
}

/**
 * How many stroke events have been drawn at playhead time `t`: none at the
 * start (a blank canvas), all of them at the end, else every event whose
 * time has come.
 */
export function cursorAt(times: Float64Array, t: number): number {
  const n = times.length;
  if (t >= durationOf(times)) {
    return n;
  }
  if (!(t > 0)) {
    return 0;
  }
  let lo = 0;
  let hi = n;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (times[mid] <= t) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  return lo;
}

/** The playhead time at which `cursor` events have been drawn. */
export function timeOf(times: Float64Array, cursor: number): number {
  return cursor <= 0 ? 0 : times[Math.min(cursor, times.length) - 1];
}
