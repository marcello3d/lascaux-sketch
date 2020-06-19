// File-level events (don't advance cursor)
export const METADATA_EVENT_TYPE = '+metadata';
export const HEADER_EVENT = '+header';

// Special events (advance cursor but cannot goto them)
export const GOTO_EVENT = '!goto';
export const MODE_EVENT = '%';
export const MODE_EVENT_REGEX = /^%(.*)$/;
// This is just a normal mode event, but pulling it out as an example
export const CURSOR_EVENT = '%cursor';

// Normal events
export const ADD_LAYER_EVENT = 'add-layer';
export const DRAW_START_EVENT = 'start';
export const DRAW_EVENT = 'draw';
export const DRAW_END_EVENT = 'end';

export function isModeEvent(eventType: string) {
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
