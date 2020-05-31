import { RouteComponentProps } from '@reach/router';
import React from 'react';
import { getDrawingModel } from '../drawlets/drawlet-cache';
import { DrawletApp } from '../DrawletApp';

type DrawingPageProps = { drawingId?: string } & RouteComponentProps;

export function DrawingPage({ drawingId }: DrawingPageProps) {
  if (drawingId === undefined) {
    throw new Error('Drawing not found');
  }
  const drawingModel = getDrawingModel(drawingId);
  return <DrawletApp drawingModel={drawingModel} />;
}
