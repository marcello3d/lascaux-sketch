import { PackedEventToDeflatedStream } from './packed-to-bytes';
import { PackEventStream } from './unpacked-to-packed';
import { DeflatedToPackedEventStream } from './bytes-to-packed';
import { UnpackEventStream } from './packed-to-unpacked';

export function strokesToBytes(strokes, callback) {
  const blobs = [];
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
      callback(null, array);
    },
    onError: (error) => {
      callback(error);
    },
  });
  const mapper = new PackEventStream((event) => stream.supply(event), [
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
export function bytesToStrokes(blob, callback) {
  const events = [];
  const eventStream = new UnpackEventStream((event) => events.push(event));
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
