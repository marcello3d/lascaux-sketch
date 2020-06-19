import { float32ArrayToUint16Array } from '../../util/float16';
import { TypedArrayConstructor } from '../../util/typed-arrays';
import { getErrorString } from './gl-errors';

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

export type FrameBufferInfo = {
  ReadTypedArray: TypedArrayConstructor;
  readTypeName: string;
  glReadType: GLint;
  WriteTypedArray: TypedArrayConstructor;
  writeTypeName: string;
  glWriteType: GLint;
};

export function checkRenderTargetSupport(
  gl: WebGLRenderingContext,
  format: GLenum,
  type: GLenum,
  halfFloatType?: GLint,
  log?: (message: string) => void,
): string | FrameBufferInfo[] {
  const existingError = getErrorString(gl);
  if (existingError) {
    return `error-before-test:${existingError}`;
  }
  // create temporary frame buffer and texture
  const framebuffer = gl.createFramebuffer();
  if (!framebuffer) {
    return 'createFramebuffer:null';
  }
  try {
    const texture = gl.createTexture();
    if (!texture) {
      return 'createTexture:null';
    }
    try {
      const width = 4;
      const height = 4;

      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
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

      const texImage2D = getErrorString(gl);
      if (texImage2D) {
        return `texImage2D:${texImage2D}`;
      }

      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        texture,
        0,
      );

      const framebufferError = getErrorString(gl);
      if (framebufferError) {
        return `framebufferTexture2D:${framebufferError}`;
      }

      // check frame buffer status
      const status = getFramebufferStatus(gl);
      if (status) {
        return status;
      }

      const sourcePixels = new Float32Array(width * height * 4);
      for (let i = 0; i < sourcePixels.length; ) {
        sourcePixels[i++] = i / sourcePixels.length;
        sourcePixels[i++] = (0.5 * i) / sourcePixels.length;
        sourcePixels[i++] = (0.25 * i) / sourcePixels.length;
        sourcePixels[i++] = 1;
      }

      const types: [TypedArrayConstructor, number, string][] = [
        [Uint8Array, gl.UNSIGNED_BYTE, 'uint8'],
      ];
      if (type === halfFloatType || type === gl.UNSIGNED_SHORT) {
        types.push([Uint16Array, gl.UNSIGNED_SHORT, 'uint16']);
      }
      if (type === halfFloatType) {
        types.push([Uint16Array, halfFloatType, 'float16']);
      }
      types.push([Float32Array, gl.FLOAT, 'float32']);

      const combos: FrameBufferInfo[] = [];
      for (const [WritableType, writeTypeInt, writeType] of types) {
        log?.(`Testing write to ${WritableType.name}...`);
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
        const texSubImage2DError = getErrorString(gl);
        if (texSubImage2DError) {
          log?.(
            `Cannot write to ${writeType}, texSubImage2D got ${texSubImage2DError}`,
          );
          continue;
        }
        for (const [ReadableType, readTypeInt, readType] of types) {
          log?.(`Testing read to ${ReadableType.name}...`);

          let readPixels = new ReadableType(width * height * 4);
          gl.readPixels(0, 0, width, height, format, readTypeInt, readPixels);
          const readPixelsError = getErrorString(gl);
          if (readPixelsError) {
            log?.(
              `Cannot read to ${readType}, readPixels got ${readPixelsError}`,
            );
            continue;
          }

          if (
            readPixels instanceof Float32Array &&
            writePixels instanceof Uint16Array
          ) {
            readPixels = float32ArrayToUint16Array(readPixels);
          }
          let ok = true;
          for (let i = 0; i < readPixels.length; i++) {
            let readPix = readPixels[i];
            let writePix = writePixels[i];
            if (readPix !== writePix) {
              ok = false;
              break;
            }
          }
          if (ok) {
            combos.push({
              ReadTypedArray: ReadableType,
              readTypeName: readType,
              glReadType: readTypeInt,
              WriteTypedArray: WritableType,
              writeTypeName: writeType,
              glWriteType: writeTypeInt,
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
