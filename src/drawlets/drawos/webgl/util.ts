import { float32ArrayToUint16Array, toHalf } from './float16';

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

export type TypedArray =
  | Uint8Array
  | Uint8ClampedArray
  | Uint16Array
  | Uint32Array
  | Int8Array
  | Int16Array
  | Int32Array
  | Float32Array
  | Float64Array;
export type TypedArrayConstructor = {
  new (size: number): TypedArray;
};

export type FrameBufferInfo = {
  readArray: TypedArrayConstructor;
  readType: string;
  readTypeInt: GLint;
  writeArray: TypedArrayConstructor;
  writeType: string;
  writeTypeInt: GLint;
};

export function checkRenderTargetSupport(
  gl: WebGLRenderingContext,
  format: GLenum,
  type: GLenum,
  halfFloatType?: GLint,
): string | FrameBufferInfo[] {
  if (hasError(gl)) {
    return 'error-before-test';
  }
  // create temporary frame buffer and texture
  const framebuffer = gl.createFramebuffer();
  if (!framebuffer) {
    return 'no-create-framebuffer';
  }
  try {
    const texture = gl.createTexture();
    if (!texture) {
      return 'no-create-texture';
    }
    try {
      const width = 4;
      const height = 4;

      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        format,
        width,
        height,
        0,
        format,
        type,
        null,
      );

      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        texture,
        0,
      );

      if (hasError(gl)) {
        return 'framebuffer-error';
      }

      // check frame buffer status
      const status = getFramebufferStatus(gl);
      if (status) {
        return status;
      }

      const sourcePixels = new Float32Array(width * height * 4);
      for (let i = 0; i < sourcePixels.length; ) {
        sourcePixels[i++] = 0.75;
        sourcePixels[i++] = 0.5;
        sourcePixels[i++] = 0.25;
        sourcePixels[i++] = 1;
      }

      const types: [TypedArrayConstructor, number, string][] = [
        [Uint8Array, gl.UNSIGNED_BYTE, 'uint8'],
        [Uint16Array, gl.UNSIGNED_SHORT, 'uint16'],
        // [Uint32Array, gl.UNSIGNED_INT, 'uint32'],
        [Float32Array, gl.FLOAT, 'float32'],
        // [Float64Array, gl.FLOAT, 'float64'],
      ];
      if (halfFloatType) {
        types.splice(
          3,
          0,
          [Uint16Array, halfFloatType, 'float16'],
          [Float32Array, halfFloatType, 'float32'],
        );
      }

      const combos: FrameBufferInfo[] = [];
      for (const [WritableType, writeTypeInt, writeType] of types) {
        console.log(`Testing write to ${WritableType.name}...`);
        const writePixels = new WritableType(width * height * 4);
        if (
          writePixels instanceof Float32Array ||
          writePixels instanceof Float64Array
        ) {
          writePixels.set(sourcePixels);
        } else if (writePixels instanceof Uint16Array) {
          float32ArrayToUint16Array(sourcePixels, writePixels);
        } else if (writePixels instanceof Uint8Array) {
          for (let i = 0; i < writePixels.length; i++) {
            writePixels[i] = sourcePixels[i] * 255;
          }
        }
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texSubImage2D(
          gl.TEXTURE_2D,
          0,
          0,
          0,
          width,
          height,
          format,
          writeTypeInt,
          writePixels,
        );
        if (getErrorString(gl)) {
          continue;
        }

        for (const [ReadableType, readTypeInt, readType] of types) {
          console.log(`Testing read to ${WritableType.name}...`);

          const readPixels = new ReadableType(width * height * 4);
          gl.readPixels(0, 0, width, height, format, readTypeInt, readPixels);
          if (getErrorString(gl)) {
            continue;
          }
          let ok = true;
          for (let i = 0; i < readPixels.length; i++) {
            let readPix = readPixels[i];
            let writePix = writePixels[i];
            if (
              readPixels instanceof Float32Array &&
              writePixels instanceof Uint16Array
            ) {
              readPix = toHalf(readPixels[i]);
            } else if (
              writePixels instanceof Float32Array &&
              readPixels instanceof Uint16Array
            ) {
              writePix = toHalf(writePixels[i]);
            }
            if (readPix !== writePix) {
              ok = false;
              break;
            }
          }
          if (ok) {
            combos.push({
              readArray: ReadableType,
              readType,
              readTypeInt,
              writeArray: WritableType,
              writeType,
              writeTypeInt,
            });
          }
        }
      }
      if (combos.length === 0) {
        return 'no-compatible-format';
      }
      return combos;
    } finally {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.bindTexture(gl.TEXTURE_2D, null);
      gl.deleteTexture(texture);
    }
  } finally {
    gl.deleteFramebuffer(framebuffer);
  }
}

export function getErrorString(gl: WebGLRenderingContext): string | undefined {
  switch (gl.getError()) {
    // An unacceptable value has been specified for an enumerated argument. The command is ignored and the error flag is set.
    case gl.INVALID_ENUM:
      return 'INVALID_ENUM';

    // A numeric argument is out of range. The command is ignored and the error flag is set.
    case gl.INVALID_VALUE:
      return 'INVALID_VALUE';

    // The specified command is not allowed for the current state. The command is ignored and the error flag is set.',
    case gl.INVALID_OPERATION:
      return 'INVALID_OPERATION';

    // The currently bound framebuffer is not framebuffer complete when trying to render to or to read from it.',
    case gl.INVALID_FRAMEBUFFER_OPERATION:
      return 'INVALID_FRAMEBUFFER_OPERATION';

    // Not enough memory is left to execute the command.',
    case gl.OUT_OF_MEMORY:
      return 'OUT_OF_MEMORY';

    // If the WebGL context is lost, this error is returned on the first call to getError. Afterwards and until the context has been restored, it returns gl.NO_ERROR.',
    case gl.CONTEXT_LOST_WEBGL:
      return 'CONTEXT_LOST_WEBGL';

    default:
      return undefined;
  }
}

export function getFramebufferStatus(
  gl: WebGLRenderingContext,
): string | undefined {
  const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  switch (status) {
    // The framebuffer is ready to display.
    case gl.FRAMEBUFFER_COMPLETE:
      return undefined;

    // The attachment types are mismatched or not all framebuffer attachment points are framebuffer attachment complete.
    case gl.FRAMEBUFFER_INCOMPLETE_ATTACHMENT:
      return 'FRAMEBUFFER_INCOMPLETE_ATTACHMENT';

    // There is no attachment.
    case gl.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT:
      return 'FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT';

    // Height and width of the attachment are not the same.
    case gl.FRAMEBUFFER_INCOMPLETE_DIMENSIONS:
      return 'FRAMEBUFFER_INCOMPLETE_DIMENSIONS';

    // The format of the attachment is not supported or if depth and stencil attachments are not the same renderbuffer.
    case gl.FRAMEBUFFER_UNSUPPORTED:
      return 'FRAMEBUFFER_UNSUPPORTED';

    default:
      return 'UNKNOWN:' + status;
  }
}
export function checkError(gl: WebGLRenderingContext) {
  const error = getErrorString(gl);
  if (error) {
    throw new Error(`WebGL ` + error);
  }
}

export function hasError(gl: WebGLRenderingContext) {
  const error = getErrorString(gl);
  if (error !== undefined) {
    console.error('WebGL Error: ' + error);
    return true;
  }
  return false;
}

export function getOrThrow<T>(value: T | null | 0, type: string): T {
  if (value === null || value === 0) {
    throw new Error(`${type} failed`);
  }
  return value;
}

export type RgbaImage = {
  pixels: TypedArray;
  width: number;
  height: number;
};
export function copyRgbaPixels(
  src: RgbaImage,
  TypedArrayType: TypedArrayConstructor,
  x: number,
  y: number,
  width: number,
  height: number,
): RgbaImage {
  const destRowWidth = width * 4;
  const pixels = new TypedArrayType(destRowWidth * height);
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
