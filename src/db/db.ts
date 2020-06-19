import 'dexie-observable';
import Dexie, { Table } from 'dexie';
import { Stroke } from '../lascaux/data-model/StorageModel';
import { Dna } from '../lascaux/dna';

export type DbDrawing = {
  id: string;
  name?: string;
  createdAt: string;
  dna: Dna;
};
export type DbStroke = {
  drawingId: string;
  index: number;
} & Stroke;

class Db extends Dexie {
  drawings: Table<DbDrawing, string>;
  strokes: Table<DbStroke, number>;

  constructor() {
    super('buckwheat3');
    this.version(4).stores({
      drawings: 'id,createdAt',
      strokes: '[drawingId+index]',
    });
    this.drawings = this.table('drawings');
    this.strokes = this.table('strokes');
    this.open().catch((err) => {
      console.error('Failed to open db', err);
    });
  }
}

export const db = new Db();
