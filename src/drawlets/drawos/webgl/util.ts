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
    gl.RGBA, // internal format
    width,
    height,
    0, // border
    gl.RGBA, // format
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
    console.error('Could not compile WebGL program. \n\n' + info);
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
