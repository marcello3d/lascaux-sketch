import { Artboard, UserMode } from './DrawingDoc';
import produce, { Draft } from 'immer';

export function addLayer(draft: Draft<Artboard>, id: string) {
  draft.layers[id] = {
    type: 'image',
    name: `Layer #${Object.keys(draft.layers).length + 1}`,
  };
  draft.rootLayers.push(id);
}

export function safeMode(artboard: Artboard, mode: UserMode): UserMode {
  if (mode.layer in artboard.layers) {
    return mode;
  }
  return produce(mode, (draft) => {
    draft.layer = artboard.rootLayers[0];
  });
}
