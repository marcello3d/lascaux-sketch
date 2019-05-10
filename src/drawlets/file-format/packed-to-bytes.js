import { Deflate, Z_NO_FLUSH, Z_SYNC_FLUSH, Z_FINISH } from 'pako';

import { Encoder } from 'msgpack-lite/lib/encoder';

export class PackedEventToBytesStream {
  constructor({ onData, onEnd, onError }) {
    this._decoder = new Encoder();
    this._decoder.on('data', onData);
    this._decoder.on('end', onEnd);
    this._decoder.on('error', onError);
  }

  supply(rawEvent) {
    this._decoder.encode(rawEvent);
  }

  end() {
    this._decoder.end();
  }
}

export class PackedEventToDeflatedStream {
  constructor({ onData, onEnd, onError, flush }) {
    this._decoder = new Encoder();

    const deflate = new Deflate({
      level: 9,
      raw: true,
      gzip: false,
    });
    deflate.onData = onData;

    this._decoder.on('error', onError);
    this._decoder.on('data', (bytes) => {
      deflate.push(bytes, flush ? Z_SYNC_FLUSH : Z_NO_FLUSH);
      if (deflate.err) {
        onError(new Error(deflate.err));
      }
    });
    this._decoder.on('end', () => {
      deflate.onEnd = onEnd;
      deflate.push(new Uint8Array([]), Z_FINISH);
    });
  }

  supply(rawEvent) {
    this._decoder.encode(rawEvent);
  }

  end() {
    this._decoder.end();
  }
}
