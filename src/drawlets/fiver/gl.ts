import setupHtmlCanvasBridge from '../setup-canvas-bridge';

import {
  FiverDna,
  FiverMode,
  FiverState,
  handleCommand,
  initializeCommand,
} from './fiver';
import DrawingModel, {
  getInitializeContext,
} from '../file-format/DrawingModel';
import { GlOS1 } from '../drawos/webgl/glos1';
import { UpdateObject } from '../Drawlet';
import { StorageModel } from '../file-format/StorageModel';

export function makeFiverCanvas(
  drawingModel: DrawingModel<FiverDna, FiverMode, FiverState>,
  onUpdate: (options: UpdateObject<FiverMode>) => void,
  editable = true,
) {
  return setupHtmlCanvasBridge(drawingModel, onUpdate, editable);
}

export async function makeFiverModel(
  dna: FiverDna,
  storageModel: StorageModel,
): Promise<DrawingModel<FiverDna, FiverMode, FiverState>> {
  // This is convoluted
  const initialMode = initializeCommand(getInitializeContext(dna));
  const metadata = await storageModel.getMetadata(initialMode);
  return new DrawingModel({
    dna,
    editable: true,
    DrawOs: GlOS1,
    snapshotStrokeCount: 250,
    storageModel,
    metadata,
    initializeCommand,
    handleCommand,
  });
}
