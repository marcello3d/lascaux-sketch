import { createProgram } from './gl-program';
import { getOrThrow } from './gl-errors';

export class ShaderDescription<
  AttributeKey extends string,
  UniformKey extends string
> {
  constructor(
    public readonly vertexShader: string,
    public readonly fragmentShader: string,
    public readonly attributeKeys: AttributeKey[],
    public readonly uniformKeys: UniformKey[],
  ) {}
}

export type ProgramOf<
  T extends ShaderDescription<string, string>
> = T extends ShaderDescription<infer A, infer U> ? Program<A, U> : never;

export class Program<AttributeKey extends string, UniformKey extends string> {
  private readonly program: WebGLProgram;
  public readonly attributes = {} as Record<AttributeKey, GLint>;
  public readonly uniforms = {} as Record<UniformKey, WebGLUniformLocation>;
  constructor(
    private readonly gl: WebGLRenderingContext,
    private readonly description: ShaderDescription<AttributeKey, UniformKey>,
  ) {
    this.program = createProgram(
      gl,
      description.vertexShader,
      description.fragmentShader,
    );
    description.attributeKeys.forEach((name) => {
      const loc = gl.getAttribLocation(this.program, name);
      if (loc === -1) {
        throw new Error('getAttribLocation returned -1');
      }
      this.attributes[name] = loc;
    });
    description.uniformKeys.forEach((name) => {
      this.uniforms[name] = getOrThrow(
        gl.getUniformLocation(this.program, name),
        'getUniformLocation',
      );
    });
  }

  use(): void {
    this.gl.useProgram(this.program);
  }

  enable(): void {
    this.description.attributeKeys.forEach((attribute) => {
      this.gl.enableVertexAttribArray(this.attributes[attribute]);
    });
  }

  disable(): void {
    this.description.attributeKeys.forEach((attribute) => {
      this.gl.disableVertexAttribArray(this.attributes[attribute]);
    });
  }
}
