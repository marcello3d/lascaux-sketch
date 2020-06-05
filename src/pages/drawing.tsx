import { RouteComponentProps } from '@reach/router';
import React from 'react';
import { getOrMakeDrawingModel } from '../drawlets/drawlet-cache';
import { DrawletApp } from '../DrawletApp';
import { useDexieItem } from '../db/useDexie';
import { db } from '../db/db';
import { makeFiverModel } from '../drawlets/fiver/gl';
import { FiverDna } from '../drawlets/fiver/fiver';
import { LocalStorageModel } from '../db/DexieStorageModel';

type DrawingPageProps = { drawingId?: string } & RouteComponentProps;

export function DrawingPage({ drawingId }: DrawingPageProps) {
  if (drawingId === undefined) {
    throw new Error('Drawing not found');
  }
  const drawing = useDexieItem(db.drawings, drawingId);
  if (!drawing) {
    throw new Error('Invalid drawing');
  }
  const localStorageModel = new LocalStorageModel(drawingId);
  const drawingModel = getOrMakeDrawingModel(drawingId, () =>
    makeFiverModel(drawing.dna as FiverDna, localStorageModel),
  );
  if (drawingModel instanceof Promise) {
    throw drawingModel;
  }
  return <DrawletApp drawingModel={drawingModel} />;
}
