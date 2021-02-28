import { copyRgbaPixels, RgbaImage } from './rgba-image';
describe('copyRgbaPixels', () => {
  const image: RgbaImage = {
    // prettier-ignore
    pixels: new Float32Array([
      1,0,0,1, 0,1,0,1,
      0,0,1,1, 1,1,0,1,
    ]),
    width: 2,
    height: 2,
  };
  it('copies full image', () => {
    expect(copyRgbaPixels(image, Float32Array, 0, 0, 2, 2))
      .toMatchInlineSnapshot(`
      Object {
        "height": 2,
        "pixels": Float32Array [
          1,
          0,
          0,
          1,
          0,
          1,
          0,
          1,
          0,
          0,
          1,
          1,
          1,
          1,
          0,
          1,
        ],
        "width": 2,
      }
    `);
  });
  it('copies partial', () => {
    expect(copyRgbaPixels(image, Float32Array, 1, 0, 1, 2))
      .toMatchInlineSnapshot(`
      Object {
        "height": 2,
        "pixels": Float32Array [
          0,
          1,
          0,
          1,
          1,
          1,
          0,
          1,
        ],
        "width": 1,
      }
    `);
  });
  it('copies to uint16', () => {
    expect(copyRgbaPixels(image, Uint16Array, 1, 0, 1, 2))
      .toMatchInlineSnapshot(`
      Object {
        "height": 2,
        "pixels": Uint16Array [
          0,
          15360,
          0,
          15360,
          15360,
          15360,
          0,
          15360,
        ],
        "width": 1,
      }
    `);
  });
});
