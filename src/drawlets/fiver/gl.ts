import setupHtmlCanvasBridge from '../setup-canvas-bridge';

import {
  FiverDna,
  FiverMode,
  FiverState,
  handleCommand,
  initializeCommand,
} from './fiver';
import DrawingModel from '../file-format/DrawingModel';
import GlOS1 from '../drawos/webgl/glos1';
import MemoryStorageModel from '../file-format/MemoryStorageModel';
import { UpdateObject } from '../Drawlet';

export function makeFiverCanvas(
  drawingModel: DrawingModel<FiverDna, FiverMode, FiverState>,
  onUpdate: (options: UpdateObject<FiverMode>) => void,
  editable = true,
) {
  return setupHtmlCanvasBridge(drawingModel, onUpdate, editable);
}

export function makeFiverModel(
  dna: FiverDna,
): DrawingModel<FiverDna, FiverMode, FiverState> {
  return new DrawingModel({
    dna,
    editable: true,
    DrawOs: GlOS1,
    snapshotStrokeCount: 250,
    storageModel: new MemoryStorageModel(),
    initializeCommand,
    handleCommand,
  });
}
