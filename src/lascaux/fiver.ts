import { DrawContext, DrawingContext, InitContext, Rect } from './Drawlet';
import {
  ADD_LAYER_EVENT,
  DRAW_END_EVENT,
  DRAW_EVENT,
  DRAW_START_EVENT,
} from './data-model/events';
import parseColor from './util/parse-color';
import { StorageModel } from './data-model/StorageModel';
import DrawingModel, { getInitializeContext } from './data-model/DrawingModel';
import { GlDrawBackend } from './webgl/gl-draw-backend';
import { Dna, DrawingMode } from './dna';

export async function createDrawingModel(
  dna: Dna,
  storage: StorageModel,
): Promise<DrawingModel> {
  // This is convoluted
  const initialMode = initializeCommand(getInitializeContext(dna));
  console.log(`[LOAD] Getting metadata...`);
  const metadata = await storage.getMetadata(initialMode);
  const drawing = new DrawingModel({
    dna,
    editable: true,
    DrawOs: GlDrawBackend,
    snapshotStrokeCount: 250,
    storageModel: storage,
    metadata,
    initializeCommand,
    handleCommand,
  });
  console.log(`[LOAD] Loading strokes...`);
  await storage.replay(drawing);
  console.log(`[LOAD] Loaded strokes!`);
  return drawing;
}

function initializeCommand(
  context: InitContext,
  canvas?: DrawingContext,
): DrawingMode {
  const {
    dna: { colors, width, height },
  } = context;
  const bg = Math.floor(context.random() * colors.length);
  if (canvas) {
    const [r, g, b] = parseColor(colors[bg]);
    canvas.fillRects([[0, 0, width, height, r, g, b, 1]]);
  }
  return {
    layers: 1,
    layer: 0,
    color: colors[(bg + 1) % colors.length],
    size: 8,
    erase: false,
    alpha: 1,
    spacing: 0.05,
    hardness: 1,
  };
}

function handleCommand(
  { dna, mode, state }: DrawContext,
  canvas: DrawingContext,
  event: string,
  payload: any,
): void {
  switch (event) {
    case ADD_LAYER_EVENT:
      canvas.addLayer();
      break;

    case DRAW_START_EVENT: {
      const { cursor, layer, alpha, hardness = 1, color, erase } = mode;
      const { x, y, pressure = 1 } = payload;
      const size = mode.size * pressure;
      const [r, g, b] = parseColor(color);
      state.size = size;
      state.a = alpha;
      state.x = x;
      state.y = y;

      // Don't draw initial point for touch so we can handle gestures
      if (cursor?.type !== 'touch') {
        canvas.setLayer(layer);
        canvas.fillEllipses(
          [[x - size / 2, y - size / 2, size, size, r, g, b, alpha]],
          hardness,
          erase,
        );
      }
      break;
    }

    case DRAW_EVENT: {
      const { color, layer, spacing = 0.05, hardness = 1 } = mode;
      const [r, g, b] = parseColor(color);

      canvas.setLayer(layer);
      const { x, y, pressure = 1 } = payload;
      const alpha = mode.alpha;
      const size = mode.size * pressure;

      let lastX = state.x;
      let lastY = state.y;
      let lastSize = state.size;
      let lastAlpha = state.a;
      let dx = x - lastX;
      let dy = y - lastY;
      let dSize = size - lastSize;
      let dAlpha = alpha - lastAlpha;
      let len = Math.sqrt(dy * dy + dx * dx);
      const step = Math.max(0.5, spacing * size);
      if (len >= step) {
        const rects: Rect[] = [];
        for (let t = step; t < len; t += step) {
          const cx = lastX + (dx * t) / len;
          const cy = lastY + (dy * t) / len;
          let cSize = lastSize + (dSize * t) / len;
          let cAlpha = lastAlpha + (dAlpha * t) / len;
          state.x = cx;
          state.y = cy;
          state.size = cSize;
          state.a = cAlpha;
          if (cSize > 0) {
            // Render ~1 pixel brushes using alpha
            if (cSize < 2) {
              cAlpha *= cSize / 2;
              cSize = 2;
            }
            rects.push([
              cx - cSize / 2,
              cy - cSize / 2,
              cSize,
              cSize,
              r,
              g,
              b,
              cAlpha,
            ]);
          }
        }
        if (rects.length > 0) {
          canvas.fillEllipses(rects, hardness, mode.erase);
        }
      }

      state.a = alpha;

      break;
    }
    case DRAW_END_EVENT:
      break;
  }
}
