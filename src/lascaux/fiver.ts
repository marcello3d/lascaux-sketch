import { DrawingContext, Rect } from './Drawlet';
import {
  DRAW_END_EVENT,
  DRAW_EVENT,
  DRAW_START_EVENT,
} from './data-model/events';
import parseColor from './util/parse-color';
import { StorageModel } from './data-model/StorageModel';
import DrawingModel from './data-model/DrawingModel';
import { DrawingState, isLegacyDna } from './legacy-model';
import { Color, Dna, DrawingDoc, UserMode } from './DrawingDoc';
import seedrandom from 'seedrandom';

export async function createDrawingModel(
  doc: DrawingDoc,
  storage: StorageModel,
) {
  const drawing = new DrawingModel({
    doc,
    editable: true,
    snapshotStrokeCount: 250,
    storageModel: storage,
    handleCommand,
  });
  console.log(`[LOAD] Loading strokes...`);
  await storage.replay(drawing);
  console.log(`[LOAD] Loaded strokes!`);
  return drawing;
}

export async function createLegacyDnaDrawingModel(
  dna: Dna,
  storage: StorageModel,
): Promise<DrawingModel> {
  return await createDrawingModel(dnaToDoc(dna), storage);
}

const FIVER_BRUSH = 'fiver';

export function newDoc(
  width: number,
  height: number,
  baseColor: Color = parseColor('#fff4e8'),
  brushColor: Color = parseColor('#631c1c'),
): DrawingDoc {
  return {
    artboard: {
      width,
      height,
      baseColor,
      rootLayers: ['0'],
      layers: {
        '0': {
          type: 'image',
        },
      },
    },
    mode: {
      layer: '0',
      color: brushColor,
      brush: FIVER_BRUSH,
      brushes: {
        [FIVER_BRUSH]: {
          mode: 'paint',
          size: 8,
          opacity: 1.0,
          flow: 1.0,
          spacing: 0.05,
          hardness: 1.0,
        },
      },
    },
  };
}

function legacyDnaToDoc(
  dna: Dna & { randomseed: string; colors: string[] },
  width: number,
  height: number,
) {
  const { colors, randomseed } = dna;
  const random = seedrandom(randomseed + 0);
  const bg = Math.floor(random() * colors.length);
  const baseColor = parseColor(colors[bg]);
  const brushColor = parseColor(colors[(bg + 1) % colors.length]);
  return newDoc(width, height, baseColor, brushColor);
}

export function dnaToDoc(dna: Dna): DrawingDoc {
  const { width, height } = dna;
  if (isLegacyDna(dna)) {
    return legacyDnaToDoc(dna, width, height);
  }
  return newDoc(width, height);
}

function handleCommand(
  mode: UserMode,
  state: DrawingState,
  ctx: DrawingContext,
  event: string,
  payload: any,
): void {
  const brush = mode.brushes[mode.brush];
  const {
    cursor,
    layer,
    color: [r, g, b],
  } = mode;
  const { hardness, spacing, size, flow } = brush;
  const erase = brush.mode === 'erase';
  switch (event) {
    case DRAW_START_EVENT: {
      const { x, y, pressure = 1 } = payload;
      const pSize = size * pressure;
      state.size = pSize;
      state.a = flow;
      state.x = x;
      state.y = y;

      // Don't draw initial point for touch so we can handle gestures
      if (cursor?.type !== 'touch') {
        ctx.fillEllipses(
          layer,
          [[x - pSize / 2, y - pSize / 2, pSize, pSize, r, g, b, flow]],
          hardness,
          erase,
        );
      }
      break;
    }

    case DRAW_EVENT: {
      const { x, y, pressure = 1 } = payload;
      const pSize = size * pressure;

      let lastX = state.x;
      let lastY = state.y;
      let lastSize = state.size;
      let lastAlpha = state.a;
      let dx = x - lastX;
      let dy = y - lastY;
      let dSize = pSize - lastSize;
      let dAlpha = flow - lastAlpha;
      let len = Math.sqrt(dy * dy + dx * dx);
      const step = Math.max(0.5, spacing * pSize);
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
          ctx.fillEllipses(layer, rects, hardness, erase);
        }
      }
      break;
    }
    case DRAW_END_EVENT:
      break;
  }
}
