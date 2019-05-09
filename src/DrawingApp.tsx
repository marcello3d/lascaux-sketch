import React, { useCallback, useMemo, useRef, useState } from 'react';

import styles from './DrawingApp.module.css';

import useComponentSize from '@rehooks/component-size';
import useEventEffect from './react-hooks/useEventEffect';
import { Canvas2d } from './draw/canvas';
import { useAppendChild } from './react-hooks/useAppendChild';

import 'rc-slider/assets/index.css';
import 'rc-tooltip/assets/bootstrap.css';
import Slider from 'rc-slider';

const PointerDownEvent = 'pointerdown';
const PointerMoveEvent = 'pointermove';
const PointerUpEvent = 'pointerup';
const PointerCancelEvent = 'pointercancel';
const ContextMenuEvent = 'contextmenu';

function lerp(a: number, b: number, frac: number) {
  return a * (1 - frac) + b * frac;
}

const colors: ReadonlyArray<string> = [
  0xffffff, // white
  0x33ccff, // light sky-blue
  0xfddebf, // pale skin tone
  0xffffb9, // light yellow
  0xffff00, // yellow
  0x0000ff, // blue
  0xff0000, // red
  0x00ff00, // green
  0x000000, // black
  0x333399, // dark sky-blue
  0xfca672, // darker skin tone
  0xfeae0a, // sandstone yellow
  0xcc6600, // brownish-dark yellow
  0x420066, // dark purple-ish blue
  0xb00077, // dark magenta-ish red
  0x006666, // dark blue-ish green
].map((color) => {
  const red = (color & 0xff0000) >> 16;
  const green = (color & 0x00ff00) >> 8;
  const blue = color & 0xff;
  return `${red},${green},${blue}`;
});

export default function DrawingApp({ canvas2d }: { canvas2d: Canvas2d }) {
  const [brushColor, setBrushColor] = useState('0,0,0');
  const [brushSize, setBrushSize] = useState(2);
  const [zoom, setZoom] = useState(100);
  const drawingAppRef = useRef<HTMLDivElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  type TouchState = {
    x: number;
    y: number;
    tx: number;
    ty: number;
  };
  const lastPoints = useRef<{ [key: number]: TouchState }>({});
  // const pixelScale = window.devicePixelRatio;
  const processPointerEvent = useCallback(
    (event: PointerEvent) => {
      const { type } = event;
      const canvas = canvas2d.canvas;
      // right button
      if (event.button === 2) {
        return;
      }
      if (type === PointerDownEvent) {
        canvas2d.snapshot();
      }
      const rect = canvas.getBoundingClientRect();
      const {
        clientX,
        clientY,
        pointerId,
        pressure = 0,
        tiltX = 0,
        tiltY = 0,
      } = event;

      const canvasX = ((clientX - rect.left) / rect.width) * canvas.width;
      const canvasY = ((clientY - rect.top) / rect.height) * canvas.height;
      if (type === PointerDownEvent) {
        lastPoints.current[pointerId] = {
          x: canvasX,
          y: canvasY,
          tx: tiltX,
          ty: tiltY,
        };
      } else if (!lastPoints.current[pointerId]) {
        return;
      }
      const { x, y } = lastPoints.current[pointerId];
      canvas2d.fillStyle = `rgba(${brushColor},${pressure})`;
      // context.beginPath();
      // context.moveTo(x, y);
      // context.lineTo(x + tx, y + ty);
      // context.lineTo(canvasX + tiltX, canvasY + tiltY);
      // context.lineTo(canvasX, canvasY);
      // context.closePath();
      // context.fill();
      const dx = canvasX - x;
      const dy = canvasY - y;
      const d = Math.sqrt(dx * dx + dy * dy);
      for (let t = 0; t <= d; t += (0.3 * brushSize) / 2) {
        const frac = t / d;
        const baseX = lerp(x, canvasX, frac);
        const baseY = lerp(y, canvasY, frac);
        const rnd = Math.random();
        const r = 40 * rnd * rnd;
        const theta = Math.random() * Math.PI * 2;
        const rr = (Math.random() * brushSize) / 3;
        canvas2d.fillRect(
          baseX +
            r * Math.sin((tiltX * Math.PI) / 180) +
            rr * Math.cos(theta) -
            brushSize / 2,
          baseY +
            r * Math.sin((tiltY * Math.PI) / 180) +
            rr * Math.sin(theta) -
            brushSize / 2,
          brushSize,
          brushSize,
        );
      }
      if (type === PointerUpEvent || type === PointerCancelEvent) {
        delete lastPoints.current[pointerId];
      } else {
        lastPoints.current[pointerId] = {
          x: canvasX,
          y: canvasY,
          tx: tiltX,
          ty: tiltY,
        };
      }
    },
    [lastPoints, canvas2d, brushColor, brushSize],
  );

  useEventEffect(drawingAppRef, PointerDownEvent, processPointerEvent);
  useEventEffect(drawingAppRef, PointerMoveEvent, processPointerEvent);
  useEventEffect(drawingAppRef, PointerUpEvent, processPointerEvent);
  useEventEffect(drawingAppRef, PointerCancelEvent, processPointerEvent);
  useEventEffect(drawingAppRef, ContextMenuEvent, (event: MouseEvent) => {
    event.preventDefault();
  });

  useAppendChild(canvasContainerRef, canvas2d.canvas);
  const size = useComponentSize(drawingAppRef);
  const zoomedWidth = (canvas2d.width * zoom) / 100;
  const zoomedHeight = (canvas2d.height * zoom) / 100;
  const marginLeft = Math.max(0, (size.width - zoomedWidth) / 2);
  const marginTop = Math.max(0, (size.height - zoomedHeight) / 2);

  const colorButtons = useMemo(
    () =>
      colors.map((color, index) => {
        const onClick = () => setBrushColor(color);
        return (
          <button
            key={index}
            onClick={onClick}
            onPointerDown={onClick}
            style={{
              width: '30px',
              height: '30px',
              backgroundColor: `rgb(${color})`,
              border:
                color === brushColor
                  ? 'solid 2px white'
                  : `solid 2px rgb(${color})`,
            }}
          />
        );
      }),
    [brushColor],
  );

  const canvasStyle = useMemo(
    () => ({
      width: `${zoomedWidth}px`,
      height: `${zoomedHeight}px`,
      marginLeft: `${marginLeft}px`,
      marginTop: `${marginTop}px`,
    }),
    [zoomedWidth, zoomedHeight, marginLeft, marginTop],
  );
  return (
    <div className={styles.root}
         touch-action="none">
      <div className={styles.tools}>
        <button onClick={() => canvas2d.undo()}>Undo</button>
        <button disabled>Redo</button>
      </div>
      <div className={styles.left}>
        <div>Color</div>
        {colorButtons}
        <div>Size</div>
        <Slider min={1} max={100} value={brushSize} onChange={setBrushSize} />
        <div>Zoom</div>
        <Slider
          min={10}
          marks={{ 10: '10%', 100: '100%', 500: '500%' }}
          max={500}
          value={zoom}
          onChange={setZoom}
        />
      </div>
      <div ref={drawingAppRef} className={styles.canvasContainer}>
        <div
          ref={canvasContainerRef}
          touch-action="none"
          className={styles.canvas}
          style={canvasStyle}
        />
      </div>
      <div className={styles.right} />
      <div className={styles.status} />
    </div>
  );
}
