import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import styles from './DrawletApp.module.css';
import { useAppendChild } from '../react-hooks/useAppendChild';
import { Slider } from '../ui/Slider';
import { Button } from '../ui/Button';
import useEventEffect from '../react-hooks/useEventEffect';
import { Layout } from '../pages/modules/Layout';
import { Header } from '../pages/modules/Header';
import FileDownloadIcon from '../icons/fa/file-download.svg';
import { Icon } from '../ui/Icon';
import { downloadFile, filenameDate } from '../ui/download';
import { LascauxDomInstance, LascauxUiState } from '../lascaux/Drawlet';
import DrawingModel from '../lascaux/data-model/DrawingModel';
import createLascauxDomInstance from '../lascaux/browser/setup-canvas-bridge';
import { db } from '../db/db';
import { newDate, newId } from '../db/fields';

import LayerPlusIcon from '../icons/fa/layer-plus.svg';
import PlayIcon from '../icons/fa/play.svg';
import PauseIcon from '../icons/fa/pause.svg';
import UndoIcon from '../icons/fa/undo.svg';
import RedoIcon from '../icons/fa/redo.svg';
import SatelliteDishIcon from '../icons/fa/satellite-dish.svg';
import { addLayer } from '../lascaux/DrawingDocUtil';
import { Brush, Color, Dna, UserMode } from '../lascaux/DrawingDoc';
import { LayerList } from './LayerList';
import { ColorChooser } from './ColorChooser';
import { ExportedDrawingV1 } from '../lascaux/ExportedDrawing';
import { getAllStrokes } from '../db/DexieStorageModel';

function useUpdateBrush<K extends keyof Brush & string>(
  canvasInstance: LascauxDomInstance,
  { brush, brushes }: UserMode,
  field: K,
): [Brush[K], (newValue: Brush[K]) => void, (newValue: Brush[K]) => void] {
  const value = brushes[brush][field];
  const [tempValue, setTempValue] = useState<Brush[K] | undefined>(value);
  const setValue = useCallback(
    (alpha: Brush[K]) => {
      canvasInstance.mutateMode((draft) => {
        draft.brushes[brush][field] = alpha;
      });
      setTempValue(undefined);
    },
    [canvasInstance, field, brush],
  );

  return [tempValue ?? value, setTempValue, setValue];
}

type Props = {
  drawingId: string;
  dna: Dna;
  drawingModel: DrawingModel;
};

export function DrawletApp({ drawingId, dna, drawingModel }: Props) {
  const drawletContainerRef = useRef<HTMLDivElement>(null);
  const [updateObjectState, setUpdateObject] = useState<LascauxUiState | null>(
    null,
  );

  const canvasInstance = useMemo(
    () => createLascauxDomInstance(drawingModel, setUpdateObject),
    [drawingModel],
  );

  useEffect(() => {
    return () => {
      canvasInstance.getPng().then((thumbnail) =>
        db.thumbnails.put({
          drawingId,
          thumbnail,
          updatedAt: newDate(),
        }),
      );
    };
  }, [canvasInstance, drawingId]);
  useEventEffect(
    canvasInstance.dom,
    'touchmove',
    (event: MouseEvent) => {
      event.preventDefault();
    },
    { passive: false },
  );

  const {
    artboard,
    mode,
    redo,
    cursor,
    transform,
    playing,
    undo,
    strokeCount,
  } = updateObjectState || canvasInstance.getUiState();

  useLayoutEffect(() => canvasInstance.subscribe(), [canvasInstance]);

  useAppendChild(drawletContainerRef, drawingModel.editCanvas.dom);

  const downloadPng = useCallback(() => {
    canvasInstance.getPng().then((blob) => {
      downloadFile(blob, `Lascaux Sketch ${filenameDate()}.png`);
    });
  }, [canvasInstance]);

  const [brushSize, setTempBrushSize, setBrushSize] = useUpdateBrush(
    canvasInstance,
    mode,
    'size',
  );
  const [brushFlow, setTempBrushFlow, setBrushFlow] = useUpdateBrush(
    canvasInstance,
    mode,
    'flow',
  );
  const [brushSpacing, setTempBrushSpacing, setBrushSpacing] = useUpdateBrush(
    canvasInstance,
    mode,
    'spacing',
  );
  const [
    brushHardness,
    setTempBrushHardness,
    setBrushHardness,
  ] = useUpdateBrush(canvasInstance, mode, 'hardness');
  const setScale = useCallback((scale) => canvasInstance.setScale(scale), [
    canvasInstance,
  ]);

  const seek = useCallback(
    (cursor: number) => {
      canvasInstance.seekTo(cursor);
    },
    [canvasInstance],
  );

  const togglePlay = useCallback(() => {
    canvasInstance.setPlaying(!playing);
  }, [canvasInstance, playing]);
  const onAddLayer = useCallback(() => {
    const newLayerId = newId();
    canvasInstance.mutateArtboard((draft) => {
      addLayer(draft, newLayerId);
    });
    canvasInstance.mutateMode((draft) => {
      draft.layer = newLayerId;
    });
  }, [canvasInstance]);
  const onUndo = useCallback(() => {
    if (undo) {
      canvasInstance.addGoto(undo);
    }
  }, [canvasInstance, undo]);
  const onRedo = useCallback(() => {
    if (redo) {
      canvasInstance.addGoto(redo);
    }
  }, [canvasInstance, redo]);

  const sizeSlider = useMemo(
    () => (
      <Slider
        min={1}
        max={100}
        value={brushSize}
        onChange={setTempBrushSize}
        onAfterChange={setBrushSize}
      />
    ),
    [brushSize, setBrushSize, setTempBrushSize],
  );
  const flowSlider = useMemo(
    () => (
      <Slider
        min={0.01}
        max={1.0}
        step={0.01}
        value={brushFlow}
        onChange={setTempBrushFlow}
        onAfterChange={setBrushFlow}
      />
    ),
    [brushFlow, setBrushFlow, setTempBrushFlow],
  );
  const spacingSlider = useMemo(
    () => (
      <Slider
        min={0.005}
        max={0.25}
        step={0.005}
        value={brushSpacing}
        onChange={setTempBrushSpacing}
        onAfterChange={setBrushSpacing}
      />
    ),
    [brushSpacing, setBrushSpacing, setTempBrushSpacing],
  );
  const hardnessSlider = useMemo(
    () => (
      <Slider
        min={0.0}
        max={1.0}
        step={0.01}
        value={brushHardness}
        onChange={setTempBrushHardness}
        onAfterChange={setBrushHardness}
      />
    ),
    [brushHardness, setBrushHardness, setTempBrushHardness],
  );
  const zoomSlider = useMemo(
    () => (
      <Slider
        min={0.1}
        step={0.05}
        marks={[1]}
        max={5}
        value={transform.scale}
        onChange={setScale}
      />
    ),
    [setScale, transform.scale],
  );
  const playbackSlider = useMemo(
    () => (
      <Slider
        min={0}
        step={1}
        max={strokeCount}
        value={cursor}
        onChange={seek}
        className={styles.cursorSlider}
      />
    ),
    [strokeCount, cursor, seek],
  );

  const onSelectLayer = useCallback(
    (layerId: string) => {
      canvasInstance.mutateMode((draft) => {
        draft.layer = layerId;
      });
    },
    [canvasInstance],
  );
  const onRenameLayer = useCallback(
    (layerId: string, newName: string) => {
      canvasInstance.mutateArtboard((draft) => {
        draft.layers[layerId].name = newName;
      });
    },
    [canvasInstance],
  );
  const onEraseChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      canvasInstance.mutateMode((draft) => {
        draft.brushes[draft.brush].mode = event.target.checked
          ? 'erase'
          : 'paint';
      });
    },
    [canvasInstance],
  );

  const onChangeColor = useCallback(
    (color: Color) =>
      canvasInstance.mutateMode((draft) => {
        draft.color = color;
      }),
    [canvasInstance],
  );
  const brush = mode.brushes[mode.brush];

  const downloadJson = useCallback(async () => {
    const drawingData: ExportedDrawingV1 = {
      version: 1,
      dna,
      strokes: (await getAllStrokes(drawingId)).map((stroke) => [
        stroke.time,
        stroke.type,
        stroke.payload,
      ]),
    };

    downloadFile(
      new Blob([JSON.stringify(drawingData)]),
      `${drawingId}-${filenameDate()}-raw.json`,
    );
  }, [dna, drawingId]);

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
      className={styles.root}
    >
      <div className={styles.tools}>
        <Button disabled={strokeCount === 0} onClick={togglePlay}>
          <Icon
            file={playing ? PauseIcon : PlayIcon}
            alt={playing ? 'Pause' : 'Play'}
          />
        </Button>
        {playbackSlider}
        <Button disabled={undo === undefined} onClick={onUndo}>
          <Icon file={UndoIcon} alt="Undo icon" />
          Undo
        </Button>
        <Button disabled={redo === undefined} onClick={onRedo}>
          <Icon file={RedoIcon} alt="Redo icon" />
          Redo
        </Button>
      </div>
      <div className={styles.left}>
        <div>
          <label className={styles.toolLabel}>Color</label>
          <label className={styles.value}>
            <input
              type="checkbox"
              checked={brush.mode === 'erase'}
              onChange={onEraseChange}
            />{' '}
            Erase
          </label>
        </div>
        <ColorChooser color={mode.color} onChangeColor={onChangeColor} />
        <label className={styles.toolLabel}>
          Size <span className={styles.value}>{brushSize}</span>
        </label>
        {sizeSlider}
        <label className={styles.toolLabel}>
          Opacity{' '}
          <span className={styles.value}>{(brushFlow * 100).toFixed(0)}%</span>
        </label>
        {flowSlider}
        <label className={styles.toolLabel}>
          Spacing{' '}
          <span className={styles.value}>{brushSpacing.toFixed(2)}x</span>
        </label>
        {spacingSlider}
        <label className={styles.toolLabel}>
          Hardness{' '}
          <span className={styles.value}>
            {(brushHardness * 100).toFixed(0)}%
          </span>
        </label>
        {hardnessSlider}
        <label className={styles.toolLabel}>
          Zoom{' '}
          <span className={styles.value}>
            {(transform.scale * 100).toFixed(0)}%
          </span>
        </label>
        {zoomSlider}
        <label className={styles.toolLabel}>Layers</label>
        <span className={styles.layers}>
          <LayerList
            ids={artboard.rootLayers}
            artboard={artboard}
            mode={mode}
            onSelectLayer={onSelectLayer}
            onRenameLayer={onRenameLayer}
          />
        </span>
        <Button onClick={onAddLayer}>
          <Icon file={LayerPlusIcon} alt="Layer plus icon" />
          Add Layer
        </Button>
        <label className={styles.toolLabel}>Diagnostics</label>
        <p className={styles.diagInfo}>{canvasInstance.getInfo()}</p>
        <p>
          build{' '}
          <a
            href={`https://github.com/marcello3d/lascaux-sketch/commit/${process.env.REACT_APP_GIT_SHA}`}
          >
            {(process.env.REACT_APP_GIT_SHA ?? 'unknown').slice(0, 8)}
          </a>
        </p>
      </div>
      <div
        ref={drawletContainerRef}
        touch-action="none"
        className={styles.canvasContainer}
      />
      <div className={styles.right} />
      <div className={styles.status} />
    </Layout>
  );
}
