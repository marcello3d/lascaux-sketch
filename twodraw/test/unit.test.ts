// Unit tests for the player's pure parts (npm test): the clock and the
// keyframes' band encoding and budget. The replay itself is checked in a
// browser by test/gate.html.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTimes, cursorAt, durationOf, timeOf } from '../../src/twodraw/timeline';
import {
  decodeBand,
  encodeBand,
  keepAll,
  keepSpliced,
  KeyframeStore,
  unpack,
  Keyframe,
} from '../../src/twodraw/keyframes';
import { skipKey } from '../../src/twodraw/replay';

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

test('a keyframe re-encodes only the bands its rows touch, sharing the rest', () => {
  const words = new Uint32Array(70000);
  for (let i = 0; i < words.length; i += 7) words[i] = i;
  const a = { bytes: 0 };
  const base = keepAll(words, undefined, a);
  assert.equal(base.bands.length, 5);
  const fresh = new Uint32Array(100).fill(0xdeadbeef);
  const b = { bytes: 0 };
  const next = keepSpliced(base, 20000, fresh, b);
  assert.equal(next.bands.filter((band, i) => band === base.bands[i]).length, 4);
  const expected = words.slice();
  expected.set(fresh, 20000);
  assert.deepEqual(unpack(next), expected);
  assert.ok(b.bytes > 0 && b.bytes < a.bytes);
  // unchanged rows: everything shared, nothing added
  const c = { bytes: 0 };
  const same = keepSpliced(next, 20000, fresh, c);
  assert.equal(c.bytes, 0);
  assert.ok(same.bands.every((band, i) => band === next.bands[i]));
});

function fakeKeyframe(index: number, words: number): Keyframe {
  const data = new Uint32Array(words);
  for (let i = 0; i < words; i++) data[i] = (i * 2654435761 + index) >>> 0;
  const kf: Keyframe = {
    index,
    tag: '',
    artboard: {} as any,
    state: { x: 0, y: 0, a: 0, size: 0 },
    layers: new Map(),
    bytes: 0,
  };
  kf.layers.set('0', keepAll(data, undefined, kf));
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

test('states are tagged with the undo skips before them', () => {
  const skips: [number, number][] = [
    [10, 19],
    [40, 49],
  ];
  assert.equal(skipKey(skips, 5), '');
  assert.equal(skipKey(skips, 15), '10-14,');
  assert.equal(skipKey(skips, 30), '10-19,');
  assert.equal(skipKey(skips, 60), '10-19,40-49,');
});
