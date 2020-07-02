import {
  DrawletCursorPayload,
  LEGACY_ADD_LAYER_EVENT,
  LEGACY_SET_ALPHA_EVENT,
  LEGACY_SET_COLOR_EVENT,
  LEGACY_SET_CURSOR_EVENT,
  LEGACY_SET_ERASE_EVENT,
  LEGACY_SET_HARDNESS_EVENT,
  LEGACY_SET_LAYER_EVENT,
  LEGACY_SET_SIZE_EVENT,
  LEGACY_SET_SPACING_EVENT,
} from './data-model/events';
import { addLayer } from './DrawingDocUtil';
import { produce } from 'immer';
import parseColor from './util/parse-color';
import { DrawingDoc, Id } from './DrawingDoc';

export type LegacyDna = {
  width: number;
  height: number;
  randomseed: string;
  colors: string[];
};

export type DrawingMode = {
  layer: number;
  cursor?: DrawletCursorPayload;
  color: string;
  erase: boolean;
  size: number;
  alpha: number;
  spacing: number;
  hardness: number;
};

export type DrawingState = {
  size: number;
  a: number;
  x: number;
  y: number;
};

export function makeInitialState(): DrawingState {
  return {
    x: 0,
    y: 0,
    a: 0,
    size: 0,
  };
}

export function handleLegacyEvent(
  doc: DrawingDoc,
  user: Id,
  event: string,
  payload: any,
): DrawingDoc | undefined {
  switch (event) {
    case LEGACY_ADD_LAYER_EVENT:
      // Legacy add layer logic
      return addLayer(doc, String(doc.artboard.rootLayers.length), user);

    case LEGACY_SET_LAYER_EVENT:
      return produce(doc, (state) => {
        state.users[user].layer = String(payload);
      });

    case LEGACY_SET_CURSOR_EVENT:
      return produce(doc, (state) => {
        state.users[user].cursor = payload;
      });

    case LEGACY_SET_COLOR_EVENT:
      return produce(doc, (state) => {
        const mode = state.users[user];
        const alpha = mode.color[3];
        mode.color = parseColor(payload);
        mode.color[3] = alpha;
      });

    case LEGACY_SET_ERASE_EVENT:
      return produce(doc, (state) => {
        const mode = state.users[user];
        mode.brushes[mode.brush].mode = payload ? 'erase' : 'paint';
      });

    case LEGACY_SET_SIZE_EVENT:
      return produce(doc, (state) => {
        const mode = state.users[user];
        mode.brushes[mode.brush].size = payload;
      });

    case LEGACY_SET_ALPHA_EVENT:
      return produce(doc, (state) => {
        state.users[user].color[3] = payload;
      });

    case LEGACY_SET_SPACING_EVENT:
      return produce(doc, (state) => {
        const mode = state.users[user];
        mode.brushes[mode.brush].spacing = payload;
      });

    case LEGACY_SET_HARDNESS_EVENT:
      return produce(doc, (state) => {
        const mode = state.users[user];
        mode.brushes[mode.brush].hardness = payload;
      });
  }
  return undefined;
}
