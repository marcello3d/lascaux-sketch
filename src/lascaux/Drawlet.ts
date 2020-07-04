import { RgbaImage } from './util/rgba-image';
import { PromiseOrValue } from 'promise-or-value';
import { DrawingState } from './legacy-model';
import { DrawingDoc, Id, IdMap } from './DrawingDoc';
import { Draft } from 'immer';

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
  fillRects(layer: Id, rects: Rects): void;
  fillEllipses(
    layer: Id,
    ellipses: Rects,
    hardness: number,
    erase?: boolean,
  ): void;
};

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
  doc: DrawingDoc;
  state: object;
};

export interface DrawBackend {
  setDoc(doc: DrawingDoc): void;
  getSnapshot(): SnapshotAndLinks;
  getPng(): Promise<Blob>;
  getDrawingContext(): DrawingContext;
  loadSnapshot(snapshot: Snapshot, getLink: GetLinkFn): PromiseOrValue<void>;
  getDom(): HTMLCanvasElement;
  repaint(): void;
  setTransform(translateX: number, translateY: number, scale: number): void;
  getInfo(): string | undefined;
  getLayerCount(): number;
}

export type Snapshot = {
  layers: IdMap<Tiles>;
  tileSize: number;
};
export type SnapshotAndLinks = {
  snapshot: Snapshot;
  links: Links;
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
  produceDoc(recipe: (draft: Draft<DrawingDoc>) => void): void;
  setScale(scale: number): void;
  addGoto(cursor: number): void;
  setPlaying(playing: boolean): void;
  seekTo(cursor: number): void;
  subscribe(): () => void;
  getInfo(): string | undefined;
};
