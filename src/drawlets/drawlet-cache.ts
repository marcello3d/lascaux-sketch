import DrawingModel from './file-format/DrawingModel';
import { makeFiverModel } from './fiver/gl';
import { FiverDna } from './fiver/fiver';
import { Dna } from './drawos/dna';

const map = new Map<string, DrawingModel>();
export function getDrawingModel(id: string, dna: Dna): DrawingModel {
  let drawingModel = map.get(id);
  if (!drawingModel) {
    drawingModel = makeFiverModel(dna as FiverDna);
    map.set(id, drawingModel);
  }
  return drawingModel;
}
