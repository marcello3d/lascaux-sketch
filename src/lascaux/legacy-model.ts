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
import { Draft } from 'immer';
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

export function isLegacyEvent(event: string) {
  return event === LEGACY_ADD_LAYER_EVENT || isLegacyModeEvent(event);
}
export function handleLegacyEvent(
  draft: Draft<DrawingDoc>,
  user: Id,
  event: string,
  payload: any,
): void {
  if (event === LEGACY_ADD_LAYER_EVENT) {
    const layerId = String(draft.artboard.rootLayers.length);
    addLayer(draft.artboard, layerId);
    draft.users[user].layer = layerId;
  } else if (isLegacyModeEvent(event)) {
    handleLegacyModeEvent(draft, user, event, payload);
  }
}

function handleLegacyModeEvent(
  draft: Draft<DrawingDoc>,
  user: string,
  eventType: string,
  eventPayload: any,
): void {
  const mode = draft.users[user];
  const normalized = getNormalizedModePayload(eventType, eventPayload);
  const brush = mode.brushes[mode.brush];
  for (const modeName of Object.keys(normalized)) {
    const payload = normalized[modeName];
    switch (modeName) {
      case LEGACY_LAYER_MODE:
        draft.users[user].layer = String(payload);
        break;

      case LEGACY_CURSOR_MODE:
        draft.users[user].cursor = payload;
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
        draft.users[user].color[3] = payload;
        break;

      case LEGACY_SPACING_MODE:
        brush.spacing = payload;
        break;

      case LEGACY_HARDNESS_MODE:
        brush.hardness = payload;
        break;
    }
  }
}
