import { selector } from 'recoil';
import { db } from './db';

export const localDrawings = selector({
  key: 'LocalDrawings',
  get: ({ get }) => db.drawings.toArray(),
});
