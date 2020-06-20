import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import styles from './DrawletApp.module.css';
import { useAppendChild } from './react-hooks/useAppendChild';
import classNames from 'classnames';
import { Slider } from './ui/Slider';
import { Button } from './ui/Button';
import useEventEffect from './react-hooks/useEventEffect';
import { Layout } from './ui/Layout';
import { Header } from './ui/Header';
import FileDownloadIcon from './icons/fa/file-download.svg';
import { Icon } from './ui/Icon';
import { downloadFile, filenameDate } from './ui/download';
import { LascauxDomInstance, LascauxUiState } from './lascaux/Drawlet';
import DrawingModel from './lascaux/data-model/DrawingModel';
import createLascauxDomInstance from './lascaux/browser/setup-canvas-bridge';
import { DrawingMode } from './lascaux/dna';
import { db } from './db/db';
import { newDate } from './db/fields';

const colors: readonly string[] = [
  '#ffffff', // white
  '#33ccff', // light sky-blue
  '#fddebf', // pale skin tone
  '#ffffb9', // light yellow
  '#ffff00', // yellow
  '#0000ff', // blue
  '#ff0000', // red
  '#00ff00', // green
  '#000000', // black
  '#333399', // dark sky-blue
  '#fca672', // darker skin tone
  '#feae0a', // sandstone yellow
  '#cc6600', // brownish-dark yellow
  '#420066', // dark purple-ish blue
  '#b00077', // dark magenta-ish red
  '#006666', // dark blue-ish green
];

function useUpdateMode<K extends keyof DrawingMode & string>(
  canvasInstance: LascauxDomInstance,
  updateObject: LascauxUiState,
  field: K,
): [
  DrawingMode[K],
  (newValue: DrawingMode[K]) => void,
  (newValue: DrawingMode[K]) => void,
] {
  const [tempValue, setTempValue] = useState<DrawingMode[K] | undefined>(
    updateObject.mode[field],
  );
  const setValue = useCallback(
    (alpha: DrawingMode[K]) => {
      canvasInstance.setMode(field, alpha);
      setTempValue(undefined);
    },
    [canvasInstance, field],
  );

  return [tempValue ?? updateObject.mode[field], setTempValue, setValue];
}

type Props = {
  drawingId: string;
  drawingModel: DrawingModel;
};

export function DrawletApp({ drawingId, drawingModel }: Props) {
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
      canvasInstance.getPng().then((thumbnail) => {
        return db.thumbnails.put({
          drawingId,
          thumbnail,
          updatedAt: newDate(),
        });
      });
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

  const updateObject = updateObjectState || canvasInstance.getUiState();
  useLayoutEffect(() => canvasInstance.subscribe(), [canvasInstance]);

  useAppendChild(drawletContainerRef, drawingModel.editCanvas.dom);

  const downloadPng = useCallback(() => {
    canvasInstance.getPng().then((blob) => {
      downloadFile(blob, `Lascaux Sketch ${filenameDate()}.png`);
    });
  }, [canvasInstance]);

  const [brushSize, setTempBrushSize, setBrushSize] = useUpdateMode(
    canvasInstance,
    updateObject,
    'size',
  );
  const [brushOpacity, setTempBrushOpacity, setBrushOpacity] = useUpdateMode(
    canvasInstance,
    updateObject,
    'alpha',
  );
  const [brushSpacing, setTempBrushSpacing, setBrushSpacing] = useUpdateMode(
    canvasInstance,
    updateObject,
    'spacing',
  );
  const [brushHardness, setTempBrushHardness, setBrushHardness] = useUpdateMode(
    canvasInstance,
    updateObject,
    'hardness',
  );
  const setScale = useCallback((scale) => canvasInstance.setScale(scale), [
    canvasInstance,
  ]);
  const colorButtons = useMemo(
    () =>
      colors.map((color, index) => {
        const selected = color === updateObject.mode.color;
        return (
          <Button
            key={index}
            onClick={() => canvasInstance.setMode('color', color)}
            className={styles.colorButton}
            style={{
              backgroundColor: color,
              border: selected ? 'solid 2px white' : `solid 2px ${color}`,
            }}
          />
        );
      }),
    [canvasInstance, updateObject.mode.color],
  );
  const seek = useCallback(
    (cursor: number) => {
      canvasInstance.seekTo(cursor);
    },
    [canvasInstance],
  );

  const togglePlay = useCallback(() => {
    canvasInstance.setPlaying(!updateObject.playing);
  }, [canvasInstance, updateObject.playing]);
  const addLayer = useCallback(() => {
    canvasInstance.addLayer();
  }, [canvasInstance]);
  const undo = useCallback(() => {
    if (updateObject.undo) {
      canvasInstance.addGoto(updateObject.undo);
    }
  }, [canvasInstance, updateObject.undo]);
  const redo = useCallback(() => {
    if (updateObject.redo) {
      canvasInstance.addGoto(updateObject.redo);
    }
  }, [canvasInstance, updateObject.redo]);

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
  const opacitySlider = useMemo(
    () => (
      <Slider
        min={0.01}
        max={1.0}
        step={0.01}
        value={brushOpacity}
        onChange={setTempBrushOpacity}
        onAfterChange={setBrushOpacity}
      />
    ),
    [brushOpacity, setBrushOpacity, setTempBrushOpacity],
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
        value={updateObject.transform.scale}
        onChange={setScale}
      />
    ),
    [setScale, updateObject.transform.scale],
  );
  const playbackSlider = useMemo(
    () => (
      <Slider
        min={0}
        step={1}
        max={updateObject.strokeCount}
        value={updateObject.cursor}
        onChange={seek}
        className={styles.cursorSlider}
      />
    ),
    [updateObject.strokeCount, updateObject.cursor, seek],
  );
  const layers = useMemo(() => {
    const array: React.ReactNode[] = [];
    for (let i = updateObject.mode.layers - 1; i >= 0; i--) {
      const layer = i;
      array.push(
        <Button
          key={i}
          className={classNames(styles.layer, {
            [styles.layerSelected]: updateObject.mode.layer === layer,
          })}
          onClick={() => canvasInstance.setMode('layer', layer)}
        >
          Layer #{i + 1}
        </Button>,
      );
    }
    return array;
  }, [updateObject.mode.layer, updateObject.mode.layers, canvasInstance]);

  const onEraseChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      canvasInstance.setMode('erase', event.target.checked);
    },
    [canvasInstance],
  );
  return (
    <Layout
      header={
        <Header>
          <button onClick={downloadPng}>
            <Icon file={FileDownloadIcon} alt="download" />
            Save PNG
          </button>
        </Header>
      }
      className={styles.root}
    >
      <div className={styles.tools}>
        <Button disabled={updateObject.strokeCount === 0} onClick={togglePlay}>
          {updateObject.playing ? 'Pause' : 'Play'}
        </Button>
        {playbackSlider}
        <Button disabled={updateObject.undo === undefined} onClick={undo}>
          Undo
        </Button>
        <Button disabled={updateObject.redo === undefined} onClick={redo}>
          Redo
        </Button>
      </div>
      <div className={styles.left}>
        <div>
          <label className={styles.toolLabel}>Color</label>
          <label className={styles.value}>
            <input
              type="checkbox"
              checked={updateObject.mode.erase}
              onChange={onEraseChange}
            />{' '}
            Erase
          </label>
        </div>
        <div className={styles.colorButtons}>
          <div
            className={styles.currentColor}
            style={{ backgroundColor: updateObject.mode.color }}
          />
          {colorButtons}
        </div>
        <label className={styles.toolLabel}>
          Size <span className={styles.value}>{brushSize}</span>
        </label>
        {sizeSlider}
        <label className={styles.toolLabel}>
          Opacity{' '}
          <span className={styles.value}>
            {(brushOpacity * 100).toFixed(0)}%
          </span>
        </label>
        {opacitySlider}
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
            {(updateObject.transform.scale * 100).toFixed(0)}%
          </span>
        </label>
        {zoomSlider}
        <label className={styles.toolLabel}>Layers</label>
        <label className={styles.layers}>{layers}</label>
        <Button onClick={addLayer}>Add Layer</Button>
        <label className={styles.toolLabel}>Diagnostics</label>
        <label className={styles.diagInfo}>{canvasInstance.getInfo()}</label>
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
