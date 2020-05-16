import {
  EVENT_TYPE_KEY,
  FIELDS_KEY,
  DELTA_FIELDS_KEY,
  TIME_KEY,
  // DELTA_TIME_KEY,
  PAYLOAD_KEY,
} from './constants';

/**
 * Take a
 */
export class PackEventStream<T extends object> {
  _fields: string[] | undefined;
  _lastType: string | undefined;
  _lastValues: Float32Array | undefined;
  constructor(
    private _consume: (t: T) => void,
    private _possibleFields: (keyof T)[] = [],
    private _deltaFields = true,
  ) {}

  supply(eventType: string, time: number | null | undefined, payload: object) {
    const object: any = {};
    object[EVENT_TYPE_KEY] = eventType;
    if (time !== null && time !== undefined) {
      object[TIME_KEY] = time;
    }
    const fields = [];
    if (typeof payload === 'object') {
      for (const field of this._possibleFields) {
        if (field in payload) {
          fields.push(field);
        }
      }
    }
    if (fields.length > 0 && fields.length === Object.keys(payload).length) {
      if (
        eventType !== this._lastType ||
        String(fields) !== String(this._fields)
      ) {
        object[this._deltaFields ? DELTA_FIELDS_KEY : FIELDS_KEY] = fields;
        this._lastValues = new Float32Array(fields.length + 1);
        this._lastValues[0] = time;
        this._fields = fields;
        this._consume(object);
      }
      const priorFields = this._fields;
      const length = priorFields.length;
      const values = new Float32Array(length + 1);
      const deltaMode = this._deltaFields;
      const lastValues = this._lastValues;
      if (deltaMode) {
        values[0] = time - lastValues[0];
        lastValues[0] = time;
      } else {
        values[0] = time;
      }

      for (let i = 0; i <= length; ) {
        const value = payload[priorFields[i]];
        i++;
        if (deltaMode) {
          values[i] = value - lastValues[i];
          lastValues[i] = value;
        } else {
          values[i] = value;
        }
      }
      this._consume(values);
    } else {
      if (payload !== null && payload !== undefined) {
        object[PAYLOAD_KEY] = payload;
      }
      this._consume(object);
    }
    this._lastType = eventType;
  }
}
