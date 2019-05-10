import React, {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import styles from './DrawingApp2.module.css';
import { useAppendChild } from './react-hooks/useAppendChild';

import 'rc-slider/assets/index.css';
import 'rc-tooltip/assets/bootstrap.css';
import Slider from 'rc-slider';
import DrawingModel from './drawlets/file-format/DrawingModel';
import { makeFiverCanvas } from './drawlets/fiver/gl';
import { UpdateObject } from './drawlets/Drawlet';
import { FiverMode } from './drawlets/fiver/fiver';

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

  const setBrushSize = useCallback(
    (size) => canvasInstance.setMode('size', size),
    [canvasInstance],
  );
  const setScale = useCallback((scale) => canvasInstance.setScale(scale), [
    canvasInstance,
  ]);
  const colorButtons = useMemo(
    () =>
      colors.map((color, index) => {
        const onClick = () => canvasInstance.setMode('color', color);
        return (
          <button
            key={index}
            onPointerDown={onClick}
            style={{
              width: '30px',
              height: '30px',
              backgroundColor: color,
              border:
                color === updateObject.mode.color
                  ? 'solid 2px white'
                  : `solid 2px ${color}`,
            }}
          />
        );
      }),
    [canvasInstance, updateObject.mode.color],
  );
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

  return (
    <div className={styles.root}>
      <div className={styles.tools}>
        <button disabled={updateObject.undo === undefined} onClick={undo}>
          Undo
        </button>
        <button disabled={updateObject.redo === undefined} onClick={redo}>
          Redo
        </button>
      </div>
      <div className={styles.left}>
        <div>Color</div>
        {colorButtons}
        <div>Size</div>
        <Slider
          min={1}
          max={100}
          value={updateObject.mode.size}
          onChange={setBrushSize}
        />
        <div>Zoom</div>
        <Slider
          min={10}
          marks={{ 10: '10%', 100: '100%', 500: '500%' }}
          max={500}
          value={updateObject.transform.scale}
          onChange={setScale}
        />
        <pre>{JSON.stringify(updateObject, null, 2)}</pre>
      </div>
      <div ref={drawletContainerRef} className={styles.canvasContainer} />
      <div className={styles.right} />
      <div className={styles.status} />
    </div>
  );
}
