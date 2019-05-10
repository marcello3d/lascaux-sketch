import { createProgram } from './util';

export class Program {
  private readonly program: WebGLProgram;
  public readonly attributes: Record<string, GLint> = {};
  public readonly uniforms: Record<string, WebGLUniformLocation> = {};
  constructor(
    private readonly gl: WebGLRenderingContext,
    private readonly vertexShader: WebGLShader,
    private readonly fragmentShader: WebGLShader,
    private readonly name: string,
  ) {
    this.program = createProgram(gl, vertexShader, fragmentShader);
  }

  attribute(name: string): GLint {
    let a = this.attributes[name];
    if (!a) {
      a = this.attributes[name] = this.gl.getAttribLocation(this.program, name);
    }
    return a;
  }

  uniform(name: string): WebGLUniformLocation {
    const u = this.uniforms[name];
    if (u) {
      return u;
    }
    const u2 = this.gl.getUniformLocation(this.program, name);
    if (!u2) {
      throw new Error(`Could not get WebGLUniformLocation ${name}`);
    }
    this.uniforms[name] = u2;
    return u2;
  }

  use(): void {
    this.gl.useProgram(this.program);
  }

  enable(): void {
    Object.keys(this.attributes).forEach((attribute) => {
      this.gl.enableVertexAttribArray(this.attributes[attribute]);
    });
  }

  disable(): void {
    Object.keys(this.attributes).forEach((attribute) => {
      this.gl.disableVertexAttribArray(this.attributes[attribute]);
    });
  }
}
