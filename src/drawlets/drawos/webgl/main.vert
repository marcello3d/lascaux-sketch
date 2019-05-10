attribute vec4 aPosition;

uniform mat4 uMVMatrix;

varying vec2 vTextureCoord;

void main() {
  gl_Position = uMVMatrix * vec4(aPosition.xy, 0, 1);
  vTextureCoord = aPosition.zw;
}