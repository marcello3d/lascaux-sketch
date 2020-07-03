import { Snap } from '../Drawlet';
import SnapshotMap from './SnapshotMap';
import GotoMap from './GotoMap';
import { PromiseOrValue } from 'promise-or-value';
import DrawingModel from './DrawingModel';
import { RgbaImage } from '../util/rgba-image';

export type Metadata = {
  gotoMap: GotoMap;
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
  replay(model: DrawingModel): PromiseOrValue<void>;
  getMetadata(): PromiseOrValue<Metadata>;
  addStroke(type: string, time: number, payload: StrokePayload): void;
  getStroke(index: number): PromiseOrValue<Stroke>;
  addSnapshot(index: number, snapshot: Snap): PromiseOrValue<void>;
  addSnapshotLink(
    link: string,
    image: RgbaImage | undefined,
  ): PromiseOrValue<void>;
  getSnapshot(index: number): PromiseOrValue<Snap>;
  getSnapshotLink(link: string): PromiseOrValue<RgbaImage>;
  flush(): PromiseOrValue<void>;
}
