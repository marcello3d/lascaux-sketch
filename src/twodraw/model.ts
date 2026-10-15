/**
 * The drawing's bookkeeping, without pixels: the editor's own DrawingModel
 * (undo/redo goto map, the brush mode in force at each stroke event) built by
 * loading the strokes exactly as the editor does, but on a drawing context
 * that draws nothing. The player's replay (replay.ts) then draws on the GPU
 * using these maps.
 */
import { PromiseOrValue } from 'promise-or-value';
import DrawingModel from '../lascaux/data-model/DrawingModel';
import { StorageModel, Stroke, StrokePayload } from '../lascaux/data-model/StorageModel';
import {
  DrawingContext,
  GetLinkFn,
  Rects,
  Snap,
  Snapshot,
  SnapshotAndLinks,
} from '../lascaux/Drawlet';
import { Artboard, DrawingDoc } from '../lascaux/DrawingDoc';
import { dnaToDoc, handleCommand } from '../lascaux/fiver';
import { RgbaImage } from '../lascaux/util/rgba-image';
import { ExportedDrawingV1 } from '../lascaux/ExportedDrawing';

/** Draws nothing; its snapshots hold no pixels (the artboard and the brush
 * state, which CanvasModel adds, are all the bookkeeping needs). */
class NullDrawingContext implements DrawingContext {
  reset(_artboard: Artboard): void {}
  setArtboard(_artboard: Artboard): void {}
  getSnapshotAndLinks(): SnapshotAndLinks {
    return { snapshot: { layers: {}, tileSize: 64 }, links: {} };
  }
  getPng(): Promise<Blob> {
    return Promise.reject(new Error('no pixels'));
  }
  fillEllipses(_layer: string, _rects: Rects, _hardness: number, _erase: boolean): void {}
  loadSnapshot(_snapshot: Snapshot, _getLink: GetLinkFn): PromiseOrValue<void> {
    return undefined;
  }
  getDom(): HTMLCanvasElement {
    throw new Error('no canvas');
  }
  repaint(): void {}
  setTransform(_translateX: number, _translateY: number, _scale: number): void {}
  getInfo(): string | undefined {
    return 'null';
  }
  getLayerCount(): number {
    return 0;
  }
}

/** The strokes and the (pixel-less) snapshots, in memory. */
class MemoryStorage implements StorageModel {
  readonly strokes: Stroke[] = [];
  private snapshots: Record<number, Snap> = {};

  constructor(private readonly source: ExportedDrawingV1['strokes']) {}

  async replay(model: DrawingModel): Promise<void> {
    // One at a time: an undo (a !goto) replays asynchronously, and queueing
    // everything behind it would chain a promise per stroke.
    for (const [time, type, payload] of this.source) {
      const pending: PromiseOrValue<void> = model.addStroke(type, time, payload);
      if (pending) {
        await pending;
      }
    }
    await model.flush();
  }
  addStroke(index: number, type: string, time: number, payload: StrokePayload): void {
    if (index !== this.strokes.length) {
      throw new Error(`out of order stroke (${index} !== ${this.strokes.length})`);
    }
    this.strokes.push({ type, time, payload });
  }
  getStroke(index: number): Stroke {
    const stroke = this.strokes[index];
    if (!stroke) {
      throw new Error(`stroke not found ${index}`);
    }
    return stroke;
  }
  addSnapshot(index: number, snapshot: Snap): void {
    this.snapshots[index] = snapshot;
  }
  getSnapshot(index: number): Snap {
    return this.snapshots[index];
  }
  getSnapshotLink(_link: string): RgbaImage {
    throw new Error('no pixels');
  }
  flush(): void {}
}

export interface LoadedDrawing {
  doc: DrawingDoc;
  model: DrawingModel;
  /** The stroke events as the model holds them (the file's, in order). */
  strokes: Stroke[];
}

/** Parses an exported drawing (the .json.gz's JSON) and builds its model. */
export async function loadDrawing(json: ExportedDrawingV1): Promise<LoadedDrawing> {
  if (!json || json.version !== 1 || !json.dna || !Array.isArray(json.strokes)) {
    throw new Error('not a Lascaux Sketch 2 drawing');
  }
  const doc = dnaToDoc(json.dna);
  const storage = new MemoryStorage(json.strokes);
  const model = new DrawingModel({
    doc,
    snapshotStrokeCount: 250,
    storageModel: storage,
    handleCommand,
    context: new NullDrawingContext(),
  });
  await storage.replay(model);
  return { doc, model, strokes: storage.strokes };
}
