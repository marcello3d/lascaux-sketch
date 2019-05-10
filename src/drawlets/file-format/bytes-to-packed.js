import { Inflate, Z_SYNC_FLUSH, Z_FINISH } from 'pako';

import { Decoder } from 'msgpack-lite/lib/decoder';

export class BytesToPackedEventStream {
  constructor({ onEvent, onEnd, onError }) {
    this._decoder = new Decoder();
    this._decoder.on('data', onEvent);
    this._decoder.on('end', onEnd);
    this._decoder.on('error', onError);
  }

  supply(bytes) {
    this._decoder.decode(bytes);
  }

  end() {
    this._decoder.end();
  }
}

export class DeflatedToPackedEventStream {
  constructor({ onEvent, onEnd, onError }) {
    this._inflate = new Inflate({ raw: true });
    this._onError = onError;
    this._decoder = new Decoder();

    this._inflate.onData = (bytes) => {
      this._decoder.decode(bytes);
    };
    this._inflate.onEnd = () => {
      // ignored
    };

    this._decoder.on('error', onError);
    this._decoder.on('data', onEvent);
    this._decoder.on('end', onEnd);
  }

  supply(bytes) {
    this._inflate.push(bytes, Z_SYNC_FLUSH);
    this._checkError();
  }

  end() {
    this._inflate.push(new Uint8Array([]), Z_FINISH);
    this._checkError();
    this._decoder.end();
  }

  _checkError() {
    if (this._inflate.err) {
      this._onError(new Error(this._inflate.err));
    }
  }
}

export function bytesToPackedEvents(strokeData) {
  const results = [];
  const stream = new DeflatedToPackedEventStream({
    onEvent(event) {
      results.push(event);
    },
    onError(error) {
      results.push(error);
    },
    onEnd() {
      results.push('end');
    },
    flush: false,
  });
  strokeData.forEach((data) => stream.supply(data));
  return results;
}
