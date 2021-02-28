/**
 * Sets a transformation matrix for drawing on the screen
 */
export function setViewportMatrix(
  gl: WebGLRenderingContext,
  uniform: WebGLUniformLocation,
  width: number,
  height: number,
): void {
  // 2D Matrix
  // shifted x: -1, y: 1
  // scaled 2/width, -2/height (negative to flip Y axis)
  gl.uniformMatrix4fv(
    uniform,
    false,
    // prettier-ignore
    new Float32Array([
      2 / width, 0, 0, 0,
      0, -2 / height, 0, 0,
      0, 0, 0, 0,
      -1, 1, 0, 1,
    ]),
  );
}

/**
 * Sets a matrix for drawing on a framebuffer
 */
export function setDrawingMatrix(
  gl: WebGLRenderingContext,
  uniform: WebGLUniformLocation,
  width: number,
  height: number,
): void {
  // 2D Matrix
  // shifted x: -1, y: -1
  // scaled 2/width, 2/height (no flipping on framebuffer)
  gl.uniformMatrix4fv(
    uniform,
    false,
    // prettier-ignore
    new Float32Array([
      2 / width, 0, 0, 0,
      0, 2 / height, 0, 0,
      0, 0, 1, 0,
      -1, -1, 0, 1,
    ]),
  );
}
