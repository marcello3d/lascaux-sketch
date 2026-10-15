// Unit tests for the player's pure parts (npm test): the clock and the
// keyframes' band encoding and budget. The replay itself is checked in a
// browser by test/gate.html.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTimes, cursorAt, durationOf, timeOf } from '../../src/twodraw/timeline';
import {
  decodeBand,
  encodeBand,
  keepLayer,
  KeyframeStore,
  unpack,
  Keyframe,
} from '../../src/twodraw/keyframes';

test('the clock follows the pen, shortens pauses and ignores the editor clock', () => {
  const strokes = [
    { type: '!mode', time: 1789584124588 }, // Date.now(): no time
    { type: '%cursor', time: 5000 },
    { type: 'start', time: 5000 },
    { type: 'draw', time: 5100 },
    { type: 'end', time: 5200 },
    { type: '!goto', time: 1789584199999 },
    { type: 'start', time: 65200 }, // a minute later: 500 ms
    { type: 'draw', time: 300 }, // a new session (goes back): nothing
    { type: 'end', time: 350 },
  ];
  const times = buildTimes(strokes);
  assert.deepEqual(Array.from(times), [0, 0, 0, 100, 200, 200, 700, 700, 750]);
  assert.equal(durationOf(times), 750);
  assert.equal(cursorAt(times, 0), 0);
  assert.equal(cursorAt(times, 50), 3);
  assert.equal(cursorAt(times, 100), 4);
  assert.equal(cursorAt(times, 699), 6);
  assert.equal(cursorAt(times, 750), 9);
  assert.equal(cursorAt(times, 1e9), 9);
  assert.equal(timeOf(times, 0), 0);
  assert.equal(timeOf(times, 4), 100);
  assert.equal(timeOf(times, 9), 750);
});

test('a drawing with no pen time is all there at once', () => {
  const times = buildTimes([{ type: '!art', time: 1 }, { type: '!mode', time: 2 }]);
  assert.equal(durationOf(times), 0);
  assert.equal(cursorAt(times, 0), 2);
});

test('bands round-trip through run-length encoding', () => {
  const words = new Uint32Array(5000);
  words.fill(0x3f800000, 100, 900);
  for (let i = 2000; i < 2100; i++) words[i] = i * 2654435761;
  words[4999] = 7;
  const encoded = encodeBand(words);
  assert.ok(encoded.length < 400);
  const back = new Uint32Array(words.length);
  assert.equal(decodeBand(encoded, back, 0), words.length);
  assert.deepEqual(back, words);
});

test('runs are of whole pixels (4 words of float32)', () => {
  const words = new Uint32Array(4 * 1000);
  for (let p = 0; p < 1000; p++) words.set([1, 2, 3, p < 600 ? 4 : 5], p * 4);
  const encoded = encodeBand(words, 4);
  assert.ok(encoded.length <= 12);
  const back = new Uint32Array(words.length);
  assert.equal(decodeBand(encoded, back, 0, 4), words.length);
  assert.deepEqual(back, words);
  // mixed literals and runs
  const mixed = new Uint32Array(4 * 10);
  for (let i = 0; i < mixed.length; i++) mixed[i] = i < 12 ? i : 9;
  const out = new Uint32Array(mixed.length);
  decodeBand(encodeBand(mixed, 4), out, 0, 4);
  assert.deepEqual(out, mixed);
});

test('a keyframe re-encodes only the tiles drawn on, sharing the rest', () => {
  // a 150 x 70 layer of 2-word pixels in 64 px tiles: 3 x 2 tiles, partial at the edges
  const shape = { width: 150, height: 70, size: 64, unit: 2 };
  const words = new Uint32Array(150 * 70 * 2);
  for (let i = 0; i < words.length; i += 3) words[i] = i;
  const a = { bytes: 0 };
  const whole = { x: 0, y: 0, w: 150, words };
  const base = keepLayer(shape, undefined, true, whole, a);
  assert.equal(base.tiles.length, 6);
  assert.deepEqual(unpack(base), words);
  // draw in tile 4 (tx 1, ty 1): pixels x 70..79, y 66..69
  const next = words.slice();
  for (let y = 66; y < 70; y++) for (let x = 70; x < 80; x++) next.set([7, 7], (y * 150 + x) * 2);
  const rect = { x: 64, y: 64, w: 64, words: new Uint32Array(64 * 6 * 2) };
  for (let y = 0; y < 6; y++) rect.words.set(next.subarray(((64 + y) * 150 + 64) * 2, ((64 + y) * 150 + 128) * 2), y * 128);
  const b = { bytes: 0 };
  const kept = keepLayer(shape, base, new Set([4]), rect, b);
  assert.equal(kept.tiles.filter((t, i) => t === base.tiles[i]).length, 5);
  assert.deepEqual(unpack(kept), next);
  assert.ok(b.bytes > 0 && b.bytes < a.bytes);
  // a tile reported drawn on but unchanged: shared, nothing added
  const c = { bytes: 0 };
  const again = keepLayer(shape, kept, new Set([4]), rect, c);
  assert.equal(c.bytes, 0);
  assert.ok(again.tiles.every((t, i) => t === kept.tiles[i]));
});

function fakeKeyframe(index: number, words: number): Keyframe {
  const data = new Uint32Array(words);
  for (let i = 0; i < words; i++) data[i] = (i * 2654435761 + index) >>> 0;
  const kf: Keyframe = {
    index,
    renderCursor: index,
    artboard: {} as any,
    state: { x: 0, y: 0, a: 0, size: 0 },
    layers: new Map(),
    bytes: 0,
  };
  kf.layers.set('0', keepLayer({ width: words, height: 1, size: 64, unit: 1 }, undefined, true, { x: 0, y: 0, w: words, words: data }, kf));
  return kf;
}

test('over budget, every other keyframe goes (first and newest stay)', () => {
  const store = new KeyframeStore({ memory: 1024 * 1024, interval: 10 });
  for (let i = 1; i <= 8; i++) store.add(fakeKeyframe(i * 100, 50000)); // ~200 KB each
  assert.ok(store.bytes <= 1024 * 1024);
  const kept = store.keyframes.map((k) => k.index);
  assert.equal(kept[0], 100);
  assert.equal(kept[kept.length - 1], 800);
  assert.ok(kept.length < 8);
  // and they are taken less often from then on
  assert.equal(store.due(900, 10), false);
  assert.equal(store.due(900, 1e6), true);
  assert.equal(store.before(450, () => true)!.index <= 450, true);
  assert.equal(store.before(50, () => true), null);
});

test('a keyframe nothing fits in turns keyframes off', () => {
  const store = new KeyframeStore({ memory: 1000 });
  store.add(fakeKeyframe(10, 50000));
  assert.equal(store.count, 0);
  assert.equal(store.due(20, 1e9), false);
});
