import { Program } from './program';

export default class ProgramManager {
  private readonly gl: WebGLRenderingContext;
  private currentProgram: Program | null;
  constructor(gl: WebGLRenderingContext) {
    this.gl = gl;
    this.currentProgram = null;
  }

  use(program: Program): void {
    if (this.currentProgram === program) {
      return;
    }
    if (this.currentProgram) {
      this.currentProgram.disable();
    }
    this.currentProgram = program;
    program.use();
    program.enable();
  }
}
