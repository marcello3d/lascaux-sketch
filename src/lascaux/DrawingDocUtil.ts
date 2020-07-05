import { Artboard } from './DrawingDoc';
import { Draft } from 'immer';

export function addLayer(draft: Draft<Artboard>, id: string) {
  draft.layers[id] = {
    type: 'image',
    name: `Layer #${Object.keys(draft.layers).length + 1}`,
  };
  draft.rootLayers.push(id);
}
