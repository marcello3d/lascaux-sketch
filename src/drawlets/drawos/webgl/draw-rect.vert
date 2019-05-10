attribute vec2 aPosition;

uniform mat4 uMVMatrix;

void main() {
  gl_Position = uMVMatrix * vec4(aPosition, 0, 1);
}