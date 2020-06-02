import { RouteComponentProps } from '@reach/router';
import React from 'react';
import { getDrawingModel } from '../drawlets/drawlet-cache';
import { DrawletApp } from '../DrawletApp';
import { useDexieItem } from '../db/useDexie';
import { db } from '../db/db';

type DrawingPageProps = { drawingId?: string } & RouteComponentProps;

export function DrawingPage({ drawingId }: DrawingPageProps) {
  if (drawingId === undefined) {
    throw new Error('Drawing not found');
  }
  const drawing = useDexieItem(db.drawings, drawingId);
  if (!drawing) {
    throw new Error('Invalid drawing');
  }
  const drawingModel = getDrawingModel(drawingId, drawing.dna);
  return <DrawletApp drawingModel={drawingModel} />;
}
