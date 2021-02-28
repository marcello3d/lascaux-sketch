import { createShader } from './gl-shader';

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
