import { AsciiCanvas } from './ascii-canvas';

describe('AsciiCanvas', () => {
  it('constructs', () => {
    const canvas = new AsciiCanvas(10, 10);
    expect(canvas.toString()).toMatchInlineSnapshot(`
      "
      --------------------
      --------------------
      --------------------
      --------------------
      --------------------
      --------------------
      --------------------
      --------------------
      --------------------
      --------------------"
    `);
  });
});

describe('AsciiCanvas.setPixel', () => {
  it('sets pixels', () => {
    const canvas = new AsciiCanvas(10, 10);
    canvas.setPixel(0, 0, 'R');
    canvas.setPixel(1, 0, 'R');
    canvas.setPixel(2, 0, 'R');
    canvas.setPixel(4, 5, 'G');
    canvas.setPixel(5, 5, 'G');
    canvas.setPixel(6, 5, 'G');
    expect(canvas.toString()).toMatchInlineSnapshot(`
      "
      RRRRRR--------------
      --------------------
      --------------------
      --------------------
      --------------------
      --------GGGGGG------
      --------------------
      --------------------
      --------------------
      --------------------"
    `);
  });
  it('returns true if color was changed', () => {
    const canvas = new AsciiCanvas(10, 10);
    expect(canvas.setPixel(0, 0, 'R')).toBe(true);
    expect(canvas.setPixel(0, 0, 'R')).toBe(false);
  });
  it('returns false for out of bounds', () => {
    const canvas = new AsciiCanvas(10, 10);
    expect(canvas.setPixel(-1, 0, 'R')).toBe(false);
    expect(canvas.setPixel(0, -1, 'R')).toBe(false);
    expect(canvas.setPixel(10, 0, 'R')).toBe(false);
    expect(canvas.setPixel(0, 10, 'R')).toBe(false);
  });
  it('throws for invalid color', () => {
    const canvas = new AsciiCanvas(10, 10);
    expect(() => canvas.setPixel(0, 0, 'TOO LONG')).toThrowError('invalid');
  });
});

describe('AsciiCanvas.getPixel', () => {
  it('gets pixels', () => {
    const canvas = new AsciiCanvas(10, 10);
    canvas.setPixel(0, 0, 'R');
    canvas.setPixel(1, 0, 'R');
    canvas.setPixel(2, 0, 'R');
    canvas.setPixel(4, 5, 'G');
    canvas.setPixel(5, 5, 'G');
    canvas.setPixel(6, 5, 'G');
    expect(canvas.getPixel(0, 0)).toEqual('R');
    expect(canvas.getPixel(3, 3)).toEqual('-');
    expect(canvas.getPixel(0, 0)).toEqual('R');
  });
  it('returns undefined for out of bounds', () => {
    const canvas = new AsciiCanvas(10, 10);
    expect(canvas.getPixel(-1, 0)).toBe(undefined);
    expect(canvas.getPixel(0, -1)).toBe(undefined);
    expect(canvas.getPixel(10, 0)).toBe(undefined);
    expect(canvas.getPixel(0, 10)).toBe(undefined);
  });
});

describe('AsciiCanvas.getPixels', () => {
  it('gets pixels', () => {
    const canvas = new AsciiCanvas(10, 10);
    expect(canvas.getPixels(0, 0, 10, 10)).toMatchInlineSnapshot(`
      "
      --------------------
      --------------------
      --------------------
      --------------------
      --------------------
      --------------------
      --------------------
      --------------------
      --------------------
      --------------------"
    `);
  });
  it('gets sub pixel range', () => {
    const canvas = new AsciiCanvas(10, 10);
    expect(canvas.getPixels(2, 2, 2, 2)).toMatchInlineSnapshot(`
      "
      ----
      ----"
    `);
  });
  it('gets sub pixel range', () => {
    const canvas = new AsciiCanvas(10, 10);
    expect(canvas.getPixels(2, 2, 4, 2)).toMatchInlineSnapshot(`
      "
      --------
      --------"
    `);
  });
  it('fails on out of range', () => {
    const canvas = new AsciiCanvas(10, 10);
    expect(() => canvas.getPixels(2, 2, 0, 2)).toThrowError('invalid tile');
    expect(() => canvas.getPixels(2, 2, -1, 2)).toThrowError('invalid tile');
    expect(() => canvas.getPixels(2, 2, 2, 0)).toThrowError('invalid tile');
    expect(() => canvas.getPixels(2, 2, 2, -1)).toThrowError('invalid tile');
    expect(() => canvas.getPixels(-1, 2, 2, 2)).toThrowError('invalid tile');
    expect(() => canvas.getPixels(2, -1, 2, 2)).toThrowError('invalid tile');
    expect(() => canvas.getPixels(10, 2, 2, 2)).toThrowError('invalid tile');
    expect(() => canvas.getPixels(2, 10, 2, 2)).toThrowError('invalid tile');
    expect(() => canvas.getPixels(2, 2, 10, 2)).toThrowError('invalid tile');
    expect(() => canvas.getPixels(2, 2, 2, 10)).toThrowError('invalid tile');
  });
});

describe('AsciiCanvas.putPixels', () => {
  it('puts pixels', () => {
    const canvas = new AsciiCanvas(10, 10);
    const tile = `
--RR
RR--`;
    canvas.putPixels(0, 0, 2, 2, tile);
    canvas.putPixels(4, 0, 2, 2, tile);
    expect(canvas.toString()).toMatchInlineSnapshot(`
      "
      --RR------RR--------
      RR------RR----------
      --------------------
      --------------------
      --------------------
      --------------------
      --------------------
      --------------------
      --------------------
      --------------------"
    `);
  });
  it('fails on out of range', () => {
    const canvas = new AsciiCanvas(10, 10);
    const tile = `
--RR
RR--`;
    expect(() => canvas.putPixels(2, 2, 0, 2, tile)).toThrowError('tile');
    expect(() => canvas.putPixels(2, 2, -1, 2, tile)).toThrowError('tile');
    expect(() => canvas.putPixels(2, 2, 2, 0, tile)).toThrowError('tile');
    expect(() => canvas.putPixels(2, 2, 2, -1, tile)).toThrowError('tile');
    expect(() => canvas.putPixels(-1, 2, 2, 2, tile)).toThrowError('tile');
    expect(() => canvas.putPixels(2, -1, 2, 2, tile)).toThrowError('tile');
    expect(() => canvas.putPixels(10, 2, 2, 2, tile)).toThrowError('tile');
    expect(() => canvas.putPixels(2, 10, 2, 2, tile)).toThrowError('tile');
    expect(() => canvas.putPixels(2, 2, 10, 2, tile)).toThrowError('tile');
    expect(() => canvas.putPixels(2, 2, 2, 10, tile)).toThrowError('tile');
  });
  it('fails on invalid tile', () => {
    const canvas = new AsciiCanvas(10, 10);
    const tile = `
--RR
RR--`;
    expect(() => canvas.putPixels(2, 2, 3, 2, tile)).toThrowError(
      'invalid tile data',
    );
  });
});
