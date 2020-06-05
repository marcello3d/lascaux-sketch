import DrawingModel from './file-format/DrawingModel';
import { getOrAdd, PromiseOrValue } from 'promise-or-value';

const map = new Map<string, DrawingModel>();
export function getOrMakeDrawingModel(
  drawingId: string,
  makeModel: () => PromiseOrValue<DrawingModel>,
): PromiseOrValue<DrawingModel> {
  return getOrAdd(map, drawingId, makeModel);
}
