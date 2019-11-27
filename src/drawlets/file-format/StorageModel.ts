import { Snap } from '../Drawlet';

export type RangeMetadata = {
  gotos: object[];
  keys: object[];
  modes: Array<number | object>;
  strokes: number;
  ranges: [];
  snapshots: [];
};

export interface StorageModel {
  getRangeMetadata(
    callback: (error: Error | undefined, rangeMetadata: RangeMetadata) => void,
  ): void;

  addStroke(type: string, time: number, payload: object): void;

  getStroke(
    index: number,
    callback: (
      error: Error | undefined,
      stroke: { type: string; time: number; payload: object },
    ) => void,
  ): void;

  addSnapshot(index: number, snapshot: Snap, callback: ReadyCallbackFn): void;

  addSnapshotLink(
    link: string,
    image: ImageData | undefined,
    callback: ReadyCallbackFn,
  ): void;

  getSnapshot(
    index: number,
    callback: (error: Error | undefined, snapshot: Snap) => void,
  ): void;

  getSnapshotLink(
    link: string,
    callback: (error: Error | undefined, image: ImageData | undefined) => void,
  ): void;

  flush(callback: ReadyCallbackFn): void;
}

export type ReadyCallbackFn = (error?: Error) => void;
