import { float32ArrayToUint16Array } from './float16';
import { TypedArray, TypedArrayConstructor } from './typed-arrays';

export type RgbaImage = {
  pixels: TypedArray;
  width: number;
  height: number;
};
export function copyRgbaPixels(
  src: RgbaImage,
  destArrayType: TypedArrayConstructor,
  x: number,
  y: number,
  width: number,
  height: number,
): RgbaImage {
  const destRowWidth = width * 4;
  const pixels = new destArrayType(destRowWidth * height);
  const xx = x * 4;
  const srcRowWidth = src.width * 4;
  for (let yy = 0; yy < height; yy++) {
    const srcOffset = xx + (yy + y) * srcRowWidth;
    const srcRow = src.pixels.subarray(srcOffset, srcOffset + destRowWidth);
    const destOffset = yy * destRowWidth;
    const destRow = pixels.subarray(destOffset, destOffset + destRowWidth);
    if (srcRow instanceof Float32Array && destRow instanceof Uint16Array) {
      float32ArrayToUint16Array(srcRow, destRow);
    } else {
      destRow.set(srcRow);
    }
  }
  return { pixels, width, height };
}
