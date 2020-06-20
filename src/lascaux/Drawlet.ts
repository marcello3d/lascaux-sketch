import { RgbaImage } from './util/rgba-image';
import { PromiseOrValue } from 'promise-or-value';
import { Dna, DrawingMode, DrawingState } from './dna';

export type InitContext = {
  dna: Dna;
  random: () => number;
};

export type DrawContext = {
  dna: Dna;
  mode: DrawingMode;
  state: DrawingState;
  random: () => number;
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

  setLayer(layer: number): void;

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
};

export type DrawletInitializeFn = (
  context: InitContext,
  canvas?: DrawingContext,
) => DrawingMode;

export type DrawletHandleFn = (
  context: DrawContext,
  canvas: DrawingContext,
  event: string,
  payload: any,
) => void;

export type GetLinkFn = (link: string) => PromiseOrValue<RgbaImage | undefined>;

export type Snap = {
  snapshot: Snapshot;
  links: Links;
  state?: object;
};

export interface DrawBackend {
  initialize(): void;
  getSnapshot(): Snap;
  getPng(): Promise<Blob>;
  getDrawingContext(): DrawingContext;
  loadSnapshot(snapshot: Snapshot, getLink: GetLinkFn): PromiseOrValue<void>;
  getDom(): HTMLCanvasElement;
  saveRect(layer: number, x: number, y: number, w: number, h: number): void;
  afterExecute(): void;
  setTransform(translateX: number, translateY: number, scale: number): void;
  getInfo(): string | undefined;
}

export type Snapshot = {
  tiles: Tiles;
  tileSize: number;
  layers: number;
};
export type Links = Record<string, RgbaImage>;
export type Tile = {
  layer: number;
  x: number;
  y: number;
  link: string | null;
};
export type Tiles = Record<string, Tile>;

export type Transform = {
  translateX: number;
  translateY: number;
  scale: number;
};
export type LascauxUiState = {
  cursor: number;
  strokeCount: number;
  undo: number | undefined;
  redo: number | undefined;
  gotos: number[];
  mode: DrawingMode;
  playing: boolean;
  transform: Transform;
};

export type LascauxDomInstance = {
  dom: HTMLElement;
  getUiState(): LascauxUiState;
  getPng(): Promise<Blob>;
  flush(): void;
  setMode(mode: string, value: any): void;
  setScale(scale: number): void;
  addLayer(): void;
  addGoto(cursor: number): void;
  setPlaying(playing: boolean): void;
  seekTo(cursor: number): void;
  subscribe(): () => void;
  getInfo(): string | undefined;
};
