import {
  EVENT_TYPE_KEY,
  FIELDS_KEY,
  DELTA_FIELDS_KEY,
  TIME_KEY,
  DELTA_TIME_KEY,
  PAYLOAD_KEY,
} from './constants';

/**
 * Take a
 */
export class UnpackEventStream {
  constructor(consume) {
    this._consume = consume;
    this._fields = null;
    this._lastEventType = null;
    this._lastValues = null;
    this._fieldDelta = false;
    this._time = 0;
  }

  supply(rawEvent) {
    if (rawEvent instanceof Float32Array || rawEvent instanceof Float64Array) {
      if (this._fields === null) {
        throw new Error('unexpected Float array after object');
      }
      this._time += rawEvent[0];
      const values = {};
      const lastValues = this._fieldDelta && this._lastValues;
      this._fields.forEach((field, index) => {
        const value = rawEvent[index + 1];
        if (lastValues) {
          values[field] = lastValues[field] + value;
        } else {
          values[field] = value;
        }
      });
      if (this._fieldDelta) {
        this._lastValues = values;
      }
      const event = {
        type: this._lastEventType,
        time: this._time,
        payload: values,
      };
      this._consume(event);
    } else if (typeof rawEvent === 'object') {
      const deltaFields = DELTA_FIELDS_KEY in rawEvent;
      const fields = FIELDS_KEY in rawEvent;
      if (fields && deltaFields) {
        throw new Error('Found both fields and delta fields');
      }
      this._lastValues = null;
      if (DELTA_TIME_KEY in rawEvent) {
        this._time += rawEvent[DELTA_TIME_KEY];
      } else if (TIME_KEY in rawEvent) {
        this._time = rawEvent[TIME_KEY];
      }
      const type = rawEvent[EVENT_TYPE_KEY];
      if (fields || deltaFields) {
        this._lastEventType = type;
        this._fields = rawEvent[DELTA_FIELDS_KEY];
        this._fieldDelta = deltaFields;
      } else {
        this._fields = null;
        const obj = {
          type,
          time: this._time,
        };
        if (PAYLOAD_KEY in rawEvent) {
          obj.payload = rawEvent[PAYLOAD_KEY];
        }
        this._consume(obj);
      }
    } else {
      throw new Error(`unknown event type: ${typeof rawEvent}`);
    }
  }
}

export function mapRawEvents(rawEvents) {
  const events = [];
  const stream = new UnpackEventStream((event) => events.push(event));
  rawEvents.forEach((event) => stream.supply(event));
  return events;
}
