import { Snap } from '../Drawlet';
import { PromiseOrValue } from 'promise-or-value';
import DrawingModel from './DrawingModel';
import { RgbaImage } from '../util/rgba-image';

export type StrokePayload = object;
export type Stroke = {
  type: string;
  time: number;
  payload: StrokePayload;
};

export interface StorageModel {
  replay(model: DrawingModel): PromiseOrValue<void>;
  addStroke(type: string, time: number, payload: StrokePayload): void;
  getStroke(index: number): PromiseOrValue<Stroke>;
  addSnapshot(index: number, snapshot: Snap): PromiseOrValue<void>;
  getSnapshot(index: number): PromiseOrValue<Snap>;
  getSnapshotLink(link: string): PromiseOrValue<RgbaImage>;
  flush(): PromiseOrValue<void>;
}
