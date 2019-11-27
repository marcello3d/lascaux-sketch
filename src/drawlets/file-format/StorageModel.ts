import { Snap } from '../Drawlet';
import { VoidCallback } from './types';

export type RangeMetadata = {
  gotos: object[];
  keys: number[];
  modes: Array<number | object>;
  strokes: number;
  ranges: [];
  snapshots: [];
};
export type Stroke = {
  type: string;
  time: number;
  payload: object;
};

export interface StorageModel {
  getRangeMetadata(
    callback: (error: Error | undefined, rangeMetadata: RangeMetadata) => void,
  ): void;

  addStroke(type: string, time: number, payload: object): void;

  getStroke(
    index: number,
    callback: (error: Error | undefined, stroke: Stroke) => void,
  ): void;

  addSnapshot(index: number, snapshot: Snap, callback: VoidCallback): void;

  addSnapshotLink(
    link: string,
    image: ImageData | undefined,
    callback: VoidCallback,
  ): void;

  getSnapshot(
    index: number,
    callback: (error: Error | undefined, snapshot: Snap) => void,
  ): void;

  getSnapshotLink(
    link: string,
    callback: (error: Error | undefined, image: ImageData | undefined) => void,
  ): void;

  flush(callback: VoidCallback): void;
}
