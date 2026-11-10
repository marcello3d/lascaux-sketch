import { db } from './db';
import { ExportedDrawingV1 } from '../lascaux/ExportedDrawing';
import { getAllStrokes } from './DexieStorageModel';
import { newDate } from './fields';

export async function exportDrawing(
  drawingId: string,
): Promise<ExportedDrawingV1> {
  const drawing = await db.drawings.get(drawingId);
  if (!drawing) {
    throw new Error('drawing not found');
  }
  return {
    version: 1,
    dna: drawing.dna,
    strokes: (await getAllStrokes(drawingId)).map((stroke) => [
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
  // all or nothing: a half-imported drawing would open as a draft's copy
  await db.transaction('rw', db.drawings, db.strokes, async () => {
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
  });
}
