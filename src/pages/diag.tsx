// @ts-ignore
import * as PEPJS from '@marcello/pepjs';
import * as React from 'react';
import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import Bowser from 'bowser';

import styles from './diag.module.css';
import { checkRenderTargetSupport } from '../drawlets/drawos/webgl/util';
import produce from 'immer';

type PointerData = {
  types: Record<string, boolean>;
  pointerIds: Record<string, boolean>;
  pointers: Record<
    string,
    {
      clientX: number;
      clientY: number;
      movementX: number;
      movementY: number;
      fractional: boolean | undefined;
      coalesced: boolean | undefined;
      buttons: number;
      pressure: number;
      minPressure: number;
      maxPressure: number;
      tiltX: number;
      minTiltX: number;
      maxTiltX: number;
      tiltY: number;
      minTiltY: number;
      maxTiltY: number;
      width: number;
      minWidth: number;
      maxWidth: number;
      height: number;
      minHeight: number;
      maxHeight: number;
    }
  >;
};

let events = 0;
let hertz = 0;
let maxHertz = 0;
setInterval(() => {
  hertz = events;
  events = 0;
  if (maxHertz < hertz) {
    maxHertz = hertz;
  }
}, 1000);

export default function Diag() {
  const system = useMemo((): Row[] => {
    const { browser, os, platform, engine } = Bowser.parse(
      window.navigator.userAgent,
    );
    return [
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
    ];
  }, []);
  const webgl = useMemo(() => computeWebglSupport(false), []);
  const webgl2 = useMemo(() => computeWebglSupport(true), []);
  const [data, setData] = useState<PointerData>({
    types: {},
    pointerIds: {},
    pointers: {},
  });
  const handlePointerEvent = useCallback(
    (event: React.PointerEvent) => {
      const {
        type,
        clientX,
        clientY,
        movementX,
        movementY,
        buttons,
        pressure,
        tiltX,
        tiltY,
        pointerId,
        pointerType,
        width,
        height,
      } = event;
      events++;
      event.preventDefault();
      event.stopPropagation();
      event.nativeEvent.preventDefault();
      event.nativeEvent.stopImmediatePropagation();
      setData(
        produce(data, (draft) => {
          draft.types[type.replace(/^pointer/, '')] = true;
          draft.pointerIds[pointerId] = true;
          const pointer = draft.pointers[pointerType];
          const fractional =
            clientX !== Math.floor(clientX) || clientY !== Math.floor(clientY);
          const coalesced =
            event.nativeEvent.getCoalescedEvents &&
            type === 'move' &&
            event.nativeEvent.getCoalescedEvents().length > 1;

          if (!pointer) {
            draft.pointers[pointerType] = {
              clientX,
              clientY,
              movementX,
              movementY,
              fractional,
              coalesced,
              buttons,
              pressure,
              minPressure: pressure,
              maxPressure: pressure,
              tiltX,
              minTiltX: tiltX,
              maxTiltX: tiltX,
              tiltY,
              minTiltY: tiltY,
              maxTiltY: tiltY,
              width,
              minWidth: width,
              maxWidth: width,
              height,
              minHeight: height,
              maxHeight: height,
            };
          } else {
            pointer.pressure = pressure;
            pointer.buttons = buttons;
            pointer.clientX = clientX;
            pointer.clientY = clientY;
            pointer.movementX = movementX;
            pointer.movementY = movementY;
            pointer.tiltX = tiltX;
            pointer.tiltY = tiltY;
            pointer.width = width;
            pointer.height = height;
            if (fractional) {
              pointer.fractional = true;
            }
            if (coalesced) {
              pointer.coalesced = true;
            }
            if (pointer.minPressure > pressure) {
              pointer.minPressure = pressure;
            }
            if (pointer.maxPressure < pressure) {
              pointer.maxPressure = pressure;
            }
            if (pointer.minTiltX > tiltX) {
              pointer.minTiltX = tiltX;
            }
            if (pointer.maxTiltX < tiltX) {
              pointer.maxTiltX = tiltX;
            }
            if (pointer.minTiltY > tiltY) {
              pointer.minTiltY = tiltY;
            }
            if (pointer.maxTiltY < tiltY) {
              pointer.maxTiltY = tiltY;
            }
            if (pointer.minWidth > width) {
              pointer.minWidth = width;
            }
            if (pointer.maxWidth < width) {
              pointer.maxWidth = width;
            }
            if (pointer.minHeight > height) {
              pointer.minHeight = height;
            }
            if (pointer.maxHeight < height) {
              pointer.maxHeight = height;
            }
          }
        }),
      );
    },
    [data],
  );
  const dataRows = useMemo<Row[]>(() => {
    const { types, pointerIds, pointers } = data;
    const pointerIdKeys = Object.keys(pointerIds);
    const rows: Row[] = [
      ['Seen Pointer Event Types', Object.keys(types)],
      [
        'Seen Pointer Ids',
        pointerIdKeys.slice(0, 3) +
          (pointerIdKeys.length > 3
            ? `, ... (${pointerIdKeys.length} total)`
            : ''),
      ],
      ['Pointers per second', `${hertz} (max ${maxHertz.toFixed(0)})`],
    ];
    for (const type of Object.keys(pointers)) {
      const {
        clientX,
        clientY,
        movementX,
        movementY,
        fractional,
        coalesced,
        buttons,
        pressure,
        minPressure,
        maxPressure,
        tiltX,
        minTiltX,
        maxTiltX,
        tiltY,
        minTiltY,
        maxTiltY,
        width,
        minWidth,
        maxWidth,
        height,
        minHeight,
        maxHeight,
      } = pointers[type];
      rows.push(
        [`Cursor ${type}`],
        [
          `Buttons`,
          buttons
            .toString(2)
            .split('')
            .reverse()
            .map((value, index) =>
              value === '1' ? `Button #${index + 1} Pressed` : undefined,
            )
            .filter((x) => x)
            .join(', '),
        ],
        [`Client X/Y`, `${clientX.toFixed(2)}, ${clientY.toFixed(2)}`],
        [`Movement X/Y`, `${movementX.toFixed(2)}, ${movementY.toFixed(2)}`],
        [`Supports Fractional X/Y`, fractional],
        coalesced !== undefined
          ? [`Got Coalesced`, coalesced]
          : [`Supports Coalesced`, false],
        [
          `Pressure`,
          `${pressure.toFixed(3)} (min: ${minPressure.toFixed(
            3,
          )}, max: ${maxPressure.toFixed(3)})`,
        ],
        [
          `TiltX`,
          `${tiltX.toFixed(1)} (min: ${minTiltX.toFixed(
            1,
          )}, max: ${maxTiltX.toFixed(1)})`,
        ],
        [
          `TiltY`,
          `${tiltY.toFixed(1)} (min: ${minTiltY.toFixed(
            1,
          )}, max: ${maxTiltY.toFixed(1)})`,
        ],
        [
          `Width`,
          `${width.toFixed(1)} (min: ${minWidth.toFixed(
            1,
          )}, max: ${maxWidth.toFixed(1)})`,
        ],
        [
          `Height`,
          `${height.toFixed(1)} (min: ${minHeight.toFixed(
            1,
          )}, max: ${maxHeight.toFixed(1)})`,
        ],
      );
    }
    return rows;
  }, [data]);
  return (
    <div
      className={styles.root}
      touch-action="none"
      onPointerEnter={handlePointerEvent}
      onPointerLeave={handlePointerEvent}
      onPointerMove={handlePointerEvent}
      onPointerDown={handlePointerEvent}
      onPointerUp={handlePointerEvent}
      onPointerOut={handlePointerEvent}
      onPointerOver={handlePointerEvent}
    >
      <h1>PointerEvents Diagnostics</h1>
      <Table
        rows={[
          ...system,
          ['PointerEvents - click/drag/tap here to compute…'],
          ['Polyfill', PEPJS.PointerEvent === window.PointerEvent],
          ...dataRows,
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
  if (value === undefined) {
    return <em>Unknown</em>;
  }
  if (Array.isArray(value)) {
    return <strong>{value.join(', ')}</strong>;
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
      {rows.map((arr, index) => {
        const [name, value] = arr;
        if (arr.length === 1) {
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
