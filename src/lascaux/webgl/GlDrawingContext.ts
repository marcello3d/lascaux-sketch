import ProgramManager from './util/program-manager';
import { Program, ProgramOf } from './util/program';

import {
  DrawingContext,
  GetLinkFn,
  Links,
  Rects,
  Snapshot,
  SnapshotAndLinks,
  Tiles,
} from '../Drawlet';
import { ellipseShader } from './glsl-shaders/ellipse';
import { textureShader } from './glsl-shaders/texture';
import { lineShader } from './glsl-shaders/line';
import { rectShader } from './glsl-shaders/rect';
import { PromiseOrValue, then } from 'promise-or-value';
import { waitAll } from '../util/promise-or-value';
import {
  checkRenderTargetSupport,
  createFrameBuffer,
  FrameBuffer,
  FrameBufferInfo,
} from './util/gl-framebuffer';
import { TypedArray, TypedArrayConstructor } from '../util/typed-arrays';
import { checkError, getOrThrow } from './util/gl-errors';
import { setDrawingMatrix, setViewportMatrix } from './util/gl-matrix';
import { copyRgbaPixels, RgbaImage } from '../util/rgba-image';
import { float32ArrayToUint16Array } from '../util/float16';
import { Artboard, IdMap } from '../DrawingDoc';
import { newId } from '../../db/fields';

function makeTextureVertexArray(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): Float32Array {
  // prettier-ignore
  return new Float32Array([
    x1, y1, 0, 0,
    x2, y1, 1, 0,
    x1, y2, 0, 1,
    x2, y2, 1, 1
  ])
}

function getTileKey(tilex: number, tiley: number): string {
  return tilex + '.' + tiley;
}

type LayerInfo = {
  /** 2draw player: the DIRTY_TILE tiles drawn on since takeDirtyTiles()
   * (indexes ty * tilesX + tx), or true for all of them. */
  dirty?: Set<number> | true;
  changed?: {
    tiles: Record<string, ChangedTile>;
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
  tiles: Tiles;
  frameBuffer: FrameBuffer;
};

type ChangedTile = [
  // x
  number,
  // y
  number,
];

const ENABLE_HALF_FLOAT_SUPPORT = true;

/** 2draw player: the size of the tiles its keyframes track changes in. */
const DIRTY_TILE = 64;

export class GlDrawingContext implements DrawingContext {
  public readonly pixelWidth: number;
  public readonly pixelHeight: number;
  public readonly scale: number;
  public readonly tileSize: number;

  private canvas: HTMLCanvasElement;

  private _artboard: Artboard;
  private readonly _layers = new Map<string, LayerInfo>();
  private readonly gl: WebGLRenderingContext;
  private pixelRatio: number = 1;
  private _framebuffer: FrameBuffer | undefined;

  // Viewport transform
  private _textureRect: [number, number, number, number] = [0, 0, 0, 0];
  private _mainTextureVertexArray: Float32Array;

  private readonly _programManager: ProgramManager;
  private readonly _mainProgram: ProgramOf<typeof textureShader>;
  private readonly _textureProgram: ProgramOf<typeof textureShader>;
  private readonly _ellipseProgram: ProgramOf<typeof ellipseShader>;
  private readonly _rectProgram: ProgramOf<typeof rectShader>;
  private readonly _lineProgram: ProgramOf<typeof lineShader>;
  private readonly _mainVertexBuffer: WebGLBuffer;
  private readonly _positionVertexBuffer: WebGLBuffer;
  private readonly _rectVertexBuffer: WebGLBuffer;
  private readonly _colorVertexBuffer: WebGLBuffer;
  private readonly _drawingVertexIndexBuffer: WebGLBuffer;
  private readonly _EXT_blend_minmax: EXT_blend_minmax | null;
  private readonly _WEBGL_color_buffer_float: WEBGL_color_buffer_float | null;
  private readonly _OES_texture_float: OES_texture_float_linear | null;
  private readonly _OES_texture_half_float: OES_texture_half_float | null;
  private readonly _frameBufferType: GLenum;
  private readonly _frameBufferInfo: FrameBufferInfo;
  private readonly _frameBufferBits: number;

  private readonly _readBuffer: TypedArray;

  /** 2draw player: the canvas is the drawing's own size (no window sizing). */
  private readonly fixedSize: boolean;

  constructor(
    artboard: Artboard,
    tileSize: number = 64,
    options: {
      fixedSize?: boolean;
      /** 2draw player tests: use at most this framebuffer precision. */
      maxPrecision?: 'float32' | 'float16' | 'uint8';
    } = {},
  ) {
    this.fixedSize = options.fixedSize === true;
    this.tileSize = tileSize;

    this.scale = 1;

    const { width, height } = artboard;
    this.pixelWidth = width;
    this.pixelHeight = height;

    const canvas = document.createElement('canvas');

    canvas.style.position = 'absolute';
    canvas.style.left = '0';
    canvas.style.top = '0';

    this.canvas = canvas;
    if (this.fixedSize) {
      canvas.width = width;
      canvas.height = height;
    } else {
      this.sizeCanvasToWindow();
    }

    const gl = canvas.getContext('webgl', {
      preserveDrawingBuffer: true,
      alpha: true,
      depth: false,
      stencil: true,
      antialias: false,
      premultipliedAlpha: true,
    });

    if (!gl) {
      throw new Error('Cannot init webgl');
    }

    this.gl = gl;

    console.log(`[WEBGL] Checking capabilities...`);
    this._WEBGL_color_buffer_float = gl.getExtension(
      'WEBGL_color_buffer_float',
    );
    this._EXT_blend_minmax = gl.getExtension('EXT_blend_minmax');
    this._OES_texture_float = gl.getExtension('OES_texture_float');
    this._OES_texture_half_float = gl.getExtension('OES_texture_half_float');
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);

    const maxPrecision = options.maxPrecision ?? 'float32';
    const floatCombos =
      maxPrecision === 'float32' &&
      this._OES_texture_float &&
      checkRenderTargetSupport(gl, gl.RGBA, gl.FLOAT);
    if (
      Array.isArray(floatCombos) &&
      gl.getExtension('OES_texture_float_linear')
    ) {
      this._frameBufferType = gl.FLOAT;
      this._frameBufferInfo = floatCombos[0];
    } else {
      const halfFloatCombos =
        ENABLE_HALF_FLOAT_SUPPORT &&
        maxPrecision !== 'uint8' &&
        this._OES_texture_half_float &&
        checkRenderTargetSupport(
          gl,
          gl.RGBA,
          this._OES_texture_half_float.HALF_FLOAT_OES,
          this._OES_texture_half_float.HALF_FLOAT_OES,
        );
      if (
        this._OES_texture_half_float &&
        Array.isArray(halfFloatCombos) &&
        gl.getExtension('OES_texture_half_float_linear')
      ) {
        this._frameBufferType = this._OES_texture_half_float.HALF_FLOAT_OES;
        this._frameBufferInfo = halfFloatCombos[0];
      } else {
        const byteCombo = checkRenderTargetSupport(
          gl,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
        );
        if (Array.isArray(byteCombo)) {
          this._frameBufferType = gl.UNSIGNED_BYTE;
          this._frameBufferInfo = byteCombo[0];
        } else {
          throw new Error(`no valid frame buffer support`);
        }
      }
    }
    const {
      ReadTypedArray,
      WriteTypedArray,
      readTypeName,
      writeTypeName,
    } = this._frameBufferInfo;
    this._readBuffer = new ReadTypedArray(width * height * 4);
    this._frameBufferBits = new WriteTypedArray(1).BYTES_PER_ELEMENT * 8 * 4;

    console.log(
      `[WEBGL] Using ${writeTypeName} RGBA textures (${readTypeName} read)`,
    );

    gl.enable(gl.BLEND);
    // gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    //  A OVER B
    // SRC OVER DST

    // a0 = alpha A + alpha B (1 - alpha A)
    // a0 = alpha SRC * 1 + alpha DST (1 - alpha SRC)
    gl.blendFuncSeparate(
      gl.SRC_ALPHA,
      gl.ONE_MINUS_SRC_ALPHA,
      gl.ONE,
      gl.ONE_MINUS_SRC_ALPHA,
    );

    this._programManager = new ProgramManager(gl);
    this._mainProgram = this._createMainGlProgram(gl);
    const updateCanvasAndGl = () => {
      requestAnimationFrame(() => {
        this.sizeCanvasToWindow();
        this.updateViewport();
        this.repaint();
      });
    };
    if (!this.fixedSize) {
      window.addEventListener('resize', updateCanvasAndGl, false);
    }

    this._textureProgram = this._createTextureProgram(gl, width, height);
    this._ellipseProgram = this._createEllipseProgram(gl, width, height);
    this._rectProgram = this._createRectProgram(gl, width, height);
    this._lineProgram = this._createLineProgram(gl, width, height);

    this._mainVertexBuffer = getOrThrow(gl.createBuffer(), 'createBuffer');
    this._positionVertexBuffer = getOrThrow(gl.createBuffer(), 'createBuffer');
    this._rectVertexBuffer = getOrThrow(gl.createBuffer(), 'createBuffer');
    this._colorVertexBuffer = getOrThrow(gl.createBuffer(), 'createBuffer');
    this._drawingVertexIndexBuffer = getOrThrow(
      gl.createBuffer(),
      'createBuffer',
    );
    this._mainTextureVertexArray = makeTextureVertexArray(
      0,
      0,
      this.pixelWidth,
      this.pixelHeight,
    );

    this.setArtboard(artboard);
    this._artboard = artboard;

    if (this.fixedSize) {
      this.pixelRatio = 1;
      this.updateViewport(1);
    } else {
      updateCanvasAndGl();
    }

    checkError(gl);
  }
  reset(artboard: Artboard) {
    for (const layerInfo of this._layers.values()) {
      layerInfo.frameBuffer.destroy();
    }
    this._layers.clear();
    this._artboard = undefined!;
    this.setArtboard(artboard);
  }

  setArtboard(newArtboard: Artboard): void {
    const oldArtboard = this._artboard;
    this._artboard = newArtboard;
    if (
      !oldArtboard ||
      newArtboard.width !== oldArtboard.width ||
      newArtboard.height !== oldArtboard.height
    ) {
      // do something when artboard changes size....not sure what
    }
    if (!oldArtboard || newArtboard.layers !== oldArtboard.layers) {
      const existingLayers = new Set<string>(this._layers.keys());
      for (const layer of Object.keys(newArtboard.layers)) {
        if (existingLayers.has(layer)) {
          existingLayers.delete(layer);
          continue;
        }
        this._layers.set(layer, this.makeLayer());
      }

      // Deleted layer (if still in existingLayers, it's not in the new doc)
      for (const id of existingLayers) {
        const layer = this._layers.get(id);
        layer!.frameBuffer.destroy();
        this._layers.delete(id);
      }
    }
  }

  private updateViewport(pixelRatio = this.pixelRatio) {
    const { gl } = this;
    this._programManager.use(this._mainProgram);
    setViewportMatrix(
      gl,
      this._mainProgram.uniforms.uMVMatrix,
      gl.drawingBufferWidth / pixelRatio,
      gl.drawingBufferHeight / pixelRatio,
    );
  }

  sizeCanvasToWindow() {
    const { canvas } = this;
    const el = canvas.parentElement || document.documentElement;
    const screenWidth = el.clientWidth;
    const screenHeight = el.clientHeight;
    canvas.style.width = screenWidth + 'px';
    canvas.style.height = screenHeight + 'px';

    this.pixelRatio = window.devicePixelRatio;
    canvas.width = screenWidth * this.pixelRatio;
    canvas.height = screenHeight * this.pixelRatio;
  }

  private bindFrameBuffer(buffer?: FrameBuffer): void {
    if (this._framebuffer === buffer) {
      return;
    }
    const { gl } = this;
    gl.bindFramebuffer(gl.FRAMEBUFFER, buffer ? buffer.framebuffer : null);
    gl.blendEquation(gl.FUNC_ADD);
    if (buffer) {
      // Not pre-multiplied
      gl.blendFuncSeparate(
        gl.SRC_ALPHA,
        gl.ONE_MINUS_SRC_ALPHA,
        gl.ONE,
        gl.ONE_MINUS_SRC_ALPHA,
      );
      this.gl.viewport(0, 0, this.pixelWidth, this.pixelHeight);
    } else {
      // Premultiplied
      gl.blendFuncSeparate(
        gl.ONE,
        gl.ONE_MINUS_SRC_ALPHA,
        gl.ONE,
        gl.ONE_MINUS_SRC_ALPHA,
      );
    }
    this._framebuffer = buffer;
  }

  private makeLayer(): LayerInfo {
    const { gl, pixelWidth, pixelHeight, _frameBufferType, tileSize } = this;

    // Added layer
    const frameBuffer = createFrameBuffer(
      gl,
      pixelWidth,
      pixelHeight,
      _frameBufferType,
      gl.RGBA,
    );

    this.bindFrameBuffer(frameBuffer);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    const tiles: Tiles = {};

    const tilex2 = Math.floor(this.pixelWidth / tileSize - 1);
    const tiley2 = Math.floor(this.pixelHeight / tileSize - 1);
    for (let tiley = 0; tiley <= tiley2; tiley++) {
      for (let tilex = 0; tilex <= tilex2; tilex++) {
        const key = getTileKey(tilex, tiley);
        const x = tilex * tileSize;
        const y = tiley * tileSize;
        tiles[key] = { x, y, link: null };
      }
    }
    // 2draw player: a new layer is blank, all of it changed.
    return { frameBuffer, tiles, dirty: true };
  }

  getPng(): Promise<Blob> {
    const { canvas, _mainTextureVertexArray, pixelWidth, pixelHeight } = this;
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
    this._mainTextureVertexArray = makeTextureVertexArray(
      0,
      0,
      pixelWidth,
      pixelHeight,
    );
    this.updateViewport(1);
    this.repaint(true);
    return new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/png');
    }).then((blob) => {
      this._mainTextureVertexArray = _mainTextureVertexArray;
      this.sizeCanvasToWindow();
      this.updateViewport();
      this.repaint();
      if (blob === null) {
        throw new Error('Could not get image');
      }
      return blob;
    });
  }

  getSnapshotAndLinks(): SnapshotAndLinks {
    const links: Links = {};
    const start = Date.now();
    const { tileSize, _readBuffer, _layers, _frameBufferInfo, gl } = this;
    const { WriteTypedArray, glReadType } = _frameBufferInfo;
    let changedTileCount = 0;
    const layers: IdMap<Tiles> = {};
    let getPixelCount = 0;
    let getPixelTime = 0;
    for (const [layerId, layerInfo] of _layers.entries()) {
      const { tiles, changed } = layerInfo;
      layers[layerId] = { ...tiles };
      if (!changed) {
        continue;
      }
      const { tiles: changedTiles, maxX, minY, minX, maxY } = changed;
      const tileKeys = Object.keys(changedTiles);
      this.bindToLayer(layerInfo);
      const width = maxX - minX;
      const height = maxY - minY;
      const start1 = Date.now();

      let pixels = _readBuffer.subarray(0, width * height * 4);
      gl.readPixels(minX, minY, width, height, gl.RGBA, glReadType, pixels);
      getPixelCount++;
      getPixelTime += Date.now() - start1;

      const savedBuffer = { pixels, width, height };
      for (const key of tileKeys) {
        const [x, y] = changedTiles[key];
        const tile = copyRgbaPixels(
          savedBuffer,
          WriteTypedArray,
          x - minX,
          y - minY,
          tileSize,
          tileSize,
        );
        const link = newId();
        tiles[key] = { x, y, link };
        links[link] = tile;
        changedTileCount++;
      }
      layers[layerId] = { ...tiles };
      delete layerInfo.changed;
    }
    console.log(
      `snapshot generated in ${
        Date.now() - start
      } ms (read pixels: ${getPixelTime} ms): ${getPixelCount} changed layers, ${changedTileCount} changed tiles, ${
        Object.keys(links).length
      } links`,
    );
    return {
      snapshot: {
        layers,
        tileSize,
      },
      links,
    };
  }

  loadSnapshot(
    { layers, tileSize }: Snapshot,
    getLink: GetLinkFn,
  ): PromiseOrValue<void> {
    if (tileSize !== this.tileSize) {
      throw new Error('tileSize mismatch');
    }
    return waitAll(
      Object.keys(layers).map((layerId) => {
        const layerInfo = this._layers.get(layerId);
        if (!layerInfo) {
          throw new Error('unknown layer!');
        }
        const { changed, tiles } = layerInfo;
        const snapshotTiles = layers[layerId];
        return waitAll(
          Object.keys(snapshotTiles).map(
            (key): PromiseOrValue<void> => {
              const tile = snapshotTiles[key];
              const { x, y, link } = tile;

              // Tile in snapshot matches current buffer
              if (!changed?.tiles[key] && tiles[key]?.link === link) {
                tiles[key] = tile;
                return undefined;
              }
              // Tile is blank in snapshot
              if (link === null) {
                this._clearTile(layerInfo, x, y);
                tiles[key] = tile;
                return undefined;
              }
              // Need to load the tile...
              return then(getLink(link), (image) => {
                if (!image) {
                  throw new Error(`no tile ${link} for ${key}`);
                }
                tiles[key] = tile;
                if (layerInfo.changed) {
                  delete layerInfo.changed.tiles[key];
                }
                this.putTile(layerInfo, x, y, image);
              });
            },
          ),
        );
      }),
    );
  }

  getDom(): HTMLCanvasElement {
    return this.canvas;
  }

  private saveRect(
    layerInfo: LayerInfo,
    x: number,
    y: number,
    w: number,
    h: number,
  ): void {
    if (w <= 0 || h <= 0) {
      // no-op
      return;
    }

    const tileSize = this.tileSize;
    const tilex1 = Math.max(0, Math.floor(x / tileSize));
    const tiley1 = Math.max(0, Math.floor(y / tileSize));
    const tilex2 = Math.floor(
      Math.min((x + w) / tileSize, this.pixelWidth / tileSize - 1),
    );
    const tiley2 = Math.floor(
      Math.min((y + h) / tileSize, this.pixelHeight / tileSize - 1),
    );

    const changed =
      layerInfo.changed ||
      (layerInfo.changed = {
        tiles: {},
        minX: Infinity,
        maxX: -Infinity,
        minY: Infinity,
        maxY: -Infinity,
      });
    changed.minX = Math.min(changed.minX, tilex1 * tileSize);
    changed.maxX = Math.max(changed.maxX, (tilex2 + 1) * tileSize);
    changed.minY = Math.min(changed.minY, tiley1 * tileSize);
    changed.maxY = Math.max(changed.maxY, (tiley2 + 1) * tileSize);
    for (let tiley = tiley1; tiley <= tiley2; tiley++) {
      for (let tilex = tilex1; tilex <= tilex2; tilex++) {
        const key = getTileKey(tilex, tiley);
        if (!changed.tiles[key]) {
          changed.tiles[key] = [tilex * tileSize, tiley * tileSize];
        }
      }
    }
  }

  private putTile(
    layerInfo: LayerInfo,
    x: number,
    y: number,
    { pixels, width, height }: RgbaImage,
  ) {
    this.bindToLayer(layerInfo);
    const { gl } = this;
    gl.bindTexture(gl.TEXTURE_2D, layerInfo.frameBuffer.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texSubImage2D(
      gl.TEXTURE_2D,
      0,
      x,
      y,
      width,
      height,
      gl.RGBA,
      this._frameBufferInfo.glWriteType,
      pixels,
    );
  }
  private _clearTile(layerInfo: LayerInfo, x: number, y: number) {
    const { gl, tileSize } = this;
    this.bindToLayer(layerInfo);
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(x, y, tileSize, tileSize);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.disable(gl.SCISSOR_TEST);
  }

  setTransform(translateX: number, translateY: number, scale: number): void {
    const { pixelRatio, pixelWidth, pixelHeight } = this;
    const scaledWidth = pixelWidth * scale;
    const scaledHeight = pixelHeight * scale;
    this._textureRect = [
      translateX * pixelRatio,
      translateY * pixelRatio,
      scaledWidth * pixelRatio,
      scaledHeight * pixelRatio,
    ];
    this._mainTextureVertexArray = makeTextureVertexArray(
      translateX,
      translateY,
      translateX + scaledWidth,
      translateY + scaledHeight,
    );
    this.repaint();
  }

  repaint(exportMode: boolean = false) {
    if (!this._mainProgram) {
      return;
    }
    const {
      _layers,
      _textureRect: [x, y, w, h],
      gl,
      _mainTextureVertexArray,
      _mainProgram,
      _artboard: { baseColor, rootLayers },
    } = this;
    this.bindFrameBuffer();
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    if (!exportMode) {
      gl.clearColor(0x33 / 255, 0x33 / 255, 0x33 / 255, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    if (baseColor) {
      if (!exportMode) {
        gl.enable(gl.SCISSOR_TEST);
        // Only clear the area where the drawing will be
        const yy = gl.drawingBufferHeight - y - h;
        const x1 = Math.round(x);
        const y1 = Math.round(yy);
        const x2 = Math.round(w + x);
        const y2 = Math.round(h + yy);
        gl.scissor(x1, y1, x2 - x1, y2 - y1);
      }
      const [r, g, b, a] = baseColor;
      gl.clearColor(r, g, b, a);
      gl.clear(gl.COLOR_BUFFER_BIT);
      if (!exportMode) {
        gl.disable(gl.SCISSOR_TEST);
      }
    }

    for (const layer of rootLayers) {
      const layerInfo = _layers.get(layer);
      if (!layerInfo) {
        throw new Error('unexpected layer');
      }
      this._drawTexture(
        _mainProgram,
        layerInfo.frameBuffer.texture,
        _mainTextureVertexArray,
      );
    }
  }

  private _drawTexture(
    program: ProgramOf<typeof textureShader>,
    texture: WebGLTexture,
    textureVertexArray: Float32Array,
  ) {
    if (!textureVertexArray) {
      return;
    }
    const gl = this.gl;

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    this._programManager.use(program);

    gl.bindBuffer(gl.ARRAY_BUFFER, this._mainVertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, textureVertexArray, gl.STATIC_DRAW);
    gl.vertexAttribPointer(
      program.attributes.aPosition,
      4,
      gl.FLOAT,
      false,
      0,
      0,
    );

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  private _createMainGlProgram(gl: WebGLRenderingContext) {
    const program = new Program(gl, textureShader);
    this._programManager.use(program);
    program.enable();
    return program;
  }

  private _createTextureProgram(
    gl: WebGLRenderingContext,
    width: number,
    height: number,
  ) {
    const program = new Program(gl, textureShader);
    this._programManager.use(program);
    setDrawingMatrix(gl, program.uniforms.uMVMatrix, width, height);
    return program;
  }

  private _createEllipseProgram(
    gl: WebGLRenderingContext,
    width: number,
    height: number,
  ) {
    const program = new Program(gl, ellipseShader);
    this._programManager.use(program);
    setDrawingMatrix(gl, program.uniforms.uMVMatrix, width, height);
    return program;
  }

  private _createLineProgram(
    gl: WebGLRenderingContext,
    width: number,
    height: number,
  ) {
    const program = new Program(gl, lineShader);
    this._programManager.use(program);
    setDrawingMatrix(gl, program.uniforms.uMVMatrix, width, height);
    return program;
  }

  private _createRectProgram(
    gl: WebGLRenderingContext,
    width: number,
    height: number,
  ) {
    const program = new Program(gl, rectShader);
    this._programManager.use(program);
    setDrawingMatrix(gl, program.uniforms.uMVMatrix, width, height);
    return program;
  }

  private getLayerInfo(layerId: string): LayerInfo {
    const layerInfo = this._layers.get(layerId);
    if (!layerInfo) {
      throw new Error('unknown layer');
    }
    return layerInfo;
  }

  private bindToLayer({ frameBuffer }: LayerInfo): void {
    this.bindFrameBuffer(frameBuffer);
  }

  private _drawLine(
    layerInfo: LayerInfo,
    x1: number,
    y1: number,
    size1: number,
    x2: number,
    y2: number,
    size2: number,
    r: number,
    g: number,
    b: number,
    a: number = 1,
    save: boolean = true,
  ) {
    const gl = this.gl;

    const halfSize1 = size1 / 2 + 1;
    const halfSize2 = size2 / 2 + 1;
    const minx = Math.min(x1 - halfSize1, x2 - halfSize2);
    const maxx = Math.max(x1 + halfSize1, x2 + halfSize2);
    const miny = Math.min(y1 - halfSize1, y2 - halfSize2);
    const maxy = Math.max(y1 + halfSize1, y2 + halfSize2);

    this.markDirty(layerInfo, minx, miny, maxx, maxy);
    this.bindToLayer(layerInfo);
    if (save) {
      this.saveRect(layerInfo, minx, miny, maxx - minx, maxy - miny);
    }
    this._programManager.use(this._lineProgram);

    gl.uniform4f(this._lineProgram.uniforms.uColor, r, g, b, a);
    gl.uniform4f(this._lineProgram.uniforms.uPos1, x1, y1, size1, 1);
    gl.uniform4f(this._lineProgram.uniforms.uPos2, x2, y2, size2, 1);

    gl.bindBuffer(gl.ARRAY_BUFFER, this._positionVertexBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([minx, miny, maxx, miny, minx, maxy, maxx, maxy]),
      gl.STATIC_DRAW,
    );
    gl.vertexAttribPointer(
      this._lineProgram.attributes.aPosition,
      2,
      gl.FLOAT,
      false,
      0,
      0,
    );
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  fillEllipses(layer: string, rects: Rects, hardness: number, erase: boolean) {
    this._fillRectEllipses(
      this.getLayerInfo(layer),
      rects,
      true,
      hardness,
      erase,
    );
  }
  private _fillRectEllipses(
    layerInfo: LayerInfo,
    rects: Rects,
    ellipse: boolean,
    hardness: number,
    erase: boolean = false,
  ) {
    // Build list of vertices
    const rectCount = rects.length;
    if (rectCount === 0) {
      return;
    }
    const vertexPosArray = new Float32Array(rectCount * 4 * 2);
    const vertexRectArray = ellipse
      ? new Float32Array(rectCount * 4 * 4)
      : undefined;
    const vertexColorArray = new Float32Array(rectCount * 4 * 4);
    const vertexIndexArray = new Uint16Array(rectCount * 6);
    let actualRects = 0;
    // 2draw player: the box all of them touch
    let dirtyX1 = Infinity;
    let dirtyY1 = Infinity;
    let dirtyX2 = -Infinity;
    let dirtyY2 = -Infinity;

    const { pixelWidth, pixelHeight } = this;
    for (let i = 0, j = 0, k = 0, l = 0, m = 0; i < rectCount; i++) {
      const [x, y, w, h, r, g, b, a] = rects[i];
      let x1 = x;
      let y1 = y;
      let x2 = x1 + w;
      let y2 = y1 + h;
      if (x2 < 0 || y2 < 0 || x1 > pixelWidth || y1 > pixelHeight) {
        continue;
      }
      // Add margin for antialiasing
      x1 -= 1;
      y1 -= 1;
      x2 += 1;
      y2 += 1;

      this.saveRect(layerInfo, x1, y1, x2 - x1, y2 - y1);
      dirtyX1 = Math.min(dirtyX1, x1);
      dirtyY1 = Math.min(dirtyY1, y1);
      dirtyX2 = Math.max(dirtyX2, x2);
      dirtyY2 = Math.max(dirtyY2, y2);

      //  0 --- 1
      //  |     |
      //  2 --- 4

      // equation for ellipse: x² / a² + y² / b² = 1 (where a = width/2 and b = height/2)
      // -> x*x / (width*width/4) + y*y / (height*height/4) = 1
      // -> 4*x*x / (width*width) + 4*y*y / (height*height) = 1
      const rectx = x; //+ w * 0.5;
      const recty = y; //+ h * 0.5;
      const rectz = w; //4 / (w * w);
      const rectw = h; //4 / (h * h);

      // Set 4 coordinates for triangles corners
      vertexPosArray[j++] = x1;
      vertexPosArray[j++] = y1;

      vertexPosArray[j++] = x2;
      vertexPosArray[j++] = y1;

      vertexPosArray[j++] = x1;
      vertexPosArray[j++] = y2;

      vertexPosArray[j++] = x2;
      vertexPosArray[j++] = y2;

      for (let i = 0; i < 4; i++) {
        if (vertexRectArray) {
          vertexRectArray[l++] = rectx;
          vertexRectArray[l++] = recty;
          vertexRectArray[l++] = rectz;
          vertexRectArray[l++] = rectw;
        }

        vertexColorArray[m++] = r;
        vertexColorArray[m++] = g;
        vertexColorArray[m++] = b;
        vertexColorArray[m++] = a;
      }

      const indexBase = i * 4;
      vertexIndexArray[k++] = indexBase;
      vertexIndexArray[k++] = indexBase + 1;
      vertexIndexArray[k++] = indexBase + 2;

      vertexIndexArray[k++] = indexBase + 1;
      vertexIndexArray[k++] = indexBase + 2;
      vertexIndexArray[k++] = indexBase + 3;
      actualRects++;
    }
    if (actualRects > 0) {
      this.markDirty(layerInfo, dirtyX1, dirtyY1, dirtyX2, dirtyY2);
      this.bindToLayer(layerInfo);
      const gl = this.gl;
      if (erase) {
        gl.blendFunc(gl.ZERO, gl.ONE_MINUS_SRC_ALPHA);
        gl.blendEquationSeparate(gl.FUNC_ADD, gl.FUNC_REVERSE_SUBTRACT);
      } else {
        gl.blendFuncSeparate(
          gl.SRC_ALPHA,
          gl.ONE_MINUS_SRC_ALPHA,
          gl.ONE,
          gl.ONE_MINUS_SRC_ALPHA,
        );
        gl.blendEquation(gl.FUNC_ADD);
      }

      let attributes;
      if (ellipse) {
        this._programManager.use(this._ellipseProgram);
        attributes = this._ellipseProgram.attributes;

        if (vertexRectArray) {
          gl.bindBuffer(gl.ARRAY_BUFFER, this._rectVertexBuffer);
          gl.bufferData(gl.ARRAY_BUFFER, vertexRectArray, gl.STREAM_DRAW);
          gl.vertexAttribPointer(attributes.aRect, 4, gl.FLOAT, false, 0, 0);
        }

        gl.uniform1f(this._ellipseProgram.uniforms.uHardness, hardness);
      } else {
        this._programManager.use(this._rectProgram);
        attributes = this._rectProgram.attributes;
      }

      gl.bindBuffer(gl.ARRAY_BUFFER, this._positionVertexBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, vertexPosArray, gl.STREAM_DRAW);
      gl.vertexAttribPointer(attributes.aPosition, 2, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, this._colorVertexBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, vertexColorArray, gl.STREAM_DRAW);
      gl.vertexAttribPointer(attributes.aColor, 4, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._drawingVertexIndexBuffer);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, vertexIndexArray, gl.STREAM_DRAW);
      gl.drawElements(gl.TRIANGLES, actualRects * 6, gl.UNSIGNED_SHORT, 0);
    }
  }
  getInfo(): string {
    const {
      pixelHeight,
      pixelWidth,
      _layers,
      _frameBufferBits,
      _frameBufferInfo,
    } = this;
    const layerIds = Object.keys(_layers);
    const tileCount =
      layerIds.length * Object.keys(_layers.get(layerIds[0]) ?? {}).length;
    return `WebGL ${_frameBufferInfo.writeTypeName} (${_frameBufferBits} bit): ${pixelWidth}x${pixelHeight} (${tileCount} tiles)`;
  }

  // --- 2draw player additions (keyframes, fixed-size display) ---

  /** The player's dirty-tile grid: DIRTY_TILE px squares from the
   * framebuffer's origin (drawing coordinates: the drawing matrix doesn't
   * flip), partial ones at the right and bottom. */
  get dirtyGrid(): { size: number; tilesX: number; tilesY: number } {
    const size = DIRTY_TILE;
    return {
      size,
      tilesX: Math.ceil(Number(this.pixelWidth) / size),
      tilesY: Math.ceil(Number(this.pixelHeight) / size),
    };
  }

  /** The box x1..x2, y1..y2 (drawing coordinates) may change: widened by a
   * pixel each way. */
  private markDirty(layerInfo: LayerInfo, x1: number, y1: number, x2: number, y2: number) {
    if (layerInfo.dirty === true) {
      return;
    }
    const { size, tilesX, tilesY } = this.dirtyGrid;
    const tx1 = Math.max(0, Math.floor((Math.min(x1, x2) - 1) / size));
    const ty1 = Math.max(0, Math.floor((Math.min(y1, y2) - 1) / size));
    const tx2 = Math.min(tilesX - 1, Math.floor((Math.max(x1, x2) + 1) / size));
    const ty2 = Math.min(tilesY - 1, Math.floor((Math.max(y1, y2) + 1) / size));
    if (tx2 < tx1 || ty2 < ty1) {
      return;
    }
    const dirty = (layerInfo.dirty ??= new Set<number>()) as Set<number>;
    for (let ty = ty1; ty <= ty2; ty++) {
      for (let tx = tx1; tx <= tx2; tx++) {
        dirty.add(ty * tilesX + tx);
      }
    }
  }

  /** The layer ids, in no particular order. */
  layerIds(): string[] {
    return Array.from(this._layers.keys());
  }

  /** The dirty-grid tiles drawn on in `layerId` since the last call (true:
   * all of them), or null for none. */
  takeDirtyTiles(layerId: string): Set<number> | true | null {
    const info = this.getLayerInfo(layerId);
    const d = info.dirty ?? null;
    delete info.dirty;
    delete info.changed;
    return d;
  }

  /** Every layer: only the dirty-grid tiles not inside the top-left
   * width × height count as drawn on (after that part was restored). */
  setDirtyOutside(width: number, height: number): void {
    const { size, tilesX, tilesY } = this.dirtyGrid;
    const inX = Math.floor(width / size);
    const inY = Math.floor(height / size);
    for (const info of this._layers.values()) {
      const dirty = new Set<number>();
      for (let ty = 0; ty < tilesY; ty++) {
        for (let tx = 0; tx < tilesX; tx++) {
          if (tx >= inX || ty >= inY) {
            dirty.add(ty * tilesX + tx);
          }
        }
      }
      info.dirty = dirty;
      delete info.changed;
    }
  }

  /** Whether dirty-grid tile `index` of a layer was drawn on (since the
   * last takeDirtyTiles, clearDirty or setDirtyOutside). */
  isDirty(layerId: string, index: number): boolean {
    const dirty = this.getLayerInfo(layerId).dirty;
    return dirty === true || (dirty !== undefined && dirty.has(index));
  }

  /** Overwrite a rectangle of a layer with stored data (w × h pixels, row by
   * row from y). */
  writeLayerRect(layerId: string, x: number, y: number, w: number, h: number, data: TypedArray): void {
    const { gl } = this;
    const layerInfo = this.getLayerInfo(layerId);
    this.bindToLayer(layerInfo);
    gl.bindTexture(gl.TEXTURE_2D, layerInfo.frameBuffer.texture);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, w, h, gl.RGBA, this._frameBufferInfo.glWriteType, data);
  }

  /** Forget what was drawn where (after a restore or reset). */
  clearDirty(): void {
    for (const info of this._layers.values()) {
      delete info.dirty;
      delete info.changed;
    }
  }

  /** Elements per pixel row of a layer's stored data (RGBA). */
  get rowLength(): number {
    return Number(this.pixelWidth) * 4;
  }

  /** The typed array a layer's stored data comes in (texSubImage2D's). */
  get storedArrayType(): TypedArrayConstructor {
    return this._frameBufferInfo.WriteTypedArray;
  }

  /** Rows [from, to) of a layer, as stored data (the framebuffer's own
   * precision: float32, float16 bits or bytes). */
  readLayerRows(layerId: string, from: number, to: number): TypedArray {
    return this.readLayerRect(layerId, 0, from, Number(this.pixelWidth), to - from);
  }

  /** A rectangle of a layer, as stored data, row by row from y. */
  readLayerRect(layerId: string, x: number, y: number, width: number, rows: number): TypedArray {
    const { gl, _frameBufferInfo } = this;
    const { ReadTypedArray, WriteTypedArray, glReadType } = _frameBufferInfo;
    this.bindToLayer(this.getLayerInfo(layerId));
    const read = new ReadTypedArray(width * rows * 4);
    gl.readPixels(x, y, width, rows, gl.RGBA, glReadType, read);
    if (read instanceof (WriteTypedArray as unknown as Function)) {
      return read;
    }
    if (read instanceof Float32Array && WriteTypedArray === Uint16Array) {
      return float32ArrayToUint16Array(read);
    }
    const out = new WriteTypedArray(read.length);
    out.set(read);
    return out;
  }

  /** Overwrite a whole layer with stored data (readLayerRows' format). */
  writeLayer(layerId: string, data: TypedArray): void {
    const { gl } = this;
    const layerInfo = this.getLayerInfo(layerId);
    this.bindToLayer(layerInfo);
    gl.bindTexture(gl.TEXTURE_2D, layerInfo.frameBuffer.texture);
    gl.texSubImage2D(
      gl.TEXTURE_2D,
      0,
      0,
      0,
      Number(this.pixelWidth),
      Number(this.pixelHeight),
      gl.RGBA,
      this._frameBufferInfo.glWriteType,
      data,
    );
  }

  /**
   * The part of a layer the editor's snapshots cover (CanvasModel's gotos
   * restore only this): whole tiles, from the top-left; a partial tile at the
   * right or bottom edge isn't in them (makeLayer, saveRect).
   */
  get snapshotRegion(): { width: number; height: number } {
    const { tileSize } = this;
    const tilesX = Math.floor(Number(this.pixelWidth) / tileSize - 1) + 1;
    const tilesY = Math.floor(Number(this.pixelHeight) / tileSize - 1) + 1;
    return { width: Math.max(0, tilesX) * tileSize, height: Math.max(0, tilesY) * tileSize };
  }

  /** Overwrite the top-left width × height of a layer from whole-layer
   * stored data (readLayerRows' format), leaving the rest as it is. */
  writeLayerRegion(layerId: string, data: TypedArray, width: number, height: number): void {
    if (width <= 0 || height <= 0) {
      return;
    }
    const { gl } = this;
    const stride = Number(this.pixelWidth) * 4;
    let rect: TypedArray;
    if (width * 4 === stride) {
      rect = data.subarray(0, stride * height);
    } else {
      rect = new (this._frameBufferInfo.WriteTypedArray)(width * 4 * height);
      for (let y = 0; y < height; y++) {
        rect.set(data.subarray(y * stride, y * stride + width * 4), y * width * 4);
      }
    }
    const layerInfo = this.getLayerInfo(layerId);
    this.bindToLayer(layerInfo);
    gl.bindTexture(gl.TEXTURE_2D, layerInfo.frameBuffer.texture);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width, height, gl.RGBA, this._frameBufferInfo.glWriteType, rect);
  }

  /** Draw the drawing onto the (fixed-size) canvas, as getPng does. */
  present(): void {
    this.repaint(true);
  }

  /** The drawing's pixels as shown (for tests): RGBA bytes, bottom row first. */
  readCanvas(): Uint8Array {
    const { gl } = this;
    this.bindFrameBuffer();
    const out = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
    gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, out);
    return out;
  }

  getLayerCount(): number {
    return Object.keys(this._layers).length;
  }
}
