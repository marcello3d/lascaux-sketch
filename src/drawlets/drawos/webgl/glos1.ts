import {
  checkError,
  checkRenderTargetSupport,
  copyRgbaPixels,
  createFrameBuffer,
  FrameBuffer,
  FrameBufferInfo,
  getOrThrow,
  RgbaImage,
  setDrawingMatrix,
  setViewportMatrix,
  TypedArray,
} from './util';

import ProgramManager from './program-manager';
import { Dna } from '../dna';
import { Program, ProgramOf } from './program';

import {
  DrawingContext,
  DrawOs,
  GetLinkFn,
  Links,
  Rects,
  Snap,
  Snapshot,
  Tiles,
} from '../../Drawlet';
import { ellipseShader } from './glsl/ellipse';
import { textureShader } from './glsl/texture';
import { lineShader } from './glsl/line';
import { rectShader } from './glsl/rect';
import { PromiseOrValue, then } from 'promise-or-value';
import { waitAll } from '../../util/promise-or-value';

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

function getTileKey(layer: number, tilex: number, tiley: number): string {
  return layer + '.' + tilex + '.' + tiley;
}

type Layer = {
  changed?: {
    tiles: Record<string, ChangedTile>;
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
  frameBuffer: FrameBuffer;
};

type ChangedTile = [
  // x
  number,
  // y
  number,
];

const ENABLE_HALF_FLOAT_SUPPORT = true;

export class GlOS1 implements DrawOs {
  public readonly dna: Dna;
  public readonly pixelWidth: number;
  public readonly pixelHeight: number;
  public readonly scale: number;
  public readonly tileSize: number;

  private canvas: HTMLCanvasElement;

  private readonly _layers: Array<Layer> = [];
  private _tiles: Tiles = {};
  private _links: Links = {};
  private readonly gl: WebGLRenderingContext;
  private pixelRatio: number = 1;
  private _framebuffer: FrameBuffer | undefined;

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

  private readonly flipForSafari: boolean;

  private readonly _readBuffer: TypedArray;

  constructor(dna: Dna, scale: number = 1, tileSize: number = 64) {
    this.dna = dna;
    this.tileSize = tileSize;

    this.scale = scale;

    const pixelWidth = Math.ceil(this.dna.width * scale);
    const pixelHeight = Math.ceil(this.dna.height * scale);
    this.pixelWidth = pixelWidth;
    this.pixelHeight = pixelHeight;

    const canvas = document.createElement('canvas');

    canvas.style.position = 'absolute';
    canvas.style.left = '0';
    canvas.style.top = '0';

    this.canvas = canvas;
    this.sizeCanvasToWindow();

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

    const floatCombos =
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
    this._readBuffer = new ReadTypedArray(pixelWidth * pixelHeight * 4);
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
        this._redraw();
      });
    };
    window.addEventListener('resize', updateCanvasAndGl, false);

    this._textureProgram = this._createTextureProgram(
      gl,
      pixelWidth,
      pixelHeight,
    );
    this._ellipseProgram = this._createEllipseProgram(
      gl,
      pixelWidth,
      pixelHeight,
    );
    this._rectProgram = this._createRectProgram(gl, pixelWidth, pixelHeight);
    this._lineProgram = this._createLineProgram(gl, pixelWidth, pixelHeight);

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

    this.initialize();

    updateCanvasAndGl();

    checkError(gl);
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
    const screenWidth = document.documentElement.clientWidth;
    const screenHeight = document.documentElement.clientHeight;
    canvas.style.width = screenWidth + 'px';
    canvas.style.height = screenHeight + 'px';

    this.pixelRatio = window.devicePixelRatio;
    canvas.width = screenWidth * this.pixelRatio;
    canvas.height = screenHeight * this.pixelRatio;
  }

  initialize(): void {
    for (let i = 0; i < this._layers.length; i++) {
      this._layers[i].frameBuffer.destroy();
    }
    this._layers.length = 0;
    this._addLayer();
  }

  private _bindFrameBuffer(buffer?: FrameBuffer) {
    if (this._framebuffer !== buffer) {
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
  }
  private _addLayer() {
    const { gl } = this;
    const {
      _layers,
      pixelWidth,
      pixelHeight,
      _frameBufferType,
      tileSize,
      _tiles,
    } = this;
    const frameBuffer = createFrameBuffer(
      gl,
      pixelWidth,
      pixelHeight,
      _frameBufferType,
      gl.RGBA,
    );
    const layer = _layers.length;
    _layers.push({ frameBuffer });
    this._bindFrameBuffer(frameBuffer);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    const tilex2 = Math.floor(this.pixelWidth / tileSize - 1);
    const tiley2 = Math.floor(this.pixelHeight / tileSize - 1);
    for (let tiley = 0; tiley <= tiley2; tiley++) {
      for (let tilex = 0; tilex <= tilex2; tilex++) {
        const key = getTileKey(layer, tilex, tiley);
        const x = tilex * tileSize;
        const y = tiley * tileSize;
        _tiles[key] = { layer, x, y, link: null };
      }
    }
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
    this._redraw();
    return new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/png');
    }).then((blob) => {
      this._mainTextureVertexArray = _mainTextureVertexArray;
      this.sizeCanvasToWindow();
      this.updateViewport();
      this._redraw();
      if (blob === null) {
        throw new Error('Could not get image');
      }
      return blob;
    });
  }

  getSnapshot(): Snap {
    const links: Links = {};
    const start = Date.now();
    const {
      tileSize,
      _tiles,
      _readBuffer,
      _layers,
      _frameBufferInfo,
      gl,
    } = this;
    const { WriteTypedArray, glReadType } = _frameBufferInfo;
    const layerCount = _layers.length;
    let changedTiles = 0;
    for (let layer = 0; layer < layerCount; layer++) {
      const { changed } = _layers[layer];
      if (!changed) {
        continue;
      }
      const { tiles, maxX, minY, minX, maxY } = changed;
      const tileKeys = Object.keys(tiles);
      this._prepareToDraw(layer);
      const width = maxX - minX;
      const height = maxY - minY;
      const start1 = Date.now();

      let pixels = _readBuffer.subarray(0, width * height * 4);
      gl.readPixels(minX, minY, width, height, gl.RGBA, glReadType, pixels);
      console.log(`get pixels in ${Date.now() - start1} ms`);

      const savedBuffer = { pixels, width, height };
      for (const key of tileKeys) {
        const [x, y] = tiles[key];
        const tile = copyRgbaPixels(
          savedBuffer,
          WriteTypedArray,
          x - minX,
          y - minY,
          tileSize,
          tileSize,
        );
        const link = Math.random().toString(36).slice(3);
        _tiles[key] = { layer, x, y, link };
        links[link] = tile;
        changedTiles++;
      }
      delete _layers[layer].changed;
    }
    const snapshot = {
      snapshot: {
        tileSize,
        tiles: { ..._tiles },
        layers: layerCount,
      },
      links,
    };
    console.log(
      `snapshot generated in ${Date.now() - start} ms: ${
        Object.keys(_tiles).length
      } tile(s), ${changedTiles} changed, ${Object.keys(links).length} links`,
    );
    return snapshot;
  }

  loadSnapshot(
    { tiles, tileSize, layers }: Snapshot,
    getLink: GetLinkFn,
  ): PromiseOrValue<void> {
    while (layers > this._layers.length) {
      this._addLayer();
    }
    const keys = Object.keys(tiles);
    if (keys.length === 0) {
      return;
    }

    return waitAll(
      keys.map(
        (key): PromiseOrValue<void> => {
          const { layer, x, y, link } = tiles[key];
          const layerInfo = this._layers[layer];
          if (
            (!layerInfo.changed || !layerInfo.changed.tiles[key]) &&
            this._tiles[key] &&
            this._tiles[key].link === link
          ) {
            // Already have this tile loaded
            this._tiles[key] = tiles[key];
            return undefined;
          }
          if (link === null) {
            this._clearTile(layer, x, y);
            this._tiles[key] = tiles[key];
            return undefined;
          }
          // Get tile
          return then(getLink(link), (image) => {
            if (!image) {
              return;
            }
            this._tiles[key] = tiles[key];
            if (layerInfo.changed) {
              delete layerInfo.changed.tiles[key];
            }
            this._putTile(layer, x, y, image);
          });
        },
      ),
    );
  }

  getDom(): HTMLCanvasElement {
    return this.canvas;
  }

  saveRect(layer: number, x: number, y: number, w: number, h: number): void {
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

    const layerInfo = this._layers[layer];
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
        const key = getTileKey(layer, tilex, tiley);
        if (!changed.tiles[key]) {
          changed.tiles[key] = [tilex * tileSize, tiley * tileSize];
        }
      }
    }
  }

  private _putTile(
    layer: number,
    x: number,
    y: number,
    { pixels, width, height }: RgbaImage,
  ) {
    const { gl } = this;
    this._prepareToDraw(layer);
    gl.bindTexture(gl.TEXTURE_2D, this._layers[layer].frameBuffer.texture);
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
  private _clearTile(layer: number, x: number, y: number) {
    const { gl, tileSize } = this;
    this._prepareToDraw(layer);
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(x, y, tileSize, tileSize);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.disable(gl.SCISSOR_TEST);
  }

  afterExecute() {
    this._redraw();
  }

  setTransform(translateX: number, translateY: number, scale: number): void {
    this._mainTextureVertexArray = makeTextureVertexArray(
      translateX,
      translateY,
      translateX + this.pixelWidth * scale,
      translateY + this.pixelHeight * scale,
    );
    this._redraw();
  }

  private _redraw() {
    if (!this._mainProgram) {
      return;
    }
    const gl = this.gl;
    this._bindFrameBuffer();
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.clearColor(0x33 / 255, 0x33 / 255, 0x33 / 255, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    const layers = this._layers;
    for (let i = 0; i < layers.length; i++) {
      this._drawTexture(
        this._mainProgram,
        layers[i].frameBuffer.texture,
        this._mainTextureVertexArray,
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

  private _prepareToDraw(layer: number) {
    const { gl } = this;
    this._bindFrameBuffer(this._layers[layer].frameBuffer);
    gl.viewport(0, 0, this.pixelWidth, this.pixelHeight);
  }

  private _drawLine(
    layer: number,
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

    this._prepareToDraw(layer);
    if (save) {
      this.saveRect(layer, minx, miny, maxx - minx, maxy - miny);
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

  private _fillRectEllipses(
    layer: number,
    rects: Rects,
    ellipse: boolean,
    hardness: number,
    erase: boolean = false,
  ) {
    const { width, height } = this.dna;
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
    for (let i = 0, j = 0, k = 0, l = 0, m = 0; i < rectCount; i++) {
      const [x, y, w, h, r, g, b, a] = rects[i];
      let x1 = x;
      let y1 = y;
      let x2 = x1 + w;
      let y2 = y1 + h;
      if (x2 < 0 || y2 < 0 || x1 > width || y1 > height) {
        continue;
      }
      // Add margin for antialiasing
      x1 -= 1;
      y1 -= 1;
      x2 += 1;
      x2 += 1;
      if (x1 < 0) {
        x1 = 0;
      }
      if (y1 < 0) {
        y1 = 0;
      }
      if (x2 > width) {
        x2 = width;
      }
      if (y2 > height) {
        y2 = height;
      }
      if (x2 <= x1 || y2 <= y1) {
        continue;
      }

      this._prepareToDraw(layer);
      this.saveRect(layer, x, y, w, h);

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
    return `WebGL ${this._frameBufferInfo.writeTypeName} (${
      this._frameBufferBits
    } bit): ${this.pixelWidth}x${this.pixelHeight} (${
      Object.keys(this._tiles).length
    } tiles)`;
  }

  getDrawingContext(): DrawingContext {
    const os = this;
    const state = {
      layer: 0,
    };
    os._prepareToDraw(0);
    const context: DrawingContext = {
      setLayer(layer: number) {
        state.layer = layer;
      },

      addLayer() {
        os._addLayer();
      },

      fillRects(rects: Rects) {
        os._fillRectEllipses(state.layer, rects, false, 1);
      },

      fillEllipses(ellipses: Rects, hardness: number, erase: boolean) {
        os._fillRectEllipses(state.layer, ellipses, true, hardness, erase);
      },

      drawLine(
        x1: number,
        y1: number,
        size1: number,
        r1: number,
        g1: number,
        b1: number,
        a1: number,
        x2: number,
        y2: number,
        size2: number,
        r2: number,
        g2: number,
        b2: number,
        a2: number,
      ) {
        const { layer } = state;
        os._drawLine(layer, x1, y1, size1, x2, y2, size2, r1, g1, b1, a1, true);
      },
    };
    return context;
  }
}
