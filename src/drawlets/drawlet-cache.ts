import DrawingModel from './file-format/DrawingModel';
import { makeFiverModel } from './fiver/gl';
import { newDna } from './fiver/fiver';

const map = new Map<string, DrawingModel>();
export function getDrawingModel(id: string): DrawingModel {
  let drawingModel = map.get(id);
  if (!drawingModel) {
    drawingModel = (makeFiverModel(newDna()) as unknown) as DrawingModel;
    map.set(id, drawingModel);
  }
  return drawingModel;
}
