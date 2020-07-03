import { DrawingDoc, Id, ROOT_USER } from './DrawingDoc';
import { newId } from '../db/fields';
import { Draft } from 'immer';

export function addLayer(
  draft: Draft<DrawingDoc>,
  user: Id = ROOT_USER,
  id: string = newId(),
) {
  draft.artboard.layers[id] = {
    type: 'image',
    name: `Layer #${Object.keys(draft.artboard.layers).length + 1}`,
  };
  draft.artboard.rootLayers.push(id);
  draft.users[user].layer = id;
}
