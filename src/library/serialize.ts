import pako from 'pako';
import { exportDrawing, importDrawing } from '../db/export';
import { ExportedDrawingV1 } from '../lascaux/ExportedDrawing';

export async function getExportedDrawingGzipped(
  drawingId: string,
): Promise<Blob> {
  const drawingData = await exportDrawing(drawingId);
  const compressed = pako.gzip(JSON.stringify(drawingData), { level: 9 });
  return new Blob([compressed], { type: 'application/gzip' });
}

export async function importGzippedDrawing(
  drawingId: string,
  blob: Uint8Array,
): Promise<void> {
  const uncompressed = pako.ungzip(blob, { to: 'string' });
  const drawing = JSON.parse(uncompressed) as ExportedDrawingV1;
  await importDrawing(drawingId, drawing);
}
