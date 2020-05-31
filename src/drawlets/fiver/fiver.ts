import { Dna } from '../drawos/dna';
import {
  DRAW_END_EVENT,
  DRAW_START_EVENT,
  DrawingContext,
  DrawletHandleContext,
  DrawletInitContext,
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
};
export type FiverState = {
  size: number;
  vx: number;
  vy: number;
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

    case DRAW_START_EVENT:
      state.size = 0;
      state.vx = 0;
      state.vy = 0;
      state.x = payload.x;
      state.y = payload.y;
      break;

    case DRAW_EVENT:
      const dragx = payload.x;
      const dragy = payload.y;
      let dx = dragx - state.x;
      let dy = dragy - state.y;
      let rad = Math.sqrt(dy * dy + dx * dx);
      const dsize = (rad > 0 ? Math.log(rad) : 0) * mode.size;
      let i = 0;
      canvas.setFillStyle(mode.color);
      canvas.setAlpha(mode.alpha);
      canvas.setLayer(mode.layer);
      const rects = new Array(100);
      let j = 0;
      const pressure = payload.pressure ?? 1;
      do {
        i++;
        if (rad > 0) {
          state.vx -= (state.vx - dx / rad) / 10;
          state.vy -= (state.vy - dy / rad) / 10;
        }
        state.x += state.vx;
        state.y += state.vy;
        state.size -= (state.size - dsize) / 10;
        dx = dragx - state.x;
        dy = dragy - state.y;
        rad = Math.sqrt(dy * dy + dx * dx);
        const size2 = Math.max(1, state.size * pressure);
        if (size2 > 0) {
          rects[j++] = [state.x - size2 / 2, state.y - size2 / 2, size2, size2];
        }
      } while (dx * dx + dy * dy > 3 * 3 && i < 100);
      rects.length = j;
      canvas.fillEllipses(rects);

      break;

    case DRAW_END_EVENT:
      break;
  }
}
