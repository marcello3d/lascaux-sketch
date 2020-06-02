import 'dexie-observable';
import Dexie, { Table } from 'dexie';
import { Dna } from '../drawlets/drawos/dna';

export type DbDrawing = {
  id: string;
  createdAt: string;
  dna: Dna;
};
export type DbStroke = {
  id: number;
  drawingId: string;
};

class Db extends Dexie {
  drawings: Table<DbDrawing, string>;
  strokes: Table<DbStroke, number>;

  constructor() {
    super('buckwheat3');
    this.version(3).stores({
      drawings: 'id,createdAt',
      strokes: '++id,drawingId',
    });
    this.drawings = this.table('drawings');
    this.strokes = this.table('strokes');
    this.open().catch((err) => {
      console.error('Failed to open db', err);
    });
  }
}

export const db = new Db();
