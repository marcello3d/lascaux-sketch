import { Deflate, FlushValues } from 'pako';

import { Encoder } from 'msgpack-lite';

export class PackedEventToBytesStream {
  _decoder = new Encoder();
  constructor({
    onData,
    onEnd,
    onError,
  }: {
    onData: (chunk: Uint8Array) => void;
    onEnd: () => void;
    onError: (error: Error) => void;
  }) {
    this._decoder.on('data', onData);
    this._decoder.on('end', onEnd);
    this._decoder.on('error', onError);
  }

  supply(rawEvent: object) {
    this._decoder.encode(rawEvent);
  }

  end() {
    this._decoder.end();
  }
}

export class PackedEventToDeflatedStream {
  _encoder = new Encoder();
  constructor({
    onData,
    onEnd,
    onError,
    flush = false,
  }: {
    onData: (chunk: Uint8Array) => void;
    onEnd: () => void;
    onError: (error: Error) => void;
    flush?: boolean;
  }) {
    const deflate = new Deflate({
      level: 9,
      raw: true,
      gzip: false,
    });
    deflate.onData = onData;

    this._encoder.on('error', onError);
    this._encoder.on('data', (bytes) => {
      deflate.push(
        bytes,
        flush ? FlushValues.Z_SYNC_FLUSH : FlushValues.Z_NO_FLUSH,
      );
      if (deflate.err) {
        onError(new Error(`Deflate error ${deflate.err}`));
      }
    });
    this._encoder.on('end', () => {
      deflate.onEnd = onEnd;
      deflate.push(new Uint8Array([]), FlushValues.Z_FINISH);
    });
  }

  supply(rawEvent: object) {
    this._encoder.encode(rawEvent);
  }

  end() {
    this._encoder.end();
  }
}
