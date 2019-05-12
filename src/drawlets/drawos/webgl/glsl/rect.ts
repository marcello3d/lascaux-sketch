import glsl from 'babel-plugin-glsl/macro';

export const rectVertexShader = glsl`
  attribute vec2 aPosition;

  uniform mat4 uMVMatrix;

  void main() {
    gl_Position = uMVMatrix * vec4(aPosition, 0, 1);
  }
`;

export const rectFragmentShader = glsl`
  precision mediump float;

  uniform vec4 uColor;

  void main() {
    gl_FragColor = uColor;
  }
`;
