import {
  getNormalizedModePayload,
  isLegacyModeEvent,
  LEGACY_ADD_LAYER_EVENT,
  LEGACY_ALPHA_MODE,
  LEGACY_COLOR_MODE,
  LEGACY_CURSOR_MODE,
  LEGACY_ERASE_MODE,
  LEGACY_HARDNESS_MODE,
  LEGACY_LAYER_MODE,
  LEGACY_SIZE_MODE,
  LEGACY_SPACING_MODE,
} from './data-model/events';
import { addLayer } from './DrawingDocUtil';
import { produce } from 'immer';
import parseColor from './util/parse-color';
import { Dna, DrawingDoc, Id } from './DrawingDoc';

export type LegacyDna = Dna & {
  randomseed: string;
  colors: string[];
};
export function isLegacyDna(dna: Dna): dna is LegacyDna {
  return 'colors' in (dna as LegacyDna);
}

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
  if (event === LEGACY_ADD_LAYER_EVENT) {
    return produce(doc, (state) =>
      addLayer(state, user, String(state.artboard.rootLayers.length)),
    );
  }
  if (isLegacyModeEvent(event)) {
    return handleLegacyModeEvent(doc, user, event, payload);
  }
  return undefined;
}

function handleLegacyModeEvent(
  doc: DrawingDoc,
  user: string,
  eventType: string,
  eventPayload: any,
): DrawingDoc {
  return produce(doc, (state) => {
    const mode = state.users[user];
    const normalized = getNormalizedModePayload(eventType, eventPayload);
    const brush = mode.brushes[mode.brush];
    for (const modeName of Object.keys(normalized)) {
      const payload = normalized[modeName];
      switch (modeName) {
        case LEGACY_LAYER_MODE:
          state.users[user].layer = String(payload);
          break;

        case LEGACY_CURSOR_MODE:
          state.users[user].cursor = payload;
          break;

        case LEGACY_COLOR_MODE:
          const alpha = mode.color[3];
          mode.color = parseColor(payload);
          mode.color[3] = alpha;
          break;

        case LEGACY_ERASE_MODE:
          brush.mode = payload ? 'erase' : 'paint';
          break;

        case LEGACY_SIZE_MODE:
          brush.size = payload;
          break;

        case LEGACY_ALPHA_MODE:
          state.users[user].color[3] = payload;
          break;

        case LEGACY_SPACING_MODE:
          brush.spacing = payload;
          break;

        case LEGACY_HARDNESS_MODE:
          brush.hardness = payload;
          break;
      }
    }
  });
}
