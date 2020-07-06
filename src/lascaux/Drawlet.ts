import { RgbaImage } from './util/rgba-image';
import { PromiseOrValue } from 'promise-or-value';
import { DrawingState } from './legacy-model';
import { Artboard, IdMap, UserMode } from './DrawingDoc';
import { Draft } from 'immer';

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

export type DrawletHandleFn = (
  mode: UserMode,
  state: DrawingState,
  ctx: DrawingContext,
  event: string,
  payload: any,
) => void;

export type GetLinkFn = (link: string) => PromiseOrValue<RgbaImage | undefined>;

export type Snap = {
  snapshot: Snapshot;
  links: Links;
  artboard: Artboard;
  state: object;
};

export interface DrawingContext {
  reset(artboard: Artboard): void;
  setArtboard(artboard: Artboard): void;
  getSnapshotAndLinks(): SnapshotAndLinks;
  getPng(): Promise<Blob>;
  fillEllipses(
    layer: string,
    rects: Rects,
    hardness: number,
    erase: boolean,
  ): void;
  loadSnapshot(snapshot: Snapshot, getLink: GetLinkFn): PromiseOrValue<void>;
  getDom(): HTMLCanvasElement;
  repaint(): void;
  setTransform(translateX: number, translateY: number, scale: number): void;
  getInfo(): string | undefined;
  getLayerCount(): number;
}

export type Snapshot = Readonly<{
  layers: IdMap<Tiles>;
  tileSize: number;
}>;
export type SnapshotAndLinks = {
  snapshot: Snapshot;
  links: Links;
};
export type Tiles = IdMap<Tile>;
export type Links = IdMap<RgbaImage>;
export type Tile = Readonly<{
  x: number;
  y: number;
  link: string | null;
}>;

export type Transform = {
  translateX: number;
  translateY: number;
  scale: number;
};
export type LascauxUiState = {
  artboard: Artboard;
  mode: UserMode;

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
  mutateArtboard(recipe: (draft: Draft<Artboard>) => void): void;
  mutateMode(recipe: (draft: Draft<UserMode>) => void): void;
  setScale(scale: number): void;
  addGoto(cursor: number): void;
  setPlaying(playing: boolean): void;
  seekTo(cursor: number): void;
  subscribe(): () => void;
  getInfo(): string | undefined;
};
