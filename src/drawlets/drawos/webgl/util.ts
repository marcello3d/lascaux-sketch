export type FrameBuffer = {
  width: number;
  height: number;
  texture: WebGLTexture;
  framebuffer: WebGLFramebuffer;
  destroy(): void;
};

export function createFrameBuffer(
  gl: WebGLRenderingContext,
  width: number,
  height: number,
  type: GLenum = gl.UNSIGNED_BYTE,
  format: GLenum = gl.RGBA,
): FrameBuffer {
  const framebuffer = gl.createFramebuffer();
  if (!framebuffer) {
    throw new Error('gl.createFramebuffer failed');
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);

  const texture = gl.createTexture();
  if (!texture) {
    throw new Error('gl.createTexture failed');
  }
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  gl.texImage2D(
    gl.TEXTURE_2D, // target
    0, // level
    format, // internal format
    width,
    height,
    0, // border
    format, // format
    type, // type
    null, // pixels
  );

  // Z-depth support:
  // var renderbuffer = gl.createRenderbuffer()
  // gl.bindRenderbuffer(gl.RENDERBUFFER, renderbuffer)
  // gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, rttFramebuffer.width, rttFramebuffer.height)
  // gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, renderbuffer)

  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    texture,
    0,
  );

  gl.bindTexture(gl.TEXTURE_2D, null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  // If I want z-depth at some point:
  // gl.bindRenderbuffer(gl.RENDERBUFFER, null)

  return {
    width,
    height,
    texture,
    framebuffer,
    destroy() {
      gl.deleteFramebuffer(framebuffer);
      gl.deleteTexture(texture);
    },
  };
}

export function createProgram(
  gl: WebGLRenderingContext,
  vertexShader: string | WebGLShader,
  fragmentShader: string | WebGLShader,
): WebGLProgram {
  const program = gl.createProgram();
  if (!program) {
    throw new Error('Could not create WebGLProgram');
  }

  if (typeof vertexShader === 'string') {
    vertexShader = createShader(gl, vertexShader, gl.VERTEX_SHADER);
  }
  if (typeof fragmentShader === 'string') {
    fragmentShader = createShader(gl, fragmentShader, gl.FRAGMENT_SHADER);
  }
  // Attach pre-existing shaders
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);

  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    throw new Error('Could not compile WebGL program. \n\n' + info);
  }
  return program;
}

export function createShader(
  gl: WebGLRenderingContext,
  sourceCode: string,
  type: GLenum,
): WebGLShader {
  // Compiles either a shader of type gl.VERTEX_SHADER or gl.FRAGMENT_SHADER
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error('Could not create WebGLShader');
  }
  gl.shaderSource(shader, sourceCode);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    console.error(`Could not compile WebGL shader.

${sourceCode}

${info}`);
    throw new Error(`Could not compile WebGL shader.

${sourceCode}

${info}`);
  }
  return shader;
}

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
      -1, 1, 0, 1
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
      -1, -1, 0, 1
    ]),
  );
}

export function checkRenderTargetSupport(
  gl: WebGLRenderingContext,
  format: GLenum,
  type: GLenum,
): boolean {
  // create temporary frame buffer and texture
  const framebuffer = gl.createFramebuffer();
  if (!framebuffer) {
    return false;
  }
  try {
    const texture = gl.createTexture();
    if (!texture) {
      return false;
    }
    try {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, format, 2, 2, 0, format, type, null);

      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        texture,
        0,
      );

      // check frame buffer status
      return (
        gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE
      );
    } finally {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.bindTexture(gl.TEXTURE_2D, null);
      gl.deleteTexture(texture);
    }
  } finally {
    gl.deleteFramebuffer(framebuffer);
  }
}

export function checkError(gl: WebGLRenderingContext) {
  switch (gl.getError()) {
    case gl.INVALID_ENUM:
      throw new Error(
        'INVALID_ENUM: An unacceptable value has been specified for an enumerated argument. The command is ignored and the error flag is set.',
      );
    case gl.INVALID_VALUE:
      throw new Error(
        'INVALID_VALUE: A numeric argument is out of range. The command is ignored and the error flag is set.',
      );
    case gl.INVALID_OPERATION:
      throw new Error(
        'INVALID_OPERATION: The specified command is not allowed for the current state. The command is ignored and the error flag is set.',
      );
    case gl.INVALID_FRAMEBUFFER_OPERATION:
      throw new Error(
        'INVALID_FRAMEBUFFER_OPERATION: The currently bound framebuffer is not framebuffer complete when trying to render to or to read from it.',
      );
    case gl.OUT_OF_MEMORY:
      throw new Error(
        'OUT_OF_MEMORY: Not enough memory is left to execute the command.',
      );
    case gl.CONTEXT_LOST_WEBGL:
      throw new Error(
        'CONTEXT_LOST_WEBGL: If the WebGL context is lost, this error is returned on the first call to getError. Afterwards and until the context has been restored, it returns gl.NO_ERROR.',
      );
    default:
    case gl.NO_ERROR:
      return;
  }
}

export function getOrThrow<T>(value: T | null | 0, type: string): T {
  if (value === null || value === 0) {
    throw new Error(`${type} failed`);
  }
  return value;
}

export type RgbaImage = {
  pixels: Uint8Array | Uint16Array | Float32Array;
  width: number;
  height: number;
};
export function copyRgbaPixels(
  src: RgbaImage,
  x: number,
  y: number,
  width: number,
  height: number,
): RgbaImage {
  const TypedArrayType =
    src.pixels instanceof Uint8Array
      ? Uint8Array
      : src.pixels instanceof Uint16Array
      ? Uint16Array
      : Float32Array;
  const pixels = new TypedArrayType(width * height * 4);
  const xx = x * 4;
  const srcRowWidth = src.width * 4;
  const destRowWidth = width * 4;
  for (let yy = 0; yy < height; yy++) {
    const start = xx + (yy + y) * srcRowWidth;
    pixels.set(
      src.pixels.subarray(start, start + destRowWidth),
      yy * destRowWidth,
    );
  }
  return { pixels, width, height };
}
