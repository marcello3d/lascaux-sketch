import { Dna } from '../drawos/dna';
import {
  DRAW_END_EVENT,
  DRAW_START_EVENT,
  DrawingContext,
  DrawletHandleContext,
  DrawletInitContext,
  Rect,
} from '../Drawlet';
import { ADD_LAYER_EVENT, DRAW_EVENT } from '../file-format/events';

export const name = 'fiver';
export const author = 'marcello';
export const os = 'os1';

export interface FiverDna extends Dna {
  colors: string[];
}

export function newDna(width: number = 512, height: number = 512): FiverDna {
  return {
    // TODO: should width/height be part of the drawlet?
    width,
    height,

    // Should mode-changing options be managed by drawlet os?
    colors: ['#497aa6', '#f2c063', '#f2dbce', '#a6654e', '#f2695c'],
    // TODO: move
    randomseed: Math.random().toString(36).slice(2),
  };
}
export type FiverMode = {
  layers: number;
  layer: number;
  color: string;
  size: number;
  alpha: number;
  spacing?: number;
};
export type FiverState = {
  size: number;
  a: number;
  x: number;
  y: number;
};
export function initializeCommand(
  context: DrawletInitContext<FiverDna>,
  canvas?: DrawingContext,
): FiverMode {
  const {
    dna: { colors, width, height },
  } = context;
  const bg = Math.floor(context.random() * colors.length);
  if (canvas) {
    canvas.setFillStyle(colors[bg]);
    canvas.fillRect(0, 0, width, height);
  }
  return {
    layers: 1,
    layer: 0,
    color: colors[(bg + 1) % colors.length],
    size: 8,
    alpha: 1,
  };
}

export function handleCommand(
  { dna, mode, state }: DrawletHandleContext<FiverDna, FiverMode, FiverState>,
  canvas: DrawingContext,
  event: string,
  payload: any,
): void {
  switch (event) {
    case ADD_LAYER_EVENT:
      canvas.addLayer();
      break;

    case DRAW_START_EVENT: {
      state.size = 0;
      state.a = 0;
      state.x = payload.x;
      state.y = payload.y;
      break;
    }

    case DRAW_EVENT: {
      const { color, layer, spacing = 1 } = mode;
      canvas.setFillStyle(color);
      canvas.setLayer(layer);
      const { x, y, pressure = 1 } = payload;
      const alpha = mode.alpha;
      const size = mode.size * pressure;

      canvas.setAlpha(alpha);

      let lastX = state.x;
      let lastY = state.y;
      let lastSize = state.size;
      let dx = x - lastX;
      let dy = y - lastY;
      let dSize = size - lastSize;
      let len = Math.sqrt(dy * dy + dx * dx);
      const step = Math.max(0.5, spacing * size);
      if (len >= step) {
        const rects: Rect[] = [];
        for (let t = step; t < len; t += step) {
          const cx = lastX + (dx * t) / len;
          const cy = lastY + (dy * t) / len;
          const cSize = lastSize + (dSize * t) / len;
          if (cSize > 0) {
            rects.push([cx - cSize / 2, cy - cSize / 2, cSize, cSize]);
          }
          state.x = cx;
          state.y = cy;
        }
        if (rects.length > 0) {
          canvas.fillEllipses(rects);
        }
      }

      state.size = size;
      state.a = alpha;

      break;
    }
    case DRAW_END_EVENT:
      break;
  }
}
