import glsl from 'babel-plugin-glsl/macro';
import { ShaderDescription } from '../program';

export const rectShader = new ShaderDescription(
  glsl`
  attribute vec2 aPosition;
  attribute vec4 aColor;

  uniform mat4 uMVMatrix;

  varying vec4 vColor;
  
  void main() {
    vColor = aColor;
    gl_Position = uMVMatrix * vec4(aPosition, 0, 1);
  }
`,
  glsl`
  precision mediump float;

  varying vec4 vColor;

  void main() {
    gl_FragColor = vColor;
  }
`,
  ['aPosition', 'aColor'],
  ['uMVMatrix'],
);
