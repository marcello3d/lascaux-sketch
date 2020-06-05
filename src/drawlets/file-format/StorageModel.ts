import { Snap } from '../Drawlet';
import { Callback, VoidCallback } from './types';
import { RgbaImage } from '../drawos/webgl/util';
import SnapshotMap from './SnapshotMap';
import GotoMap from './GotoMap';
import { PromiseOrValue } from 'promise-or-value';
import ModeMap from './ModeMap';

export type Metadata = {
  gotoMap: GotoMap;
  modeMap: ModeMap<any>;
  strokeCount: number;
  snapshotMap: SnapshotMap;
};
export type StrokePayload = object;
export type Stroke = {
  type: string;
  time: number;
  payload: StrokePayload;
};

export interface StorageModel {
  getMetadata(initialMode: object): PromiseOrValue<Metadata>;
  addStroke(type: string, time: number, payload: StrokePayload): void;
  getStroke(index: number, callback: Callback<Stroke | undefined>): void;
  addSnapshot(index: number, snapshot: Snap, callback: VoidCallback): void;
  addSnapshotLink(
    link: string,
    image: RgbaImage | undefined,
    callback: VoidCallback,
  ): void;
  getSnapshot(index: number, callback: Callback<Snap | undefined>): void;
  getSnapshotLink(
    link: string,
    callback: Callback<RgbaImage | undefined>,
  ): void;
  flush(callback: VoidCallback): void;
}
