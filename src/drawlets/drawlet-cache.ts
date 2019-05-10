import { Drawing } from '../app/state';
import DrawingModel from './file-format/DrawingModel';
import { makeFiverModel } from './fiver/gl';
import { newDna } from './fiver/fiver';

const map = new Map<string, DrawingModel>();
export function getDrawingModel(id: string, drawing: Drawing): DrawingModel {
  let drawingModel = map.get(id);
  if (!drawingModel) {
    drawingModel = (makeFiverModel(
      newDna(drawing.width, drawing.height),
    ) as unknown) as DrawingModel;
    map.set(id, drawingModel);
  }
  return drawingModel;
}
