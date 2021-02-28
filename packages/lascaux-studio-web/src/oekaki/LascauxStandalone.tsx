import React, { useCallback, useRef } from 'react';

import { LascauxDomInstance, LascauxEmbedded } from '../library';
import { Button } from '../ui/Button';
import { tryUpload, useLoadDrawing } from './fetch';

export type LascauxStandaloneProps = {
  canvasWidth: number;
  canvasHeight: number;
  uploadUrl: string;
  onDownloadFailure?: (error: Error) => void;
  onUploadSuccess?: () => void;
  onUploadFailure?: (error: Error) => void;
  jsonGzUrl?: string;
};

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
  const drawingId = useLoadDrawing(jsonGzUrl, onDownloadFailure);

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
