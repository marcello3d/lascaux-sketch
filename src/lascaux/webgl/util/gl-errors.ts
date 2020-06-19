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

export function checkError(gl: WebGLRenderingContext) {
  const error = getErrorString(gl);
  if (error) {
    throw new Error(`WebGL ` + error);
  }
}

export function getOrThrow<T>(value: T | null | 0, type: string): T {
  if (value === null || value === 0) {
    throw new Error(`${type} failed`);
  }
  return value;
}
