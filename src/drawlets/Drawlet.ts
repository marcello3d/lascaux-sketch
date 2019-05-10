import { Dna } from './drawos/dna';
import { FiverMode } from './fiver/fiver';

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
  DrawletDrawEventPayload
];
export type DrawletCursorEvent = [
  typeof CURSOR_EVENT,
  number,
  DrawletCursorEventPayload
];
export type DrawletEvent = DrawletDrawEvent | DrawletCursorEvent;

export type Rect = readonly [number, number, number, number];
export type Rects = readonly Rect[];

export interface DrawingContext {
  setFillStyle(fillStyle: string): void;

  fillRect(x: number, y: number, w: number, h: number): void;
  fillRects(rects: Rects): void;
  fillEllipse(x: number, y: number, w: number, h: number): void;
  fillEllipses(ellipses: Rects): void;
  drawLine(
    x1: number,
    y1: number,
    size1: number,
    x2: number,
    y2: number,
    size2: number,
  ): void;
}

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

export type GetLinkFn = (
  link: string,
  callback: (error: Error | undefined, dataUri: string) => void,
) => void;

export type Snap = {
  snapshot: Snapshot;
  links: Links;
  state?: object;
};

export interface DrawOs {
  initialize(): void;
  getSnapshot(): Snap;
  getDrawingContext(): DrawingContext;
  loadSnapshot(
    snapshot: Snapshot,
    getLink: GetLinkFn,
    callback: (error?: Error) => void,
  ): void;
  getDom(): HTMLCanvasElement;
  saveRect(x: number, y: number, w: number, h: number): void;
  beforeExecute(): void;
  afterExecute(): void;
  setTransform(translateX: number, translateY: number, scale: number): void;
  toDataUrl(): string;
}

export type Snapshot = {
  tiles: Tiles;
  tileSize: number;
};
export type Links = Record<string, string>;
export type Tile = { x: number; y: number; link: string };
export type Tiles = Record<string, Tile>;

export type Transform = {
  translateX: number;
  translateY: number;
  scale: number;
}
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
  addGoto(cursor: number): void;
  getImageDataUrl(): void;
  setPlaying(playing: boolean): void;
  goto(cursor: number): void;
  subscribe(): () => void;
};
export type DrawOsConstructor = new (
  dna: Dna,
  scale?: number,
  tileSize?: number,
) => DrawOs;
