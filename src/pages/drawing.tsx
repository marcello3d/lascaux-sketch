import { RouteComponentProps } from '@reach/router';
import React, { useCallback, useRef } from 'react';
import { DrawletApp } from '../lascaux-ui/DrawletApp';
import { useDexieItem } from '../db/useDexie';
import { db } from '../db/db';
import { DexieStorageModel, getAllStrokes } from '../db/DexieStorageModel';
import { NotFoundPage } from './404';
import { getOrMakeDrawingModel } from '../db/drawlet-cache';
import { createDrawingModel, dnaToDoc } from '../lascaux/fiver';
import { Layout } from './modules/Layout';
import { Header } from './modules/Header';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import FileDownloadIcon from '../icons/fa/file-download.svg';
import SatelliteDishIcon from '../icons/fa/satellite-dish.svg';
import { downloadFile, filenameDate } from '../ui/download';
import { LascauxDomInstance } from '../lascaux/Drawlet';
import { ExportedDrawingV1 } from '../lascaux/ExportedDrawing';

type DrawingPageProps = { drawingId?: string } & RouteComponentProps;

export function DrawingPage(props: DrawingPageProps) {
  const { drawingId } = props;
  const drawing = useDexieItem(db.drawings, drawingId);
  const canvasInstance = useRef<LascauxDomInstance>(null);

  const downloadPng = useCallback(() => {
    canvasInstance.current?.getPng().then((blob) => {
      downloadFile(blob, `Lascaux Sketch ${filenameDate()}.png`);
    });
  }, [canvasInstance]);

  const downloadJson = useCallback(async () => {
    if (!drawing) {
      return;
    }
    const drawingData: ExportedDrawingV1 = {
      version: 1,
      dna: drawing.dna,
      strokes: (await getAllStrokes(drawing.id)).map((stroke) => [
        stroke.time,
        stroke.type,
        stroke.payload,
      ]),
    };

    downloadFile(
      new Blob([JSON.stringify(drawingData)]),
      `${drawing.id}-${filenameDate()}-raw.json`,
    );
  }, [drawing]);

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
  return (
    <Layout
      header={
        <Header>
          <Button onClick={downloadPng}>
            <Icon file={FileDownloadIcon} alt="download" />
            Save PNG
          </Button>
          <Button onClick={downloadJson}>
            <Icon file={SatelliteDishIcon} alt="download" />
            Save JSON
          </Button>
        </Header>
      }
      footer={false}
    >
      <DrawletApp
        drawingId={id}
        dna={dna}
        drawingModel={drawingModel}
        lascauxDomRef={canvasInstance}
      />
    </Layout>
  );
}
