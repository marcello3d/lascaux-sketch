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
import { Artboard, Dna, UserMode } from './DrawingDoc';

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
  artboard: Draft<Artboard>,
  mode: Draft<UserMode>,
  event: string,
  payload: any,
): void {
  if (event === LEGACY_ADD_LAYER_EVENT) {
    const layerId = String(artboard.rootLayers.length);
    addLayer(artboard, layerId);
    mode.layer = layerId;
  } else if (isLegacyModeEvent(event)) {
    handleLegacyModeEvent(mode, event, payload);
  }
}

function handleLegacyModeEvent(
  mode: Draft<UserMode>,
  eventType: string,
  eventPayload: any,
): void {
  const normalized = getNormalizedModePayload(eventType, eventPayload);
  const brush = mode.brushes[mode.brush];
  for (const modeName of Object.keys(normalized)) {
    const payload = normalized[modeName];
    switch (modeName) {
      case LEGACY_LAYER_MODE:
        mode.layer = String(payload);
        break;

      case LEGACY_CURSOR_MODE:
        mode.cursor = payload;
        break;

      case LEGACY_COLOR_MODE:
        mode.color = parseColor(payload);
        break;

      case LEGACY_ERASE_MODE:
        brush.mode = payload ? 'erase' : 'paint';
        break;

      case LEGACY_SIZE_MODE:
        brush.size = payload;
        break;

      case LEGACY_ALPHA_MODE:
        brush.flow = payload;
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
