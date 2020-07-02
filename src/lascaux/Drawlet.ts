import { RgbaImage } from './util/rgba-image';
import { PromiseOrValue } from 'promise-or-value';
import { DrawingState } from './legacy-model';
import { DrawingDoc, Id, IdMap } from './DrawingDoc';

export type DrawContext = {
  doc: DrawingDoc;
  user: string;
  state: DrawingState;
};

/** x, y, w, h, r, g, b, a */
export type Rect = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];
export type Rects = readonly Rect[];

export type DrawingContext = {
  addLayer(): void;

  setLayer(layer: Id): void;

  fillRects(rects: Rects): void;
  fillEllipses(ellipses: Rects, hardness: number, erase?: boolean): void;
  drawLine(
    x1: number,
    y1: number,
    size1: number,
    r1: number,
    g1: number,
    b1: number,
    a1: number,
    x2: number,
    y2: number,
    size2: number,
    r2: number,
    g2: number,
    b2: number,
    a2: number,
  ): void;
  setBackgroundColor(r: number, g: number, b: number, a?: number): void;
};

export type DrawletHandleFn = (
  context: DrawContext,
  canvas: DrawingContext,
  event: string,
  payload: any,
) => DrawingDoc;

export type GetLinkFn = (link: string) => PromiseOrValue<RgbaImage | undefined>;

export type Snap = {
  snapshot: Snapshot;
  links: Links;
  state?: object;
};

export interface DrawBackend {
  initialize(doc: DrawingDoc): void;
  updateDoc(doc: DrawingDoc): void;
  getSnapshot(): Snap;
  getPng(): Promise<Blob>;
  getDrawingContext(): DrawingContext;
  loadSnapshot(snapshot: Snapshot, getLink: GetLinkFn): PromiseOrValue<void>;
  getDom(): HTMLCanvasElement;
  saveRect(layer: number, x: number, y: number, w: number, h: number): void;
  afterExecute(): void;
  setTransform(translateX: number, translateY: number, scale: number): void;
  getInfo(): string | undefined;
  getLayerCount(): number;
}

export type Snapshot = {
  doc: DrawingDoc;
  layers: IdMap<Tiles>;
  tiles: Tiles;
  tileSize: number;
};
export type Tiles = IdMap<Tile>;
export type Links = IdMap<RgbaImage>;
export type Tile = {
  x: number;
  y: number;
  link: string | null;
};

export type Transform = {
  translateX: number;
  translateY: number;
  scale: number;
};
export type LascauxUiState = {
  doc: DrawingDoc;

  playing: boolean;
  cursor: number;
  strokeCount: number;

  undo: number | undefined;
  redo: number | undefined;
  gotos: number[];

  transform: Transform;
};

export type LascauxDomInstance = {
  dom: HTMLElement;
  getUiState(): LascauxUiState;
  getPng(): Promise<Blob>;
  flush(): void;
  updateDoc(recipe: (doc: DrawingDoc) => DrawingDoc): void;
  setScale(scale: number): void;
  addGoto(cursor: number): void;
  setPlaying(playing: boolean): void;
  seekTo(cursor: number): void;
  subscribe(): () => void;
  getInfo(): string | undefined;
};
