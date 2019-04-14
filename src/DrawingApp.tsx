import React, { useRef, useCallback } from 'react';

import styles from './DrawingApp.module.css';

import useComponentSize from '@rehooks/component-size';
import useEventEffect from './react-hooks/useEventEffect';
import { Canvas2d, getCanvas2d } from './draw/canvas';
import { useAppendChild } from './react-hooks/useAppendChild';
import { containInBox } from './draw/fit';

const PointerDownEvent = 'pointerdown';
const PointerMoveEvent = 'pointermove';
const PointerUpEvent = 'pointerup';
const PointerCancelEvent = 'pointercancel';
const ContextMenuEvent = 'contextmenu';

function lerp(a: number, b: number, frac: number) {
  return a * (1 - frac) + b * frac;
}

export default function DrawingApp({ canvas2d }: { canvas2d: Canvas2d }) {
  const drawingAppRef = useRef<HTMLDivElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  type TouchState = {
    x: number;
    y: number;
    tx: number;
    ty: number;
  };
  const lastPoints: { [key: number]: TouchState } = {};
  const pixelScale = window.devicePixelRatio;
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
        lastPoints[pointerId] = {
          x: canvasX,
          y: canvasY,
          tx: tiltX,
          ty: tiltY,
        };
      } else if (!lastPoints[pointerId]) {
        return;
      }
      const { x, y, tx, ty } = lastPoints[pointerId];
      canvas2d.fillStyle = `rgba(0,0,0,${pressure})`;
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
      for (let t = 0; t <= d; t += 0.3) {
        const frac = t / d;
        const baseX = lerp(x, canvasX, frac);
        const baseY = lerp(y, canvasY, frac);
        const rnd = Math.random();
        const r = 40 * rnd * rnd;
        canvas2d.fillRect(
          baseX +
            r * Math.sin((tiltX * Math.PI) / 180) +
            Math.random() * 2 -
            1 -
            1,
          baseY +
            r * Math.sin((tiltY * Math.PI) / 180) +
            Math.random() * 2 -
            1 -
            1,
          2,
          2,
        );
      }
      if (type === PointerUpEvent || type === PointerCancelEvent) {
        delete lastPoints[pointerId];
      } else {
        lastPoints[pointerId] = {
          x: canvasX,
          y: canvasY,
          tx: tiltX,
          ty: tiltY,
        };
      }
    },
    [canvas2d],
  );

  useEventEffect(document, PointerDownEvent, processPointerEvent);
  useEventEffect(document, PointerMoveEvent, processPointerEvent);
  useEventEffect(document, PointerUpEvent, processPointerEvent);
  useEventEffect(document, PointerCancelEvent, processPointerEvent);
  useEventEffect(document, ContextMenuEvent, (event: MouseEvent) => {
    event.preventDefault();
  });

  useAppendChild(canvasContainerRef, canvas2d.canvas);
  const size = useComponentSize(drawingAppRef);

  const [width, height] = containInBox(
    canvas2d.width,
    canvas2d.height,
    size.width,
    size.height,
  );

  return (
    <div className={styles.root}>
      <div className={styles.tools}>
        <button onClick={() => canvas2d.undo()}>Undo</button>
        <button disabled>Redo</button>
      </div>
      <div className={styles.left}>
        <div>Color</div>
        <div>Size</div>
      </div>
      <div ref={drawingAppRef} className={styles.canvas}>
        <div
          ref={canvasContainerRef}
          touch-action="none"
          style={{
            maxWidth: `${width}px`,
            maxHeight: `${height}px`,
            background: '#fff',
          }}
        />
      </div>
      <div className={styles.right} />
      <div className={styles.status}>Status</div>
    </div>
  );
}
