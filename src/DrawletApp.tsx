import React, {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import styles from './DrawletApp.module.css';
import { useAppendChild } from './react-hooks/useAppendChild';
import classnames from 'classnames';
import 'rc-slider/assets/index.css';
import 'rc-tooltip/assets/bootstrap.css';
import Slider from 'rc-slider';
import DrawingModel from './drawlets/file-format/DrawingModel';
import { makeFiverCanvas } from './drawlets/fiver/gl';
import { UpdateObject } from './drawlets/Drawlet';
import { FiverMode } from './drawlets/fiver/fiver';
import { preventDefault } from './preventDefault';

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

export default function DrawletApp({
  drawingModel,
}: {
  drawingModel: DrawingModel;
}) {
  const drawletContainerRef = useRef<HTMLDivElement>(null);
  const [updateObjectState, setUpdateObject] = useState<UpdateObject<
    FiverMode
  > | null>(null);

  const canvasInstance = useMemo(
    () => makeFiverCanvas(drawingModel, setUpdateObject),
    [drawingModel, setUpdateObject],
  );
  const updateObject = updateObjectState || canvasInstance.getUpdateObject();
  useLayoutEffect(() => canvasInstance.subscribe(), [canvasInstance]);

  useAppendChild(drawletContainerRef, drawingModel.editCanvas.dom);

  const [tempBrushSize, setTempBrushSize] = useState<number | undefined>(
    updateObject.mode.size,
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
        const onClick = (event: React.MouseEvent | React.TouchEvent) => {
          event.preventDefault();
          canvasInstance.setMode('color', color);
        };
        const selected = color === updateObject.mode.color;
        return (
          <button
            key={index}
            onTouchStart={onClick}
            onClick={onClick}
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

  const brushSize =
    tempBrushSize === undefined ? updateObject.mode.size : tempBrushSize;
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
  const zoomSlider = useMemo(
    () => (
      <Slider
        min={0.1}
        step={0.05}
        marks={{ 1: '' }}
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
      const onClick = () => canvasInstance.setMode('layer', layer);
      array.push(
        <button
          key={i}
          className={classnames(styles.layer, {
            [styles.layerSelected]: updateObject.mode.layer === layer,
          })}
          onClick={onClick}
          onTouchStart={onClick}
        >
          Layer #{i + 1}
        </button>,
      );
    }
    return array;
  }, [updateObject.mode.layer, updateObject.mode.layers, canvasInstance]);
  return (
    <div
      className={styles.root}
      touch-action="none"
      onTouchStart={preventDefault}
    >
      <div className={styles.tools} onTouchStart={preventDefault}>
        <button
          onTouchStart={preventDefault}
          disabled={updateObject.strokeCount === 0}
          onClick={togglePlay}
        >
          {updateObject.playing ? 'Pause' : 'Play'}
        </button>
        {playbackSlider}
        <button
          onTouchStart={preventDefault}
          disabled={updateObject.undo === undefined}
          onClick={undo}
        >
          Undo
        </button>
        <button
          onTouchStart={preventDefault}
          disabled={updateObject.redo === undefined}
          onClick={redo}
        >
          Redo
        </button>
      </div>
      <div className={styles.left}>
        <div>Color</div>
        <div className={styles.colorButtons}>
          <div
            className={styles.currentColor}
            style={{ backgroundColor: updateObject.mode.color }}
          />
          {colorButtons}
        </div>
        <div>Size</div>
        {sizeSlider}
        <div>Zoom</div>
        {zoomSlider}
        <div>Layers</div>
        <div className={styles.layers}>{layers}</div>
        <button onClick={addLayer}>Add Layer</button>
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
