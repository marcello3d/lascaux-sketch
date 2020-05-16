import { Snap } from '../Drawlet';
import { VoidCallback } from './types';

export type EncodedRange = [number, number];
export type EncodedSnap = number;
export type RangeMetadata = {
  gotos: object[];
  keys: number[];
  modes: Array<number | object>;
  strokes: number;
  ranges: EncodedRange[];
  snapshots: EncodedSnap[];
};
export type StrokePayload = object;
export type Stroke = {
  type: string;
  time: number;
  payload: StrokePayload;
};
export type OptionalError = Error | undefined;

export type GetRangeMetadataCallback = (
  error: OptionalError,
  rangeMetadata?: RangeMetadata,
) => void;

export type GetStrokeCallback = (error: OptionalError, stroke?: Stroke) => void;

export type GetSnapshotCallback = (
  error: OptionalError,
  snapshot?: Snap,
) => void;

export type GetSnapshotLinkCallback = (
  error: OptionalError,
  image?: ImageData,
) => void;

export interface StorageModel {
  getRangeMetadata(callback: GetRangeMetadataCallback): void;
  addStroke(type: string, time: number, payload: StrokePayload): void;
  getStroke(index: number, callback: GetStrokeCallback): void;
  addSnapshot(index: number, snapshot: Snap, callback: VoidCallback): void;
  addSnapshotLink(
    link: string,
    image: ImageData | undefined,
    callback: VoidCallback,
  ): void;
  getSnapshot(index: number, callback: GetSnapshotCallback): void;
  getSnapshotLink(link: string, callback: GetSnapshotLinkCallback): void;
  flush(callback: VoidCallback): void;
}
