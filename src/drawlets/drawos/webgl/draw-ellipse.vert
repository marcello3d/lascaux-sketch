attribute vec4 aPosition;
attribute vec4 aRect;

uniform mat4 uMVMatrix;

varying vec4 vRect;

void main() {
  vRect = aRect;
  gl_Position = uMVMatrix * aPosition;
}