import { Dna } from './DrawingDoc';

export type ExportedStrokeV1 = [number, string, any];
export type ExportedDrawingV1 = {
  version: 1;
  dna: Dna;
  strokes: ExportedStrokeV1[];
};
