import 'dexie-observable';
import Dexie, { Table } from 'dexie';
import { Stroke } from '../lascaux/data-model/StorageModel';
import { LegacyDna } from '../lascaux/legacy-model';

export type DbDrawing = {
  id: string;
  name?: string;
  createdAt: string;
  dna: LegacyDna;
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
