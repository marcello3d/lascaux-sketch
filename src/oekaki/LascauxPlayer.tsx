import React, { useRef } from 'react';

import { LascauxDomInstance } from '../library';
import { useLoadDrawing } from './fetch';
import { LascauxPlayerEmbedded } from '../library/LascauxPlayerEmbedded';

export type LascauxPlayerProps = {
  onDownloadFailure?: (error: Error) => void;
  jsonGzUrl: string;
};

export function LascauxPlayer({
  onDownloadFailure,
  jsonGzUrl,
}: LascauxPlayerProps) {
  const lascauxDomRef = useRef<LascauxDomInstance>(null);
  const drawingId = useLoadDrawing(jsonGzUrl, onDownloadFailure);

  return (
    <LascauxPlayerEmbedded
      drawingId={drawingId}
      lascauxDomRef={lascauxDomRef}
    />
  );
}
