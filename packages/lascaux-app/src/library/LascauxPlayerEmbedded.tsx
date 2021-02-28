import React, { MutableRefObject } from 'react';
import { LascauxDomInstance } from '../lascaux/Drawlet';
import { useDexieItem } from '../db/useDexie';
import { db } from '../db/db';
import { getOrMakeDrawingModel } from '../db/drawlet-cache';
import { DexieStorageModel } from '../db/DexieStorageModel';
import { createDrawingModel, dnaToDoc } from '../lascaux/fiver';
import { IconsUrls } from '../lascaux-ui/IconUrls';
import { PlaybackApp } from '../lascaux-ui/PlaybackApp';

const defaultIconUrls = {
  layerPlus: '',
  play: '',
  pause: '',
  undo: '',
  redo: '',
  layer: '',
  selectedLayer: '',
};

export function LascauxPlayerEmbedded({
  drawingId,
  lascauxDomRef,
  iconUrls = defaultIconUrls,
}: {
  drawingId: string;
  iconUrls?: IconsUrls;
  lascauxDomRef?: MutableRefObject<LascauxDomInstance | null>;
}) {
  const drawing = useDexieItem(db.drawings, drawingId);
  if (!drawing) {
    return <></>;
  }
  const { dna, id } = drawing;
  const drawingModel = getOrMakeDrawingModel(id, () => {
    const storage = new DexieStorageModel(id);
    return createDrawingModel(dnaToDoc(dna), storage).catch((err) => err);
  });
  if (drawingModel instanceof Error || drawingModel instanceof Promise) {
    throw drawingModel;
  }
  return (
    <PlaybackApp
      drawingModel={drawingModel}
      iconUrls={iconUrls}
      lascauxDomRef={lascauxDomRef}
    />
  );
}
