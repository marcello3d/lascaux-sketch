import { DrawletCursorPayload } from './data-model/events';

export type Id = string;
export type IdMap<T> = { [id: string]: T };
export type Color = [number, number, number, number];

export const ROOT_USER: Id = 'ROOT';
export const ROOT_LAYER: Id = 'ROOT';

export type DrawingDoc = Readonly<{
  artboard: Artboard;
  users: IdMap<UserMode>;
}>;

export type UserMode = Readonly<{
  layer: Id;
  cursor?: DrawletCursorPayload;
  brush: Id;
  color: Color;
  brushes: IdMap<Brush>;
}>;

export type Brush = Readonly<{
  mode: 'paint' | 'erase';
  size: number;
  opacity: number;
  spacing: number;
  flow: number;
  hardness: number;
}>;

export type Artboard = Readonly<{
  width: number;
  height: number;
  baseColor?: Color;
  rootLayers: Id[];
  layers: IdMap<Layer>;
}>;

export type LayerShared = Readonly<{
  name?: string;
  pos?: { x: number; y: number };
  opacity?: number;
}>;

export type Layer = LayerGroup | ImageLayer;
export type LayerGroup = LayerShared &
  Readonly<{
    type: 'group';
    layers: Id[];
  }>;

export type ImageLayer = LayerShared &
  Readonly<{
    type: 'image';
  }>;
