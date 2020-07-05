// File-level events (don't advance cursor)
export const METADATA_EVENT_TYPE = '+metadata';
export const HEADER_EVENT = '+header';

// Special events (advance cursor but cannot goto them)
export const GOTO_EVENT = '!goto';
export const MODE_EVENT = '%';
export const MODE_EVENT_REGEX = /^%(.*)$/;
// This is just a normal mode event, but pulling it out as an example
export const CURSOR_EVENT = '%cursor';

export const PATCH_ARTBOARD_EVENT = '!art';
export const PATCH_MODE_EVENT = '!mode';

// Legacy events
export const LEGACY_ADD_LAYER_EVENT = 'add-layer';
export const LEGACY_LAYER_MODE = 'layer';
export const LEGACY_CURSOR_MODE = 'cursor';
export const LEGACY_COLOR_MODE = 'color';
export const LEGACY_ERASE_MODE = 'erase';
export const LEGACY_SIZE_MODE = 'size';
export const LEGACY_ALPHA_MODE = 'alpha';
export const LEGACY_SPACING_MODE = 'spacing';
export const LEGACY_HARDNESS_MODE = 'hardness';

// Normal events
export const DRAW_START_EVENT = 'start';
export const DRAW_EVENT = 'draw';
export const DRAW_END_EVENT = 'end';

export function isLegacyModeEvent(eventType: string) {
  return MODE_EVENT_REGEX.test(eventType);
}
export function isKeyframeEvent(eventType: string) {
  return eventType === DRAW_START_EVENT;
}
export function getNormalizedModePayload(eventType: string, payload: any) {
  if (eventType === MODE_EVENT) {
    return payload;
  }
  const field = MODE_EVENT_REGEX.exec(eventType)![1];
  return {
    [field]: payload,
  };
}

export type DrawEventType =
  | typeof DRAW_START_EVENT
  | typeof DRAW_EVENT
  | typeof DRAW_END_EVENT;
export type CursorType = 'touch' | 'mouse' | 'pen' | 'unknown';
export type DrawEventPayload = {
  x: number;
  y: number;
  pressure?: number;
  width?: number;
  height?: number;
  tiltX?: number;
  tiltY?: number;
};
export type DrawletCursorPayload = {
  type: CursorType;
  forceMax?: number;
  radiusError?: number;
  tilt?: boolean;
};
export type DrawletDrawEvent = [DrawEventType, number, DrawEventPayload];
export type DrawletCursorEvent = [
  typeof CURSOR_EVENT,
  number,
  DrawletCursorPayload,
];
export type DrawletEvent = DrawletDrawEvent | DrawletCursorEvent;
