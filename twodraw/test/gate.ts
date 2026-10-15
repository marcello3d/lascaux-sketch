/**
 * The replay gate, run in a browser (test/gate.html): for each drawing,
 * seeks to random points in random order on a replay with keyframes (in
 * slices, as the player does) and checks every layer's pixels and the shown
 * picture bit for bit against a replay without keyframes, which only ever
 * replays forward from the start.
 *
 *   gate.html?files=a.json.gz,b.json.gz&seeks=40&memory=8
 * Results: window.gateResult (and the page text).
 */
import { readDrawing } from '../../src/twodraw/player';
import { loadDrawing } from '../../src/twodraw/model';
import { Replay } from '../../src/twodraw/replay';
import { GOTO_EVENT } from '../../src/lascaux/data-model/events';

/** A new task, without setTimeout's clamping or a hidden page's throttling. */
function yieldTask(): Promise<void> {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => resolve();
    channel.port2.postMessage(null);
  });
}

function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Two 32-bit hashes (FNV-1a and a multiply-rotate) over 32-bit words. */
function hashWords(words: Uint32Array): string {
  let a = 0x811c9dc5;
  let b = 0x9e3779b9;
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    a = Math.imul(a ^ w, 0x01000193);
    b = Math.imul((b ^ w) + ((b << 13) | (b >>> 19)), 0x85ebca6b);
  }
  return (a >>> 0).toString(16) + ':' + (b >>> 0).toString(16) + ':' + words.length;
}

function hashOf(data: ArrayBufferView): string {
  return hashWords(new Uint32Array(data.buffer, data.byteOffset, data.byteLength >> 2));
}

/** Every layer's data and the shown picture, hashed. */
function fingerprint(replay: Replay, height: number): string {
  replay.present();
  const parts = replay.ctx
    .layerIds()
    .sort()
    .map((id) => id + '=' + hashOf(replay.ctx.readLayerRows(id, 0, height)));
  parts.push('canvas=' + hashOf(replay.ctx.readCanvas()));
  return parts.join(' ');
}

async function gateOne(url: string, seeks: number, memoryMB: number, interval: number, precision: any, log: (s: string) => void) {
  const t0 = performance.now();
  const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
  const json = await readDrawing(bytes);
  const { doc, model, strokes } = await loadDrawing(json);
  const tLoad = performance.now() - t0;
  const n = strokes.length;
  const height = Number(doc.artboard.height);
  const rand = mulberry32(n * 7919 + 17);
  const targets = new Set<number>([0, n, 1, Math.floor(n / 2)]);
  // around every undo/redo
  const gotoAt = strokes.flatMap((s, i) => (s.type === GOTO_EVENT ? [i] : []));
  const sampled = gotoAt.length <= 24 ? gotoAt : gotoAt.filter(() => rand() < 24 / gotoAt.length);
  sampled.forEach((i) => {
    targets.add(i);
    targets.add(i + 1);
    targets.add(Math.min(n, i + 2));
  });
  while (targets.size < seeks + 4 || targets.size < 8) {
    targets.add(Math.floor(rand() * (n + 1)));
    if (targets.size >= n + 1) break;
  }
  const list = [...targets];
  // random order for the keyframed replay
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }

  // Straight replays: no keyframes, targets in order (forward only, from the
  // start whenever an undo sends it back).
  const straight = new Replay(model, strokes, doc.artboard, false, precision);
  const expected = new Map<number, string>();
  const tS = performance.now();
  for (const t of [...list].sort((a, b) => a - b)) {
    straight.plan(t);
    straight.advance(Infinity);
    expected.set(t, fingerprint(straight, height));
  }
  const tStraight = performance.now() - tS;

  const keyed = new Replay(model, strokes, doc.artboard, {
    memory: memoryMB * 1024 * 1024,
    interval,
  }, precision);
  // play it through once (as a viewer would), so keyframes exist
  keyed.plan(n);
  while (!keyed.advance(16)) await yieldTask();
  let failures = 0;
  let worstSeek = 0;
  let totalSeek = 0;
  let restores = 0;
  for (const t of list) {
    const s = performance.now();
    keyed.plan(t);
    if (keyed.rewound) restores++;
    let slices = 0;
    while (!keyed.advance(16)) {
      slices++;
      await yieldTask();
    }
    const took = performance.now() - s;
    totalSeek += took;
    worstSeek = Math.max(worstSeek, took);
    const got = fingerprint(keyed, height);
    if (got !== expected.get(t)) {
      failures++;
      log(`  MISMATCH at ${t} (resolves to ${keyed.resolve(t)}):\n    got  ${got}\n    want ${expected.get(t)}`);
    }
    void slices;
  }
  const kf = keyed.keyframes!;
  const summary = {
    file: url.split('/').pop(),
    size: `${doc.artboard.width}x${doc.artboard.height}`,
    events: n,
    gotos: strokes.filter((s) => s.type === GOTO_EVENT).length,
    seeks: list.length,
    distinctFrames: new Set(expected.values()).size,
    failures,
    loadMs: Math.round(tLoad),
    straightMs: Math.round(tStraight),
    avgSeekMs: Math.round(totalSeek / list.length),
    worstSeekMs: Math.round(worstSeek),
    restores,
    keyframes: kf.count,
    keyframeMB: +(kf.bytes / 1024 / 1024).toFixed(1),
    gl: replay_info(keyed),
  };
  straight.dispose();
  keyed.dispose();
  log(JSON.stringify(summary));
  return summary;
}

function replay_info(r: Replay): string {
  return r.ctx.getInfo() ?? '';
}

async function main() {
  const params = new URLSearchParams(location.search);
  const files = (params.get('files') ?? '').split(',').filter(Boolean);
  const seeks = Number(params.get('seeks') ?? 40);
  const memory = Number(params.get('memory') ?? 128);
  const interval = Number(params.get('interval') ?? 150);
  const precision = params.get('precision') ?? undefined;
  const out = document.getElementById('out')!;
  const log = (s: string) => {
    out.textContent += s + '\n';
    console.log(s);
  };
  const results: unknown[] = [];
  (window as any).gateResult = { done: false, results };
  for (const f of files) {
    try {
      results.push(await gateOne(f, seeks, memory, interval, precision, log));
    } catch (e) {
      log(`${f}: ERROR ${(e as Error).stack ?? e}`);
      results.push({ file: f, error: String(e) });
    }
  }
  (window as any).gateResult = { done: true, results };
  log('done');
}

void main();
