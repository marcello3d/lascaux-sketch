import {} from 'msgpack-lite';

import {
  EVENT_TYPE_KEY,
  TIME_KEY,
  DELTA_TIME_KEY,
  FIELDS_KEY,
  DELTA_FIELDS_KEY,
  PAYLOAD_KEY,
} from './constants';

import {
  METADATA_EVENT_TYPE,
  DRAW_START_EVENT,
  DRAW_EVENT,
  DRAW_END_EVENT,
  CURSOR_EVENT,
} from './events';

const LEGACY_START = 'start';
const LEGACY_DRAG = 'drag';
const LEGACY_END = 'end';

const LEGACY_TIME_KEY = 0;
const LEGACY_COMMAND_KEY = 1;
const LEGACY_PAYLOAD_KEY = 2;

const DRAW_EVENT_FIELDS = ['x', 'y', 'force', 'altitude', 'azimuth'];

// const CURSOR_MOUSE = 'mouse'
const CURSOR_TOUCH = 'touch';
const CURSOR_STYLUS = 'stylus';

const DELTA_MODE = true;
const FLOAT_32_MODE = true;

function buildEvent({ type, time, payload, fields, delta }) {
  const structure = {};
  structure[EVENT_TYPE_KEY] = type;
  if (time !== undefined) {
    structure[DELTA_TIME_KEY] = time;
  }
  if (fields !== undefined) {
    structure[delta ? DELTA_FIELDS_KEY : FIELDS_KEY] = fields;
  }
  if (payload !== undefined) {
    structure[PAYLOAD_KEY] = payload;
  }
  return structure;
}

function getDrawEventFields(payload) {
  return DRAW_EVENT_FIELDS.filter((field) => field in payload);
}

function getCursor(payload) {
  const tilt = 'azimuth' in payload;
  const force = 'force' in payload;
  const cursor = { type: tilt ? CURSOR_STYLUS : CURSOR_TOUCH };
  if (force) {
    cursor.force = true;
    cursor.forceMax = 'forceMax' in payload ? payload.forceMax : 1;
  }
  if (tilt) {
    cursor.tilt = true;
  }
  return cursor;
}

function convertCursorEvent(legacyEvent) {
  return buildEvent({
    type: CURSOR_EVENT,
    time: legacyEvent[LEGACY_TIME_KEY],
    payload: getCursor(legacyEvent[LEGACY_PAYLOAD_KEY]),
  });
}

function getFloatArray(legacyEvent, event, lastFloatArray) {
  const time = legacyEvent[LEGACY_TIME_KEY];
  const payload = legacyEvent[LEGACY_PAYLOAD_KEY];
  const delta = DELTA_FIELDS_KEY in event;
  const hasDeltaValues = delta && lastFloatArray;
  const fieldNames = delta ? event[DELTA_FIELDS_KEY] : event[FIELDS_KEY];
  const FloatArray = FLOAT_32_MODE ? Float32Array : Float64Array;
  const floatArray = new FloatArray(fieldNames.length + 1); // + 1 for time field

  // Time is always a delta
  floatArray[0] = hasDeltaValues ? time - lastFloatArray[0] : 0;
  fieldNames.forEach((field, index) => {
    const absoluteValue = payload[field];
    floatArray[index + 1] = hasDeltaValues
      ? absoluteValue - lastFloatArray[index]
      : absoluteValue;
  });
  return floatArray;
}

const eventEqualsIgnoringTime = (event1, event2) =>
  event1 &&
  event2 &&
  JSON.stringify({ ...event1, [TIME_KEY]: null, [DELTA_TIME_KEY]: null }) ===
    JSON.stringify({ ...event2, [TIME_KEY]: null, [DELTA_TIME_KEY]: null });

export function convertEvent(
  legacyEvent,
  lastCursor,
  lastEvent,
  lastFloatArray,
) {
  const legacyCommandType = legacyEvent[LEGACY_COMMAND_KEY];
  const time = legacyEvent[LEGACY_TIME_KEY];
  const payload = legacyEvent[LEGACY_PAYLOAD_KEY];
  const isDrawStart = legacyCommandType === LEGACY_START;
  if (isDrawStart || legacyCommandType === LEGACY_DRAG) {
    const cursor = convertCursorEvent(legacyEvent);
    const isNewCursor = !eventEqualsIgnoringTime(cursor, lastCursor);
    const command = buildEvent({
      type: isDrawStart ? DRAW_START_EVENT : DRAW_EVENT,
      time,
      fields: getDrawEventFields(payload),
      delta: DELTA_MODE,
    });
    // Always send a new command if the cursor changed or we're starting a new drag
    const isNewCommand =
      isDrawStart ||
      isNewCursor ||
      !lastFloatArray ||
      !eventEqualsIgnoringTime(command, lastEvent);
    return {
      cursor: isNewCursor ? cursor : null,
      command: isNewCommand ? command : null,
      floatArray: getFloatArray(
        legacyEvent,
        command,
        isNewCommand ? null : lastFloatArray,
      ),
    };
  }
  if (legacyCommandType === LEGACY_END) {
    // TODO: check if values are different from lastCursor/lastEvent/lastFloatArray
    return {
      command: buildEvent({ type: DRAW_END_EVENT, time }),
    };
  }
  return {
    command: buildEvent({
      type: legacyCommandType,
      time,
      payload,
    }),
  };
}

export function convertMetadata(event) {
  return buildEvent({
    type: METADATA_EVENT_TYPE,
    payload: event,
  });
}

export class LegacyEventStream {
  constructor(consume) {
    this._consume = consume;
    this._lastCursor = null;
    this._lastCommand = null;
    this._lastFloatArray = null;
  }

  supplyArray(legacyEvents) {
    legacyEvents.forEach((legacyEvent) => this.supply(legacyEvent));
  }
  supply(legacyEvent) {
    const { cursor, command, floatArray } = convertEvent(
      legacyEvent,
      this._lastCursor,
      this._lastCommand,
      this._lastFloatArray,
    );
    if (cursor) {
      this._consume(cursor);
      this._lastCursor = cursor;
    }
    if (command) {
      this._consume(command);
      this._lastCommand = command;
    }
    if (floatArray) {
      this._consume(floatArray);
      this._lastFloatArray = floatArray;
    }
  }
}
export function convertEvents(legacyEvents) {
  const events = [];
  new LegacyEventStream((event) => events.push(event)).supplyArray(
    legacyEvents,
  );
  return events;
}

export function convertJson({ metadata, events: legacyEvents }) {
  const events = [];
  if (metadata) {
    events.push(convertMetadata(metadata));
  }
  new LegacyEventStream((event) => events.push(event)).supplyArray(
    legacyEvents,
  );
  return events;
}

export function checkValidJson(json) {
  if (!('events' in json)) {
    throw new Error('Invalid json: missing events key');
  }
  if (!Array.isArray(json.events)) {
    throw new Error('Invalid json: events not an array');
  }
  Object.keys(json).forEach((key) => {
    if (key !== 'events' && key !== 'metadata') {
      throw new Error(`Invalid json: unexpected key ${key}`);
    }
  });
}
