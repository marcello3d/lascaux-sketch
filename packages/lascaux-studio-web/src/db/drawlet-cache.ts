import DrawingModel from '../lascaux/data-model/DrawingModel';
import { getOrAdd, PromiseOrValue } from 'promise-or-value';

const map = new Map<string, DrawingModel | Error>();
export function getOrMakeDrawingModel(
  drawingId: string,
  makeModel: () => PromiseOrValue<DrawingModel | Error>,
): PromiseOrValue<DrawingModel | Error> {
  return getOrAdd(map, drawingId, makeModel);
}
