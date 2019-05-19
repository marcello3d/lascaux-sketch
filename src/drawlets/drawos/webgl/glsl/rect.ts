import glsl from 'babel-plugin-glsl/macro';
import { ShaderDescription } from '../program';

export const rectShader = new ShaderDescription(
  glsl`
  attribute vec2 aPosition;

  uniform mat4 uMVMatrix;

  void main() {
    gl_Position = uMVMatrix * vec4(aPosition, 0, 1);
  }
`,
  glsl`
  precision mediump float;

  uniform vec4 uColor;

  void main() {
    gl_FragColor = uColor;
  }
`,
  ['aPosition'],
  ['uMVMatrix', 'uColor'],
);
