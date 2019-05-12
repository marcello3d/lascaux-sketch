import glsl from 'babel-plugin-glsl/macro';

export const textureVertexShader = glsl`
  attribute vec4 aPosition;

  uniform mat4 uMVMatrix;

  varying vec2 vTextureCoord;

  void main() {
    gl_Position = uMVMatrix * vec4(aPosition.xy, 0, 1);
    vTextureCoord = aPosition.zw;
  }
`;

export const textureFragmentShader = glsl`
  precision mediump float;

  varying vec2 vTextureCoord;

  uniform sampler2D uSampler;

  void main() {
    gl_FragColor = texture2D(uSampler, vec2(vTextureCoord.s, vTextureCoord.t));
  }
`;
