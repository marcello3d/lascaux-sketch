import React, {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import styles from './DrawletApp.module.css';
import { useAppendChild } from './react-hooks/useAppendChild';
import classNames from 'classnames';
import { Slider } from './ui/Slider';
import DrawingModel from './drawlets/file-format/DrawingModel';
import { makeFiverCanvas } from './drawlets/fiver/gl';
import { UpdateObject } from './drawlets/Drawlet';
import { FiverMode } from './drawlets/fiver/fiver';
import { Button } from './ui/Button';
import useEventEffect from './react-hooks/useEventEffect';

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

export function DrawletApp({ drawingModel }: { drawingModel: DrawingModel }) {
  const drawletContainerRef = useRef<HTMLDivElement>(null);
  const [updateObjectState, setUpdateObject] = useState<UpdateObject<
    FiverMode
  > | null>(null);

  const canvasInstance = useMemo(
    () => makeFiverCanvas(drawingModel, setUpdateObject),
    [drawingModel, setUpdateObject],
  );

  useEventEffect(
    canvasInstance.dom,
    'touchmove',
    (event: MouseEvent) => {
      event.preventDefault();
    },
    { passive: false },
  );

  const updateObject = updateObjectState || canvasInstance.getUpdateObject();
  useLayoutEffect(() => canvasInstance.subscribe(), [canvasInstance]);

  useAppendChild(drawletContainerRef, drawingModel.editCanvas.dom);

  const [tempBrushSize, setTempBrushSize] = useState<number | undefined>(
    updateObject.mode.size,
  );
  const setBrushAlpha = useCallback(
    (alpha) => {
      canvasInstance.setMode('alpha', alpha);
      setTempBrushAlpha(undefined);
    },
    [canvasInstance],
  );
  const [tempBrushAlpha, setTempBrushAlpha] = useState<number | undefined>(
    updateObject.mode.alpha,
  );
  const setBrushSize = useCallback(
    (size) => {
      canvasInstance.setMode('size', size);
      setTempBrushSize(undefined);
    },
    [canvasInstance],
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

  const brushSize = tempBrushSize ?? updateObject.mode.size;
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
    [brushSize, setBrushSize],
  );
  const brushAlpha = tempBrushAlpha ?? updateObject.mode.alpha;
  const alphaSlider = useMemo(
    () => (
      <Slider
        min={0.01}
        max={1.0}
        step={0.01}
        value={brushAlpha}
        onChange={setTempBrushAlpha}
        onAfterChange={setBrushAlpha}
      />
    ),
    [brushAlpha, setBrushAlpha],
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
  return (
    <div className={styles.root}>
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
        <label className={styles.toolLabel}>Color</label>
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
          <span className={styles.value}>{(brushAlpha * 100).toFixed(0)}%</span>
        </label>
        {alphaSlider}
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
    </div>
  );
}
