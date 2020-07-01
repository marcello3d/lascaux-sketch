import { DrawContext, DrawingContext, Rect } from './Drawlet';
import {
  DRAW_END_EVENT,
  DRAW_EVENT,
  DRAW_START_EVENT,
} from './data-model/events';
import parseColor from './util/parse-color';
import { StorageModel } from './data-model/StorageModel';
import DrawingModel from './data-model/DrawingModel';
import { GlDrawBackend } from './webgl/gl-draw-backend';
import { handleLegacyEvent, LegacyDna } from './legacy-model';
import { Color, DrawingDoc, ROOT_USER } from './DrawingDoc';
import seedrandom from 'seedrandom';

export async function createLegacyDnaDrawingModel(
  dna: LegacyDna,
  storage: StorageModel,
): Promise<DrawingModel> {
  // This is convoluted
  const doc = dnaToDoc(dna);
  console.log(`[LOAD] Getting metadata...`);
  const metadata = await storage.getMetadata(doc);
  const drawing = new DrawingModel({
    doc,
    editable: true,
    DrawOs: GlDrawBackend,
    snapshotStrokeCount: 250,
    storageModel: storage,
    metadata,
    handleCommand,
  });
  console.log(`[LOAD] Loading strokes...`);
  await storage.replay(drawing);
  console.log(`[LOAD] Loaded strokes!`);
  return drawing;
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
          x: 0,
          y: 0,
          opacity: 1,
        },
      },
    },
    users: {
      [ROOT_USER]: {
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
    },
  };
}

function dnaToDoc(dna: LegacyDna): DrawingDoc {
  const { width, height, colors, randomseed } = dna;
  const random = seedrandom(randomseed + 0);
  const bg = Math.floor(random() * colors.length);
  const baseColor = parseColor(colors[bg]);
  const brushColor = parseColor(colors[(bg + 1) % colors.length]);
  return newDoc(width, height, baseColor, brushColor);
}

function handleCommand(
  { doc, user, state }: DrawContext,
  canvas: DrawingContext,
  event: string,
  payload: any,
): DrawingDoc {
  const legacy = handleLegacyEvent(doc, user, event, payload);
  if (legacy) {
    return legacy;
  }
  const mode = doc.users[user];
  const brush = mode.brushes[mode.brush];
  const {
    cursor,
    layer,
    color: [r, g, b, a],
  } = mode;
  const { hardness, spacing, size } = brush;
  const erase = brush.mode === 'erase';
  canvas.setLayer(layer);

  switch (event) {
    case DRAW_START_EVENT: {
      const { x, y, pressure = 1 } = payload;
      const pSize = size * pressure;
      state.size = pSize;
      state.a = a;
      state.x = x;
      state.y = y;

      // Don't draw initial point for touch so we can handle gestures
      if (cursor?.type !== 'touch') {
        canvas.fillEllipses(
          [[x - pSize / 2, y - pSize / 2, pSize, pSize, r, g, b, a]],
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
      let dAlpha = a - lastAlpha;
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
          canvas.fillEllipses(rects, hardness, erase);
        }
      }
      break;
    }
    case DRAW_END_EVENT:
      break;
  }
  return doc;
}
