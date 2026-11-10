/**
 * The editor's strokes are its own autosave: each one is written to
 * IndexedDB (db.strokes) as it is drawn. This module writes them for
 * DexieStorageModel and keeps track of how that is going, so the page
 * around the 2draw.net editor can say "Saved on this device" or "Not
 * saved" (oekaki/LascauxStandalone.tsx onDraft):
 *
 * - a write that fails is kept and tried again every 5 seconds (and on
 *   flush()), so a full disk that frees up loses nothing;
 * - flush() resolves once every stroke drawn so far is stored (or has
 *   failed again);
 * - discardDrawing() deletes a drawing's rows; cleanupDrawings() deletes
 *   old ones (the 2draw editor used to open a new random id each time, so
 *   those can never be opened again).
 */
import Dexie from 'dexie';
import { db, DbStroke } from './db';
import { newDate } from './fields';

export type SaveState = {
  /** A stroke drawn but not stored yet. */
  pending: boolean;
  /** A write failed and has not worked since. */
  failed: boolean;
  /** When the last stroke was stored (ms), 0 for none this session. */
  savedAt: number;
  /** Strokes of this drawing stored or on their way (the next stroke's index). */
  strokes: number;
};

type Tracker = {
  inFlight: number;
  failedQueue: DbStroke[];
  savedAt: number;
  strokes: number;
  listeners: Set<(state: SaveState) => void>;
  idle: (() => void)[];
  retryTimer?: ReturnType<typeof setTimeout>;
  notifyTimer?: ReturnType<typeof setTimeout>;
  lastNotified?: string;
  savedAtWritten: number;
};

const RETRY_MS = 5000;
/** How often the drawing row's savedAt (for expiry) is brought up to date. */
const SAVED_AT_EVERY_MS = 60 * 1000;

const trackers = new Map<string, Tracker>();

function trackerFor(drawingId: string): Tracker {
  let t = trackers.get(drawingId);
  if (!t) {
    t = {
      inFlight: 0,
      failedQueue: [],
      savedAt: 0,
      strokes: 0,
      listeners: new Set(),
      idle: [],
      savedAtWritten: 0,
    };
    trackers.set(drawingId, t);
  }
  return t;
}

function stateOf(t: Tracker): SaveState {
  return {
    pending: t.inFlight > 0 || t.failedQueue.length > 0,
    failed: t.failedQueue.length > 0,
    savedAt: t.savedAt,
    strokes: t.strokes,
  };
}

function notify(drawingId: string, t: Tracker, now = false) {
  const send = () => {
    t.notifyTimer = undefined;
    const state = stateOf(t);
    for (const listener of t.listeners) {
      try {
        listener(state);
      } catch (e) {
        console.error('lascaux: save listener failed', e);
      }
    }
  };
  // pending/failed changes go out at once, the rest at most twice a second
  const key = `${t.inFlight > 0 || t.failedQueue.length > 0}/${t.failedQueue.length > 0}`;
  if (now || key !== t.lastNotified) {
    t.lastNotified = key;
    if (t.notifyTimer) {
      clearTimeout(t.notifyTimer);
    }
    send();
  } else if (!t.notifyTimer) {
    t.notifyTimer = setTimeout(send, 500);
  }
}

function settle(drawingId: string, t: Tracker) {
  if (t.inFlight === 0) {
    const idle = t.idle;
    t.idle = [];
    idle.forEach((resolve) => resolve());
  }
  notify(drawingId, t);
}

function stored(drawingId: string, t: Tracker) {
  t.savedAt = Date.now();
  if (t.savedAt - t.savedAtWritten > SAVED_AT_EVERY_MS) {
    t.savedAtWritten = t.savedAt;
    db.drawings.update(drawingId, { savedAt: newDate() }).catch(() => {});
  }
}

function scheduleRetry(drawingId: string, t: Tracker) {
  if (!t.retryTimer) {
    t.retryTimer = setTimeout(() => {
      t.retryTimer = undefined;
      retry(drawingId, t);
    }, RETRY_MS);
  }
}

function retry(drawingId: string, t: Tracker): Promise<void> {
  if (t.failedQueue.length === 0) {
    return Promise.resolve();
  }
  const batch = t.failedQueue;
  t.failedQueue = [];
  t.inFlight++;
  return db.strokes.bulkPut(batch).then(
    () => {
      t.inFlight--;
      stored(drawingId, t);
      settle(drawingId, t);
    },
    (error) => {
      console.warn('lascaux: strokes still not stored', error);
      t.inFlight--;
      t.failedQueue = batch.concat(t.failedQueue);
      scheduleRetry(drawingId, t);
      settle(drawingId, t);
    },
  );
}

/** Store one stroke (DexieStorageModel.addStroke). */
export function writeStroke(stroke: DbStroke): void {
  const { drawingId } = stroke;
  const t = trackerFor(drawingId);
  t.strokes = Math.max(t.strokes, stroke.index + 1);
  if (t.failedQueue.length > 0) {
    // keep them in order behind the ones that failed
    t.failedQueue.push(stroke);
    settle(drawingId, t);
    return;
  }
  t.inFlight++;
  let request;
  try {
    request = db.strokes.put(stroke);
  } catch (error) {
    request = Promise.reject(error);
  }
  Promise.resolve(request).then(
    () => {
      t.inFlight--;
      stored(drawingId, t);
      settle(drawingId, t);
    },
    (error) => {
      console.warn('lascaux: stroke not stored', error);
      t.inFlight--;
      t.failedQueue.push(stroke);
      t.failedQueue.sort((a, b) => a.index - b.index);
      scheduleRetry(drawingId, t);
      settle(drawingId, t);
    },
  );
  notify(drawingId, t);
}

/** The strokes the drawing already has when the editor opens it. */
export function setStoredStrokes(drawingId: string, strokes: number): void {
  const t = trackerFor(drawingId);
  t.strokes = Math.max(t.strokes, strokes);
}

export function getSaveState(drawingId: string): SaveState {
  return stateOf(trackerFor(drawingId));
}

/** Calls `listener` as the drawing's strokes get stored; returns the unsubscribe. */
export function onSaveState(
  drawingId: string,
  listener: (state: SaveState) => void,
): () => void {
  const t = trackerFor(drawingId);
  t.listeners.add(listener);
  return () => {
    t.listeners.delete(listener);
  };
}

/**
 * Resolves once every stroke drawn so far is stored, trying the failed
 * ones again first. Resolves (does not reject) when they fail again: see
 * getSaveState().failed.
 */
export async function flush(drawingId: string): Promise<void> {
  const t = trackerFor(drawingId);
  if (t.failedQueue.length > 0) {
    if (t.retryTimer) {
      clearTimeout(t.retryTimer);
      t.retryTimer = undefined;
    }
    await retry(drawingId, t);
  }
  if (t.inFlight > 0) {
    await new Promise<void>((resolve) => t.idle.push(resolve));
  }
  notify(drawingId, t, true);
}

/** Deletes a drawing: its row, strokes and thumbnail. */
export async function discardDrawing(drawingId: string): Promise<void> {
  await db.transaction('rw', db.drawings, db.strokes, db.thumbnails, async () => {
    await db.drawings.delete(drawingId);
    await db.thumbnails.delete(drawingId);
    await db.strokes
      .where('[drawingId+index]')
      .between([drawingId, Dexie.minKey], [drawingId, Dexie.maxKey])
      .delete();
  });
}

const DAY = 24 * 3600 * 1000;

/**
 * Deletes the drawings no one will open again: a draft's 30 days after its
 * last stroke, any other (a random id, from before drafts or a player) a
 * day after it was made. Never `keepId`.
 */
export async function cleanupDrawings(
  keepId: string,
  isDraftId: (id: string) => boolean,
): Promise<void> {
  const now = Date.now();
  const drawings = await db.drawings.toArray();
  for (const drawing of drawings) {
    if (drawing.id === keepId) {
      continue;
    }
    const at = Date.parse(drawing.savedAt ?? drawing.createdAt);
    const maxAge = isDraftId(drawing.id) ? 30 * DAY : DAY;
    if (!(now - at < maxAge)) {
      await discardDrawing(drawing.id);
    }
  }
}
