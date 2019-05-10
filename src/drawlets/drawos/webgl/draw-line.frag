precision mediump float;

uniform vec4 uColor;
uniform vec4 uPos1;
uniform vec4 uPos2;

float drawLine(vec2 p1, float s1, vec2 p2, float s2, vec2 uv) {
  float a = abs(distance(p1, uv));
  float b = abs(distance(p2, uv));
  float c = abs(distance(p1, p2));

  if ( a - s1 >= c || b - s2 >= c ) {
    return 0.0;
  }

  float p = (a + b + c) * 0.5;

  // median to (p1, p2) vector
  float h = 2.0 / c * sqrt( p * (p - a) * (p - b) * (p - c));

  return mix(1.0, 0.0, smoothstep(0.5 * s1 * 0.5, 1.5 * s2 * 0.5, h));
}

void main() {
  float inLine = drawLine(uPos1.xy, uPos1.z, uPos2.xy, uPos1.z, gl_FragCoord.xy);
  if ( inLine <= 0.0 ) {
    discard;
  }
  gl_FragColor = uColor;
}