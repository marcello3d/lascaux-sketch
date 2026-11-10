import React, { useCallback, useEffect, useRef } from 'react';

import { LascauxDomInstance, LascauxEmbedded } from '../library';
import { Button } from '../ui/Button';
import { isDraftDrawingId, tryUpload, useLoadDrawing } from './fetch';
import { installEmbedApi } from './embed-api';
import {
  cleanupDrawings,
  discardDrawing,
  flush,
  getSaveState,
  onSaveState,
  SaveState,
} from '../db/save-state';

/**
 * The drawing's copy on this device, for the page around the editor (2draw's
 * draw bar): every stroke is stored as it is drawn, under the draft key.
 */
export type LascauxDraftApi = {
  /** The copy was already on this device when the editor opened. */
  restored: boolean;
  /** Its strokes when the editor opened (unchanged while strokes stays at this). */
  initialStrokes: number;
  state(): SaveState;
  /** Calls `listener` as strokes get stored; returns the unsubscribe. */
  onState(listener: (state: SaveState) => void): () => void;
  /** Resolves once every stroke so far is stored (or failed again). */
  flush(): Promise<void>;
  /** Deletes the copy (after a submit, or when the draft is discarded). */
  discard(): Promise<void>;
};

export type LascauxStandaloneProps = {
  canvasWidth: number;
  canvasHeight: number;
  uploadUrl: string;
  onDownloadFailure?: (error: Error) => void;
  onUploadSuccess?: () => void;
  onUploadFailure?: (error: Error) => void;
  jsonGzUrl?: string;
  /** 2draw's draft key: the drawing is kept on this device under it. */
  draftKey?: string;
  /** With draftKey: the copy's API, once the drawing is open. */
  onDraft?: (api: LascauxDraftApi) => void;
};

export function LascauxStandalone({
  canvasWidth,
  canvasHeight,
  uploadUrl,
  onDownloadFailure,
  onUploadSuccess,
  onUploadFailure,
  jsonGzUrl,
  draftKey,
  onDraft,
}: LascauxStandaloneProps) {
  const lascauxDomRef = useRef<LascauxDomInstance>(null);
  const { drawingId, restored, strokes } = useLoadDrawing(
    jsonGzUrl,
    onDownloadFailure,
    draftKey,
  );

  useEffect(() => {
    cleanupDrawings(drawingId, isDraftDrawingId).catch((error) =>
      console.warn('lascaux: could not clean up old drawings', error),
    );
  }, [drawingId]);

  useEffect(() => {
    if (draftKey && onDraft) {
      onDraft({
        restored,
        initialStrokes: strokes,
        state: () => getSaveState(drawingId),
        onState: (listener) => onSaveState(drawingId, listener),
        flush: () => flush(drawingId),
        discard: () => discardDrawing(drawingId),
      });
    }
    // once per drawing
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawingId]);

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
      onInstance={installEmbedApi}
    />
  );
}
