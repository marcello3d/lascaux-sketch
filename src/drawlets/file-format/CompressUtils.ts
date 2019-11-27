import { PackedEventToDeflatedStream } from './packed-to-bytes';
import { PackEventStream } from './unpacked-to-packed';
import { DeflatedToPackedEventStream } from './bytes-to-packed';
import { UnpackEventStream } from './packed-to-unpacked';
import { Callback } from './types';
import { Stroke } from './StorageModel';
import { Data } from 'pako';

export function strokesToBytes(
  strokes: Stroke[],
  callback: Callback<Uint8Array>,
) {
  const blobs: Uint8Array[] = [];
  const stream = new PackedEventToDeflatedStream({
    onData: (data) => {
      blobs.push(data);
    },
    onEnd: () => {
      let size = 0;
      for (const blob of blobs) {
        size += blob.length;
      }
      const array = new Uint8Array(size);
      let i = 0;
      for (const blob of blobs) {
        array.set(blob, i);
        i += blob.length;
      }
      callback(undefined, array);
    },
    onError: (error) => {
      callback(error);
    },
  });
  const mapper = new PackEventStream((event: object) => stream.supply(event), [
    'x',
    'y',
    'force',
    'radius',
    'altitude',
    'azimuth',
  ]);
  for (const { type, time, payload } of strokes) {
    mapper.supply(type, time, payload);
  }
  stream.end();
}
export function bytesToStrokes(blob: Uint8Array, callback: Callback<Stroke[]>) {
  const events: Stroke[] = [];
  const eventStream = new UnpackEventStream((event: Stroke) =>
    events.push(event),
  );
  const deflateStream = new DeflatedToPackedEventStream({
    onEvent(event) {
      eventStream.supply(event);
    },
    onError(error) {
      callback(error);
    },
    onEnd() {
      callback(null, events);
    },
    flush: false,
  });
  deflateStream.supply(blob);
  deflateStream.end();
  return events;
}
