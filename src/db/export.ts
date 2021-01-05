import { db, DbDrawing } from './db';
import { ExportedDrawingV1 } from '../lascaux/ExportedDrawing';
import { getAllStrokes } from './DexieStorageModel';
import { newDate } from './fields';

export async function exportDrawing(
  drawing: DbDrawing,
): Promise<ExportedDrawingV1> {
  return {
    version: 1,
    dna: drawing.dna,
    strokes: (await getAllStrokes(drawing.id)).map((stroke) => [
      stroke.time,
      stroke.type,
      stroke.payload,
    ]),
  };
}

export async function importDrawing(
  drawingId: string,
  drawing: ExportedDrawingV1,
  createdAt: string = newDate(),
) {
  await db.drawings.add({
    id: drawingId,
    createdAt,
    dna: drawing.dna,
  });
  await db.strokes.bulkAdd(
    drawing.strokes.map(([time, type, payload], index) => ({
      drawingId,
      index,
      time,
      type,
      payload,
    })),
  );
}
