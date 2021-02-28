import { ShaderDescription } from '../util/program';

export const rectShader = new ShaderDescription(
  `
  attribute vec2 aPosition;
  attribute vec4 aColor;

  uniform mat4 uMVMatrix;

  varying vec4 vColor;
  
  void main() {
    vColor = aColor;
    gl_Position = uMVMatrix * vec4(aPosition, 0, 1);
  }
`,
  `
  precision mediump float;

  varying vec4 vColor;

  void main() {
    gl_FragColor = vColor;
  }
`,
  ['aPosition', 'aColor'],
  ['uMVMatrix'],
);
