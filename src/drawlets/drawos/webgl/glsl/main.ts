import glsl from 'babel-plugin-glsl/macro';

export const mainVertexShader = glsl`
  attribute vec4 aPosition;

  uniform mat4 uMVMatrix;

  varying vec2 vTextureCoord;

  void main() {
    gl_Position = uMVMatrix * vec4(aPosition.xy, 0, 1);
    vTextureCoord = aPosition.zw;
  }
`;

export const mainFragmentShader = glsl`
  precision mediump float;

  varying vec2 vTextureCoord;

  uniform sampler2D uSampler;

  void main() {
      gl_FragColor = texture2D(uSampler, floor(vTextureCoord.xy));
  }
`;
