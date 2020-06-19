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
