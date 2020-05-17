import glsl from 'babel-plugin-glsl/macro';
import { ShaderDescription } from '../program';

export const ellipseShader = new ShaderDescription(
  glsl`
    attribute vec4 aPosition;
    attribute vec4 aRect;
    
    uniform mat4 uMVMatrix;
    
    varying vec4 vRect;
    
    void main() {
      vRect = aRect;
      gl_Position = uMVMatrix * aPosition;
    }
  `,
  glsl`
    precision mediump float;
    
    uniform vec4 uColor;
    
    varying vec4 vRect;
    
    void main() {
      // Offset from center of the circle
      vec2 uv = gl_FragCoord.xy - vRect.xy;
    
      // equation for ellipse: x² / a² + y² / b² = 1 (where a = width/2 and b = height/2)
      // -> x*x / (width*width/4) + y*y / (height*height/4) = 1
      // -> 4*x*x / (width*width) + 4*y*y / (height*height) = 1
      float inEllipse =
        uv.x * uv.x * vRect.z + // vRect.z is 4 / width * width
        uv.y * uv.y * vRect.w;  // vRect.w is 4 / height * height
    
      if (inEllipse > 1.0) {
        discard;
      }
    
      gl_FragColor = vec4(uColor.rgb, (1.0 - inEllipse) * uColor.a * uColor.a);
    }
  `,
  ['aPosition', 'aRect'],
  ['uColor', 'uMVMatrix'],
);
