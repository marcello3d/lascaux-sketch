import { DRAW_START_EVENT, DRAW_EVENT } from './events';

import lineGenerator from 'bresenham/generator';
import AsciiCanvas from './ascii-canvas';
import BaseDrawOs from '../drawos/base-drawos';

export class DrawOs extends BaseDrawOs {
  constructor(dna, scale = 1, tileSize = 4) {
    super(dna, scale, tileSize);
  }

  _makeCanvas(width, height, scale) {
    return new AsciiCanvas(width, height);
  }

  initialize() {
    this.canvas.reset();
  }

  getDrawingContext() {
    return {
      drawPoint: (x, y, color) => {
        this._setPixel(x, y, color);
      },
      drawLine: (x1, y1, x2, y2, color) => {
        for (const { x, y } of lineGenerator(x1, y1, x2, y2)) {
          console.log(`line ${x1},${y1} to ${x2},${y2}:  ${x},${y}`);
          this.canvas.setPixel(x, y, color);
        }
        const minx = Math.min(x1, x2);
        const miny = Math.min(y1, y2);
        const width = Math.abs(x1 - x2) + 1;
        const height = Math.abs(y1 - y2) + 1;

        this.saveRect(minx, miny, width, height);
      },
    };
  }

  _setPixel(x, y, color) {
    if (this.canvas.setPixel(x, y, color)) {
      this.saveRect(x, y, 1, 1);
    }
  }

  _getTile(x, y, w, h) {
    return this.canvas.getPixels(x, y, w, h);
  }

  _putTile(x, y, w, h, data, callback) {
    this.canvas.putPixels(x, y, w, h, data);
    callback();
  }

  toDataUrl() {
    return this.canvas.toString();
  }
}

export function initializeCommand({ random }) {
  return {
    random: random(),
    color: 'R',
  };
}

export function handleCommand({ state, mode }, canvas, event, payload) {
  switch (event) {
    case DRAW_START_EVENT:
      canvas.drawPoint(payload.x, payload.y, mode.color);
      state.x = payload.x;
      state.y = payload.y;
      break;
    case DRAW_EVENT:
      canvas.drawLine(state.x, state.y, payload.x, payload.y, mode.color);
      state.x = payload.x;
      state.y = payload.y;
      break;
  }
}
