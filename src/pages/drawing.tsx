import { RouteComponentProps } from '@reach/router';
import React from 'react';
import { getOrMakeDrawingModel } from '../drawlets/drawlet-cache';
import { DrawletApp } from '../DrawletApp';
import { useDexieItem } from '../db/useDexie';
import { db } from '../db/db';
import { makeFiverModel } from '../drawlets/fiver/gl';
import { FiverDna } from '../drawlets/fiver/fiver';
import { DexieStorageModel } from '../db/DexieStorageModel';
import { NotFoundPage } from './404';

type DrawingPageProps = { drawingId?: string } & RouteComponentProps;

export function DrawingPage(props: DrawingPageProps) {
  const { drawingId } = props;
  const drawing = useDexieItem(db.drawings, drawingId);
  if (!drawing) {
    return <NotFoundPage {...props} />;
  }
  const { dna, id } = drawing;
  const drawingModel = getOrMakeDrawingModel(id, () =>
    makeFiverModel(dna as FiverDna, new DexieStorageModel(id)).catch(
      (error) => error,
    ),
  );
  if (drawingModel instanceof Error || drawingModel instanceof Promise) {
    throw drawingModel;
  }
  return <DrawletApp drawingModel={drawingModel} />;
}
