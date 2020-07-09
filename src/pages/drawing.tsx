import { RouteComponentProps } from '@reach/router';
import React from 'react';
import { DrawletApp } from '../lascaux-ui/DrawletApp';
import { useDexieItem } from '../db/useDexie';
import { db } from '../db/db';
import { DexieStorageModel } from '../db/DexieStorageModel';
import { NotFoundPage } from './404';
import { getOrMakeDrawingModel } from '../db/drawlet-cache';
import { createDrawingModel, dnaToDoc } from '../lascaux/fiver';

type DrawingPageProps = { drawingId?: string } & RouteComponentProps;

export function DrawingPage(props: DrawingPageProps) {
  const { drawingId } = props;
  const drawing = useDexieItem(db.drawings, drawingId);
  if (!drawing) {
    return <NotFoundPage {...props} />;
  }
  const { dna, id } = drawing;
  const drawingModel = getOrMakeDrawingModel(id, () => {
    const storage = new DexieStorageModel(id);
    return createDrawingModel(dnaToDoc(dna), storage).catch((err) => err);
  });
  if (drawingModel instanceof Error || drawingModel instanceof Promise) {
    throw drawingModel;
  }
  return <DrawletApp drawingId={id} dna={dna} drawingModel={drawingModel} />;
}
