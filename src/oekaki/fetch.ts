import {
  getExportedDrawingGzipped,
  importGzippedDrawing,
} from '../library/serialize';
import { LascauxDomInstance } from '../lascaux/Drawlet';
import { useEffect, useState } from 'react';
import { newId } from '../db/fields';

export async function tryUpload(
  lascaux: LascauxDomInstance,
  drawingId: string,
  uploadUrl: string,
) {
  const [png, jsonGz] = await Promise.all([
    lascaux.getPng(),
    getExportedDrawingGzipped(drawingId),
  ]);
  const formData = new FormData();
  formData.append('png', png);
  formData.append('json_gz', jsonGz);

  const result = await fetch(uploadUrl, { method: 'POST', body: formData });
  if (!result.ok) {
    throw new Error('upload error');
  }
  const json = await result.json();
  if (json?.ok !== true || json?.error) {
    throw new Error(json?.error ?? 'unknown error');
  }
}

export async function download(
  drawingId: string,
  jsonGzUrl: string,
): Promise<void> {
  // Download json.gz
  const res = await fetch(jsonGzUrl);
  const data = await res.arrayBuffer();
  // Import into database
  await importGzippedDrawing(drawingId, new Uint8Array(data));
}

export function useLoadDrawing(
  jsonGzUrl: string | undefined,
  onDownloadFailure: ((error: Error) => void) | undefined,
) {
  const [drawingId] = useState(() => newId());
  const [loadPromise, setLoadPromise] = useState<Promise<void> | undefined>();
  useEffect(() => {
    if (jsonGzUrl) {
      setLoadPromise(
        download(drawingId, jsonGzUrl).then(() => {
          setLoadPromise(undefined);
        }, onDownloadFailure),
      );
    }
  }, [drawingId, jsonGzUrl, onDownloadFailure]);

  if (loadPromise) {
    throw loadPromise;
  }
  return drawingId;
}
