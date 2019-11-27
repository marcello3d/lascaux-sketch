import { Data, FlushValues, Inflate } from 'pako';

import { Decoder } from 'msgpack-lite';

export class BytesToPackedEventStream {
  _decoder: Decoder;

  constructor({
    onEvent,
    onEnd,
    onError,
  }: {
    onEvent: (event: object) => void;
    onEnd: () => void;
    onError: (error: Error) => void;
  }) {
    this._decoder = new Decoder();
    this._decoder.on('data', onEvent);
    this._decoder.on('end', onEnd);
    this._decoder.on('error', onError);
  }

  supply(bytes: any) {
    this._decoder.decode(bytes);
  }

  end() {
    this._decoder.end();
  }
}

export class DeflatedToPackedEventStream {
  _inflate: Inflate;
  _decoder: Decoder;
  _onError: (error: Error) => void;

  constructor({
    onEvent,
    onEnd,
    onError,
  }: {
    onEvent: (event: object) => void;
    onEnd: () => void;
    onError: (error: Error) => void;
    flush: boolean;
  }) {
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

  supply(bytes: Data | ArrayBuffer) {
    this._inflate.push(bytes, FlushValues.Z_SYNC_FLUSH);
    this._checkError();
  }

  end() {
    this._inflate.push(new Uint8Array([]), FlushValues.Z_FINISH);
    this._checkError();
    this._decoder.end();
  }

  _checkError() {
    if (this._inflate.err) {
      this._onError(new Error(`inflate error ${this._inflate.err}`));
    }
  }
}
