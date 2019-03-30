import React, { useRef } from 'react';

import useEventEffect from './react-hooks/useEventEffect';
import { Canvas2d, getCanvas2d } from './draw/canvas';
import { useAppendChild } from './react-hooks/useAppendChild';

const PointerDownEvent = 'pointerdown';
const PointerMoveEvent = 'pointermove';
const PointerUpEvent = 'pointerup';
const PointerCancelEvent = 'pointercancel';
const ContextMenuEvent = 'contextmenu';

function lerp(a: number, b: number, frac: number) {
  return a * (1 - frac) + b * frac;
}

export default function DrawingApp({ canvas2d }: { canvas2d: Canvas2d }) {
  const ref = useRef<HTMLDivElement>(null);
  type TouchState = {
    x: number;
    y: number;
    tx: number;
    ty: number;
  };
  const lastPoints: { [key: number]: TouchState } = {};
  const pixelScale = window.devicePixelRatio;
  function processPointerEvent(event: PointerEvent) {
    const { type } = event;
    const canvas = canvas2d.canvas;
    // right button
    if (event.button === 2) {
      if (type === PointerDownEvent) {
        canvas2d.undo();
      }
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
  }

  useEventEffect(document, PointerDownEvent, processPointerEvent);
  useEventEffect(document, PointerMoveEvent, processPointerEvent);
  useEventEffect(document, PointerUpEvent, processPointerEvent);
  useEventEffect(document, PointerCancelEvent, processPointerEvent);
  useEventEffect(document, ContextMenuEvent, (event: MouseEvent) => {
    event.preventDefault();
  });

  useAppendChild(ref, canvas2d.canvas);

  return (
    <div
      ref={ref}
      touch-action="none"
      style={{
        borderRadius: '10px',
        width: '100%',
        height: '100%',
        background: '#fff',
      }}
    />
  );
}
