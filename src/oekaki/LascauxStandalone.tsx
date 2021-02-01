import React, { useEffect } from 'react';

import { LascauxDomInstance, LascauxEmbedded } from '../library';
import { Suspense, useCallback, useRef, useState } from 'react';
import {
  getExportedDrawingGzipped,
  importGzippedDrawing,
} from '../library/serialize';
import { newId } from '../db/fields';
import { Button } from '../ui/Button';

async function tryUpload(
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

export type LascauxStandaloneProps = {
  canvasWidth: number;
  canvasHeight: number;
  uploadUrl: string;
  onDownloadFailure?: (error: Error) => void;
  onUploadSuccess?: () => void;
  onUploadFailure?: (error: Error) => void;
  jsonGzUrl?: string;
};

async function download(drawingId: string, jsonGzUrl: string): Promise<void> {
  // Download json.gz
  const res = await fetch(jsonGzUrl);
  const data = await res.arrayBuffer();
  // Import into database
  await importGzippedDrawing(drawingId, new Uint8Array(data));
}
export function LascauxStandalone({
  canvasWidth,
  canvasHeight,
  uploadUrl,
  onDownloadFailure,
  onUploadSuccess,
  onUploadFailure,
  jsonGzUrl,
}: LascauxStandaloneProps) {
  const lascauxDomRef = useRef<LascauxDomInstance>(null);
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

  const doSave = useCallback(async () => {
    const lascaux = lascauxDomRef.current;
    if (!lascaux) {
      return;
    }
    tryUpload(lascaux, drawingId, uploadUrl).then(
      onUploadSuccess,
      onUploadFailure,
    );
  }, [drawingId, onUploadFailure, onUploadSuccess, uploadUrl]);

  if (loadPromise) {
    throw loadPromise;
  }

  return (
    <LascauxEmbedded
      drawingId={drawingId}
      width={canvasWidth}
      height={canvasHeight}
      lascauxDomRef={lascauxDomRef}
      saveButton={<Button onClick={doSave}>Submit</Button>}
    />
  );
}
