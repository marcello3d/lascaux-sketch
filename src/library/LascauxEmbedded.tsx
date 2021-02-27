import React, { MutableRefObject, useEffect } from 'react';
import { LascauxDomInstance } from '../lascaux/Drawlet';
import { useDexieItem } from '../db/useDexie';
import { db } from '../db/db';
import { newDate } from '../db/fields';
import { getOrMakeDrawingModel } from '../db/drawlet-cache';
import { DexieStorageModel } from '../db/DexieStorageModel';
import { createDrawingModel, dnaToDoc } from '../lascaux/fiver';
import { DrawletApp } from '../lascaux-ui/DrawletApp';
import { IconsUrls } from '../lascaux-ui/IconUrls';

const defaultIconUrls = {
  layerPlus: '',
  play: '',
  pause: '',
  undo: '',
  redo: '',
  layer: '',
  selectedLayer: '',
};

export function LascauxEmbedded({
  drawingId,
  width,
  height,
  lascauxDomRef,
  saveButton,
  iconUrls = defaultIconUrls,
}: {
  drawingId: string;
  width: number;
  height: number;
  saveButton?: React.ReactNode;
  iconUrls?: IconsUrls;
  lascauxDomRef?: MutableRefObject<LascauxDomInstance | null>;
}) {
  const drawing = useDexieItem(db.drawings, drawingId);
  useEffect(() => {
    if (!drawing) {
      db.drawings.add({
        id: drawingId,
        createdAt: newDate(),
        dna: { width, height },
      });
    }
  }, [drawing, drawingId, height, width]);
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
    <DrawletApp
      drawingId={id}
      drawingModel={drawingModel}
      saveButton={saveButton}
      iconUrls={iconUrls}
      lascauxDomRef={lascauxDomRef}
    />
  );
}
