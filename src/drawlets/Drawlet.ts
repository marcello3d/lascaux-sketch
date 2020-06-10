import { Dna } from './drawos/dna';
import { RgbaImage } from './drawos/webgl/util';
import { PromiseOrValue } from 'promise-or-value';

export type DrawletInitContext<DrawletDna extends Dna> = {
  dna: DrawletDna;
  random: () => number;
};

export type DrawletHandleContext<
  DrawletDna extends Dna,
  Mode extends object,
  State extends object
> = {
  dna: DrawletDna;
  random: () => number;
  mode: Mode;
  state: State;
};

export const DRAW_START_EVENT = 'start';
export const DRAW_EVENT = 'draw';
export const DRAW_END_EVENT = 'end';
export const CURSOR_EVENT = '%cursor';

export type DrawletDrawEventType =
  | typeof DRAW_START_EVENT
  | typeof DRAW_EVENT
  | typeof DRAW_END_EVENT;

export type CursorType = 'touch' | 'cursor' | 'stylus';
export type DrawletDrawEventPayload = {
  x: number;
  y: number;
  pressure?: number;
  width?: number;
  height?: number;
  tiltX?: number;
  tiltY?: number;
};
export type DrawletCursorEventPayload = {
  cursor: CursorType;
  forceMax?: number;
  radiusError?: number;
  tilt?: boolean;
};

export type DrawletDrawEvent = [
  DrawletDrawEventType,
  number,
  DrawletDrawEventPayload,
];
export type DrawletCursorEvent = [
  typeof CURSOR_EVENT,
  number,
  DrawletCursorEventPayload,
];
export type DrawletEvent = DrawletDrawEvent | DrawletCursorEvent;

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
  fillEllipses(ellipses: Rects, hardness: number): void;
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

export type DrawletInitializeFn<DrawletDna extends Dna, Mode> = (
  context: DrawletInitContext<DrawletDna>,
  canvas?: DrawingContext,
) => Mode;

export type DrawletHandleFn<
  DrawletDna extends Dna,
  Mode extends object,
  State extends object
> = (
  context: DrawletHandleContext<DrawletDna, Mode, State>,
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

export interface DrawOs {
  initialize(): void;
  getSnapshot(): Snap;
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
export type UpdateObject<Mode extends object> = {
  cursor: number;
  strokeCount: number;
  undo: number | undefined;
  redo: number | undefined;
  gotos: number[];
  mode: Mode;
  playing: boolean;
  transform: Transform;
};
export type DrawletInstance<Mode extends object> = {
  dom: HTMLElement;
  getUpdateObject(): UpdateObject<Mode>;
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
export type DrawOsConstructor = new (
  dna: Dna,
  scale?: number,
  tileSize?: number,
) => DrawOs;
