import 'dexie-observable';
import Dexie, { Table } from 'dexie';

// dexie-observable marks this tab gone on 'beforeunload'. A beforeunload
// listener, even one that never asks, keeps the 2draw iOS app from letting a
// swipe back through (it counts them), so it listens to 'pagehide' instead.
{
  const observable = (Dexie as any).Observable;
  if (observable?._onBeforeUnload && typeof window !== 'undefined') {
    window.removeEventListener('beforeunload', observable._onBeforeUnload);
    window.addEventListener('pagehide', observable._onBeforeUnload);
  }
}
import { Stroke } from '../lascaux/data-model/StorageModel';
import { Dna } from '../lascaux/DrawingDoc';

export type DbDrawing = {
  id: string;
  name?: string;
  createdAt: string;
  /** When a stroke was last stored (roughly: updated once a minute), for expiry. */
  savedAt?: string;
  dna: Dna;
};

export type DbStroke = {
  drawingId: string;
  index: number;
} & Stroke;

export type DbThumbnail = {
  drawingId: string;
  updatedAt?: string;
  thumbnail: Blob;
};

class Db extends Dexie {
  drawings: Table<DbDrawing, string>;
  strokes: Table<DbStroke, [string, number]>;
  thumbnails: Table<DbThumbnail, string>;

  constructor() {
    super('buckwheat3');
    this.version(5).stores({
      drawings: 'id,createdAt',
      strokes: '[drawingId+index]',
      thumbnails: 'drawingId',
    });
    this.drawings = this.table('drawings');
    this.strokes = this.table('strokes');
    this.thumbnails = this.table('thumbnails');
    this.open().catch((err) => {
      console.error('Failed to open db', err);
    });
  }
}

export const db = new Db();
