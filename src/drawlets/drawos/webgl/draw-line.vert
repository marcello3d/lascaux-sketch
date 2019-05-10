attribute vec4 aPosition;

uniform mat4 uMVMatrix;

varying vec4 vPosition;

void main() {
  gl_Position = uMVMatrix * aPosition;
}