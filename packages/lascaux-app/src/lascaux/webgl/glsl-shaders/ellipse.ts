import { ShaderDescription } from '../util/program';

export const ellipseShader = new ShaderDescription(
  `
    attribute vec4 aPosition;
    attribute vec4 aRect;
    attribute vec4 aColor;
    
    uniform mat4 uMVMatrix;
    uniform float uHardness;
    
    varying float vHardness;
    varying vec2 vCenter;
    varying vec2 vEllipse1;
    varying vec2 vEllipse2;
    varying vec4 vColor;
    
    void main() {
      vCenter = aRect.xy + aRect.zw / 2.0;

      // equation for ellipse: x² / a² + y² / b² = 1 (where a = width/2 and b = height/2)
      // x² / (w/2)² + y² / (h/2)² = 1
      // x² / (w²/4) + y² / (h²/4) = 1
      
      // 4x² / w² + 4y² / h² = 1
      // 4x² / (w-1)² + 4y² / (h-1)² = ?
        
      // -> x*x / (width*width/4) + y*y / (height*height/4) = 1
      // -> 4*x*x / (width*width) + 4*y*y / (height*height) = 1
      vec2 plus = aRect.zw + vec2(0.5);
      vec2 minus = aRect.zw - vec2(0.5);
      vEllipse1 = vec2(4.0 / (plus.x * plus.x), 4.0 / (plus.y * plus.y));
      vEllipse2 = vec2(4.0 / (minus.x * minus.x), 4.0 / (minus.y * minus.y));
      vColor = aColor;
      vHardness = uHardness;
      gl_Position = uMVMatrix * aPosition;
    }
  `,
  `
    precision mediump float;

    varying float vHardness;
    
    varying vec2 vCenter;
    varying vec2 vEllipse1;
    varying vec2 vEllipse2;
    varying vec4 vColor;
    
    void main() {
      // Offset from center of the circle
      vec2 uv = gl_FragCoord.xy - vCenter.xy;
    
      float inEllipse =
        uv.x * uv.x * vEllipse1.x +
        uv.y * uv.y * vEllipse1.y;
        
      if (inEllipse >= 1.0) {
        discard;
      } 
      float inEllipse2 =
        uv.x * uv.x * vEllipse2.x +
        uv.y * uv.y * vEllipse2.y;
        
      gl_FragColor = vec4(vColor.rgb, smoothstep(1.0, vHardness * inEllipse, inEllipse2) * vColor.a);  
    }
  `,
  ['aPosition', 'aRect', 'aColor'],
  ['uMVMatrix', 'uHardness'],
);
