import { DrawingDoc, Id, ROOT_USER } from './DrawingDoc';
import { newId } from '../db/fields';
import { produce } from 'immer';

export function addLayer(
  doc: DrawingDoc,
  user: Id = ROOT_USER,
  id: string = newId(),
) {
  return produce(doc, (state) => {
    state.artboard.layers[id] = {
      type: 'image',
      opacity: 1,
      x: 0,
      y: 0,
    };
    state.users[user].layer = id;
  });
}
