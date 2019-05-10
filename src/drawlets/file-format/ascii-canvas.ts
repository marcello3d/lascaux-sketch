export default class AsciiCanvas {
  private _width: number;
  private _height: number;
  private _canvas: string[];
  constructor(width: number, height: number) {
    this._width = width;
    this._height = height;
    this._canvas = new Array(width * height);
    this.reset();
  }

  reset() {
    for (let i = 0; i < this._canvas.length; i++) {
      this._canvas[i] = '-';
    }
  }

  setPixel(x: number, y: number, color: string) {
    if (x < 0 || y < 0 || x >= this._width || y >= this._height) {
      return false;
    }
    if (color.length !== 1) {
      throw new Error(`invalid color: ${color}`);
    }
    const index = x + y * this._width;
    if (this._canvas[index] !== color) {
      this._canvas[index] = color;
      return true;
    }
    return false;
  }

  getPixel(x: number, y: number) {
    if (x < 0 || y < 0 || x >= this._width || y >= this._height) {
      return undefined;
    }
    return this._canvas[x + y * this._width];
  }

  getPixels(x: number, y: number, w: number, h: number): string {
    if (
      x < 0 ||
      y < 0 ||
      w <= 0 ||
      h <= 0 ||
      x >= this._width ||
      y >= this._height ||
      x + w > this._width ||
      y + h > this._height
    ) {
      throw new Error(
        `invalid tile ${x},${y} ${w}x${h} for ${this._width}x${this._height}`,
      );
    }
    const rowLength = this._width;
    let data = '';
    for (let yy = y; yy < y + h; yy++) {
      const start = yy * rowLength + x;
      data +=
        '\n' +
        this._canvas
          .slice(start, start + w)
          .map((c) => c + c)
          .join('');
    }
    return data;
  }

  putPixels(x: number, y: number, w: number, h: number, data: string): void {
    if (
      x < 0 ||
      y < 0 ||
      w <= 0 ||
      h <= 0 ||
      x >= this._width ||
      y >= this._height ||
      x + w > this._width ||
      y + h > this._height
    ) {
      throw new Error(
        `invalid tile ${x},${y} ${w}x${h} for ${this._width}x${this._height}`,
      );
    }
    const rowLength = w * 2 + 1;
    const expectedDataSize = rowLength * h;
    if (expectedDataSize !== data.length) {
      throw new Error(
        `invalid tile data, length = ${
          data.length
        }, expected ${expectedDataSize}`,
      );
    }
    for (let yy = 0; yy < h; yy++) {
      for (let xx = 0; xx < w; xx++) {
        const color = data[xx * 2 + yy * rowLength + 1];
        this.setPixel(xx + x, yy + y, color);
      }
    }
  }

  toString(): string {
    return this.getPixels(0, 0, this._width, this._height);
  }
}
