// @ts-ignore
import * as PEPJS from '@marcello/pepjs';
import * as React from 'react';
import { ReactNode, useMemo } from 'react';
import Bowser from 'bowser';

import styles from './Diagnostics.module.css';
import { checkRenderTargetSupport } from './drawlets/drawos/webgl/util';

export default function Diagnostics() {
  const { browser, os, platform, engine } = useMemo(
    () => Bowser.parse(window.navigator.userAgent),
    [],
  );
  const webgl = useMemo(() => computeWebglSupport(false), []);
  const webgl2 = useMemo(() => computeWebglSupport(true), []);
  return (
    <div className={styles.root}>
      <h1>PointerEvents Diagnostics</h1>
      <Table
        rows={[
          [
            'Browser',
            <>
              <strong>
                {browser.name} {browser.version}
              </strong>{' '}
              ({engine.name} {engine.version})
            </>,
          ],
          [
            'OS',
            `${os.name} ${os.version}${
              os.versionName ? ` (${os.versionName})` : ''
            }`,
          ],
          ['Platform', `${platform.vendor} ${platform.type} ${platform.model}`],
          [
            'PointerEvents',
            PEPJS.PointerEvent === window.PointerEvent ? 'polyfill' : 'native',
          ],
          ['WebGL'],
          ...webgl,
          ['WebGL2'],
          ...webgl2,
        ]}
      />
    </div>
  );
}

function renderValue(value: boolean | string | ReactNode) {
  if (value === true) {
    return <strong>Yes</strong>;
  }
  if (value === false) {
    return <strong>No</strong>;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return <strong>{value}</strong>;
  }
  return value;
}

type Row = [string, boolean | string | ReactNode] | [string];

function Table({ rows }: { rows: Row[] }) {
  return (
    <pre>
      {rows.map(([name, value], index) => {
        if (value === undefined) {
          return (
            <React.Fragment key={index}>
              {'\n'}
              {name}
              {'\n'}
            </React.Fragment>
          );
        }
        return (
          <React.Fragment key={index}>
            {name}: {renderValue(value)}
            {'\n'}
          </React.Fragment>
        );
      })}
    </pre>
  );
}

function makeGl() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  return canvas.getContext('webgl', {
    preserveDrawingBuffer: false,
    alpha: false,
    depth: false,
    stencil: false,
    antialias: false,
    premultipliedAlpha: false,
  });
}

function makeGl2() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  return canvas.getContext('webgl2', {
    preserveDrawingBuffer: false,
    alpha: false,
    depth: false,
    stencil: false,
    antialias: false,
    premultipliedAlpha: false,
  }) as WebGLRenderingContext | null;
}

function computeWebglSupport(webgl2: boolean): Row[] {
  const gl = webgl2 ? makeGl2() : makeGl();
  if (!gl) {
    return [['Version', 'unsupported']];
  }

  const glDebug = gl.getExtension('WEBGL_debug_renderer_info');
  let glHalfFloat: OES_texture_half_float | null = null;
  if (!webgl2) {
    gl.getExtension('OES_texture_float');
    glHalfFloat = gl.getExtension('OES_texture_half_float');
  } else {
    gl.getExtension('EXT_color_buffer_float');
  }
  // @ts-ignore
  const gl2HalfFloat = gl.HALF_FLOAT;
  const dimensions = gl.getParameter(gl.MAX_VIEWPORT_DIMS);
  return [
    [
      'Version',
      `${gl.getParameter(gl.VENDOR)} ${gl.getParameter(
        gl.VERSION,
      )}, ${gl.getParameter(gl.SHADING_LANGUAGE_VERSION)}`,
    ],
    [
      'WebGL Driver',
      glDebug
        ? `${gl.getParameter(
            glDebug.UNMASKED_RENDERER_WEBGL,
          )} (${gl.getParameter(glDebug.UNMASKED_VENDOR_WEBGL)})`
        : false,
    ],
    ['MAX_VIEWPORT_DIMS', `${dimensions[0]}x${dimensions[1]}`],
    ['MAX_RENDERBUFFER_SIZE', gl.getParameter(gl.MAX_RENDERBUFFER_SIZE)],
    ['MAX_TEXTURE_SIZE', gl.getParameter(gl.MAX_TEXTURE_SIZE)],
    ['MAX_TEXTURE_IMAGE_UNITS', gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS)],
    [
      'MAX_VERTEX_TEXTURE_IMAGE_UNITS',
      gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS),
    ],
    [
      'MAX_COMBINED_TEXTURE_IMAGE_UNITS',
      gl.getParameter(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS),
    ],
    [
      'Float RGBA render textures',
      checkRenderTargetSupport(gl, gl.RGBA, gl.FLOAT),
    ],
    [
      'Half-float RGBA render textures',
      webgl2
        ? checkRenderTargetSupport(gl, gl.RGBA, gl2HalfFloat)
        : glHalfFloat &&
          checkRenderTargetSupport(gl, gl.RGBA, glHalfFloat.HALF_FLOAT_OES),
    ],
  ];
}
