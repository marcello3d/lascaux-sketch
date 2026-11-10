import Dexie from 'dexie';
import {
  getExportedDrawingGzipped,
  importGzippedDrawing,
} from '../library/serialize';
import { LascauxDomInstance } from '../lascaux/Drawlet';
import { useState } from 'react';
import { newId } from '../db/fields';
import { db } from '../db/db';
import { discardDrawing, setStoredStrokes } from '../db/save-state';

export async function tryUpload(
  lascaux: LascauxDomInstance,
  drawingId: string,
  uploadUrl: string,
) {
  const [png, jsonGz] = await Promise.all([
    lascaux.getPng(),
    getExportedDrawingGzipped(drawingId),
  ]);
  const formData = new FormData();
  formData.append('png', png);
  formData.append('json_gz', jsonGz);

  const result = await fetch(uploadUrl, { method: 'POST', body: formData });
  if (!result.ok) {
    throw new Error('upload error');
  }
  const json = await result.json();
  if (json?.ok !== true || json?.error) {
    throw new Error(json?.error ?? 'unknown error');
  }
}

export async function download(
  drawingId: string,
  jsonGzUrl: string,
): Promise<void> {
  // Download json.gz
  const res = await fetch(jsonGzUrl);
  const data = await res.arrayBuffer();
  // Import into database
  await importGzippedDrawing(drawingId, new Uint8Array(data));
}

/** A 2draw draft's drawing id: the editor keeps it under the draft key. */
const DRAFT_PREFIX = '2draw-draft-';
export const draftDrawingId = (draftKey: string) => DRAFT_PREFIX + draftKey;
export const isDraftDrawingId = (id: string) => id.startsWith(DRAFT_PREFIX);

async function strokeKeys(drawingId: string) {
  return (await db.strokes
    .where('[drawingId+index]')
    .between([drawingId, Dexie.minKey], [drawingId, Dexie.maxKey])
    .primaryKeys()) as unknown as [string, number][];
}

export type LoadInfo = {
  /** The drawing was already on this device (a draft opened again). */
  restored: boolean;
  /** Its strokes when the editor opens it. */
  strokes: number;
};

/**
 * A draft's drawing: what this device has under its id, else the
 * drawing's json.gz (a revision) or nothing. A copy with a gap in its
 * strokes (a write lost) keeps the strokes before the gap.
 */
async function prepareDraft(
  drawingId: string,
  jsonGzUrl: string | undefined,
): Promise<LoadInfo> {
  const existing = await db.drawings.get(drawingId);
  if (existing) {
    const keys = await strokeKeys(drawingId);
    let n = 0;
    while (n < keys.length && keys[n][1] === n) {
      n++;
    }
    if (n < keys.length) {
      console.warn(
        `lascaux: strokes ${n}.. of this drawing are not in order; keeping 0..${n - 1}`,
      );
      await db.strokes.bulkDelete(keys.slice(n) as any);
    }
    if (n > 0) {
      return { restored: true, strokes: n };
    }
    await discardDrawing(drawingId);
  }
  if (jsonGzUrl) {
    await download(drawingId, jsonGzUrl);
    return { restored: false, strokes: (await strokeKeys(drawingId)).length };
  }
  return { restored: false, strokes: 0 };
}

type Load = { done: boolean; promise: Promise<unknown>; info: LoadInfo };
const loads = new Map<string, Load>();

/**
 * The drawing the editor (or player) opens, loading it first (Suspense: it
 * throws until then). With a draft key the drawing is kept under the
 * draft's id, and opening the draft again brings it back; without one it
 * gets a new random id.
 */
export function useLoadDrawing(
  jsonGzUrl: string | undefined,
  onDownloadFailure: ((error: Error) => void) | undefined,
  draftKey?: string,
): { drawingId: string } & LoadInfo {
  const [drawingId] = useState(() =>
    draftKey ? draftDrawingId(draftKey) : newId(),
  );
  let load = loads.get(drawingId);
  if (!load) {
    const entry: Load = {
      done: false,
      promise: Promise.resolve(),
      info: { restored: false, strokes: 0 },
    };
    const work: Promise<LoadInfo> = draftKey
      ? prepareDraft(drawingId, jsonGzUrl)
      : jsonGzUrl
      ? download(drawingId, jsonGzUrl).then(() => ({
          restored: false,
          strokes: 0,
        }))
      : Promise.resolve({ restored: false, strokes: 0 });
    entry.promise = work.then(
      (info) => {
        entry.info = info;
        setStoredStrokes(drawingId, info.strokes);
        entry.done = true;
      },
      (error) => {
        onDownloadFailure?.(error);
        // stays loading: an empty editor would replace the drawing with nothing
        entry.promise = new Promise(() => {});
      },
    );
    loads.set(drawingId, entry);
    load = entry;
  }
  if (!load.done) {
    throw load.promise;
  }
  return { drawingId, ...load.info };
}
