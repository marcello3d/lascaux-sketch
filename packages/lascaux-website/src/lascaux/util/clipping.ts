export function clamp(value: number, min: number, max: number): number {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}

export function clampRange(
  position: number,
  viewportSize: number,
  canvasSize: number,
  bufferRatio: number,
  scale: number,
): number {
  const scaledCanvas = canvasSize * scale;
  const bufferSize = viewportSize * bufferRatio;
  return clamp(
    position,
    Math.min(0, viewportSize - scaledCanvas - bufferSize),
    Math.max(bufferSize, viewportSize - scaledCanvas),
  );
}
