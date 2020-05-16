import parseColor from '../parse-color';

import {
  checkError,
  checkRenderTargetSupport,
  createFrameBuffer,
  FrameBuffer,
  getOrThrow,
  setDrawingMatrix,
  setViewportMatrix,
} from './util';

import ProgramManager from './program-manager';
import md5 from 'md5';
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
export class GlOS1 implements DrawOs {
  public readonly dna: Dna;
  public readonly pixelWidth: number;
  public readonly pixelHeight: number;
  public readonly scale: number;
  public readonly tileSize: number;

  private canvas: HTMLCanvasElement;

  private readonly _layers: Array<Layer> = [];
  private _tiles: Tiles = {};
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
  private readonly _drawingVertexBuffer: WebGLBuffer;
  private readonly _drawingVertexBuffer2: WebGLBuffer;
  private readonly _drawingVertexIndexBuffer: WebGLBuffer;
  private readonly _OES_texture_float: OES_texture_float_linear | null;
  private readonly _OES_texture_half_float: OES_texture_half_float | null;
  private readonly _frameBufferType: GLenum;
  private readonly _frameBufferFormat: GLenum;

  private readonly _readBuffer: Uint8Array;
  private readonly _loadImage = new Image();
  private readonly _tileSaveCanvas: HTMLCanvasElement;
  private readonly _tileSaveContext: CanvasRenderingContext2D;

  constructor(dna: Dna, scale: number = 1, tileSize: number = 64) {
    this.dna = dna;
    this.tileSize = tileSize;

    this.scale = scale;

    const pixelWidth = Math.ceil(this.dna.width * scale);
    const pixelHeight = Math.ceil(this.dna.height * scale);
    this.pixelWidth = pixelWidth;
    this.pixelHeight = pixelHeight;

    this._readBuffer = new Uint8Array(pixelWidth * pixelHeight * 4);

    this._tileSaveCanvas = document.createElement('canvas');
    this._tileSaveCanvas.width = tileSize;
    this._tileSaveCanvas.height = tileSize;
    this._tileSaveContext = getOrThrow(
      this._tileSaveCanvas.getContext('2d'),
      'tile save canvas',
    );
    // this._tileSaveImageData = this._tileSaveContext.createImageData(tileSize, tileSize);

    const canvas = document.createElement('canvas');

    canvas.style.position = 'absolute';
    canvas.style.left = '0';
    canvas.style.top = '0';

    const resizeCanvas = () => {
      const screenWidth = document.documentElement.clientWidth;
      const screenHeight = document.documentElement.clientHeight;
      canvas.style.width = screenWidth + 'px';
      canvas.style.height = screenHeight + 'px';

      this.pixelRatio = window.devicePixelRatio;
      canvas.width = screenWidth * this.pixelRatio;
      canvas.height = screenHeight * this.pixelRatio;
    };

    resizeCanvas();

    const gl = canvas.getContext('webgl', {
      preserveDrawingBuffer: false,
      alpha: false,
      depth: false,
      stencil: false,
      antialias: false,
      premultipliedAlpha: false,
    });

    if (!gl) {
      throw new Error('Cannot init webgl');
    }

    this.canvas = canvas;

    this.gl = gl;

    this._OES_texture_float = gl.getExtension('OES_texture_float');
    this._OES_texture_half_float = gl.getExtension('OES_texture_half_float');
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);

    if (
      this._OES_texture_float &&
      checkRenderTargetSupport(gl, gl.RGBA, gl.FLOAT)
    ) {
      console.log('using full float RGBA textures');
      this._frameBufferType = gl.FLOAT;
    } else if (
      this._OES_texture_half_float &&
      checkRenderTargetSupport(
        gl,
        gl.RGBA,
        this._OES_texture_half_float.HALF_FLOAT_OES,
      )
    ) {
      console.log('using half float RGBA textures');
      this._frameBufferType = this._OES_texture_half_float.HALF_FLOAT_OES;
    } else {
      console.log('using unsigned byte RGBA textures');
      this._frameBufferType = gl.UNSIGNED_BYTE;
    }

    console.log(`using RGBA textures`);
    this._frameBufferFormat = gl.RGBA;

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
        resizeCanvas();
        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
        this._programManager.use(this._mainProgram);
        setViewportMatrix(
          gl,
          this._mainProgram.uniforms.uMVMatrix,
          gl.drawingBufferWidth / this.pixelRatio,
          gl.drawingBufferHeight / this.pixelRatio,
        );
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
    this._drawingVertexBuffer = getOrThrow(gl.createBuffer(), 'createBuffer');
    this._drawingVertexBuffer2 = getOrThrow(gl.createBuffer(), 'createBuffer');
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
      _frameBufferFormat,
    } = this;
    const frameBuffer = createFrameBuffer(
      gl,
      pixelWidth,
      pixelHeight,
      _frameBufferType,
      _frameBufferFormat,
    );
    _layers.push({ frameBuffer });
    this._bindFrameBuffer(frameBuffer);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    this.saveRect(_layers.length - 1, 0, 0, pixelWidth, pixelHeight);
  }

  getSnapshot(): Snap {
    const links: Links = {};
    const start = Date.now();
    const {
      tileSize,
      _tileSaveContext,
      _tiles,
      _readBuffer,
      _layers,
      gl,
    } = this;
    const { length: layerCount } = _layers;
    let changedTiles = 0;
    for (let layer = 0; layer < layerCount; layer++) {
      const { changed } = _layers[layer];
      if (!changed) {
        continue;
      }
      const { tiles, maxX, minY, minX, maxY } = changed;
      const tileKeys = Object.keys(tiles);
      this._prepareToDraw(layer);
      const w = maxX - minX;
      const h = maxY - minY;
      const imageData = _tileSaveContext.createImageData(w, h);
      gl.readPixels(minX, minY, w, h, gl.RGBA, gl.UNSIGNED_BYTE, _readBuffer);
      imageData.data.set(_readBuffer.subarray(0, imageData.data.length));
      for (const key of tileKeys) {
        const [x, y] = tiles[key];
        _tileSaveContext.putImageData(imageData, minX - x, minY - y);
        const image = _tileSaveContext.getImageData(0, 0, tileSize, tileSize);
        const link = md5((image.data.buffer as unknown) as Array<number>);
        _tiles[key] = { layer, x, y, link };
        links[link] = image;
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
    callback: (error?: Error) => void,
  ) {
    while (layers > this._layers.length) {
      this._addLayer();
    }
    const keys = Object.keys(tiles);
    if (keys.length === 0) {
      return callback();
    }

    // Async (callback-based) loop
    const next = (error?: Error) => {
      if (error) {
        // Prevent multiple callbacks
        return callback(error);
      }
      const key = keys.pop();
      if (!key) {
        return callback();
      }
      const { layer, x, y, link } = tiles[key];
      const layerInfo = this._layers[layer];
      if (
        (!layerInfo.changed || !layerInfo.changed.tiles[key]) &&
        this._tiles[key] &&
        this._tiles[key].link === link
      ) {
        // Already have this tile loaded
        this._tiles[key] = tiles[key];
        next();
      } else {
        // Get tile
        getLink(link, (error: Error | undefined, image?: ImageData) => {
          if (error || !image) {
            next(error);
          } else {
            this._tiles[key] = tiles[key];
            if (layerInfo.changed) {
              delete layerInfo.changed.tiles[key];
            }
            this._putTile(layer, x, y, image, next);
          }
        });
      }
    };
    next();
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
    image: ImageData,
    callback: (error?: Error) => void,
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
      this._frameBufferFormat,
      this._frameBufferType,
      image,
    );
    callback();
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

    gl.bindBuffer(gl.ARRAY_BUFFER, this._drawingVertexBuffer);
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
  private _fillRects(
    layer: number,
    rects: Rects,
    r: number,
    g: number,
    b: number,
    a: number,
  ) {
    const { width, height } = this.dna;
    // Build list of vertices
    const rectCount = rects.length;
    if (rectCount === 0) {
      return;
    }
    const vertexArray = new Float32Array(rectCount * 4 * 2);
    const vertexIndexArray = new Uint16Array(rectCount * 6);
    let usedRectCount = 0;
    for (let i = 0, j = 0, k = 0; i < rectCount; i++) {
      const rect = rects[i];
      let x1 = rect[0];
      let y1 = rect[1];
      let x2 = x1 + rect[2];
      let y2 = y1 + rect[3];
      if (x2 < 0 || y2 < 0 || x1 > width || y1 > height) {
        continue;
      }
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
      this.saveRect(layer, rect[0], rect[1], rect[2], rect[3]);

      //  0 --- 1
      //  |     |
      //  2 --- 4
      vertexArray[j++] = x1;
      vertexArray[j++] = y1;
      vertexArray[j++] = x2;
      vertexArray[j++] = y1;
      vertexArray[j++] = x1;
      vertexArray[j++] = y2;
      vertexArray[j++] = x2;
      vertexArray[j++] = y2;

      const indexBase = i * 4;
      vertexIndexArray[k++] = indexBase;
      vertexIndexArray[k++] = indexBase + 1;
      vertexIndexArray[k++] = indexBase + 2;

      vertexIndexArray[k++] = indexBase + 1;
      vertexIndexArray[k++] = indexBase + 2;
      vertexIndexArray[k++] = indexBase + 3;
      usedRectCount++;
    }
    if (usedRectCount > 0) {
      const gl = this.gl;
      this._programManager.use(this._rectProgram);
      gl.uniform4f(this._rectProgram.uniforms.uColor, r, g, b, a);

      gl.bindBuffer(gl.ARRAY_BUFFER, this._drawingVertexBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, vertexArray, gl.STATIC_DRAW);
      gl.vertexAttribPointer(
        this._rectProgram.attributes.aPosition,
        2,
        gl.FLOAT,
        false,
        0,
        0,
      );

      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._drawingVertexIndexBuffer);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, vertexIndexArray, gl.STATIC_DRAW);
      gl.drawElements(gl.TRIANGLES, usedRectCount * 6, gl.UNSIGNED_SHORT, 0);
    }
  }
  private _fillEllipses(
    layer: number,
    rects: Rects,
    r: number,
    g: number,
    b: number,
    a: number,
  ) {
    const { width, height } = this.dna;
    // Build list of vertices
    const rectCount = rects.length;
    if (rectCount === 0) {
      return;
    }
    const vertexPosArray = new Float32Array(rectCount * 4 * 2);
    const vertexRectArray = new Float32Array(rectCount * 4 * 4);
    const vertexIndexArray = new Uint16Array(rectCount * 6);
    let usedRectCount = 0;
    for (let i = 0, j = 0, k = 0, l = 0; i < rectCount; i++) {
      const rect = rects[i];
      let x1 = rect[0];
      let y1 = rect[1];
      let x2 = x1 + rect[2];
      let y2 = y1 + rect[3];
      if (x2 < 0 || y2 < 0 || x1 > width || y1 > height) {
        continue;
      }
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
      this.saveRect(layer, rect[0], rect[1], rect[2], rect[3]);

      //  0 --- 1
      //  |     |
      //  2 --- 4

      // equation for ellipse: x² / a² + y² / b² = 1 (where a = width/2 and b = height/2)
      // -> x*x / (width*width/4) + y*y / (height*height/4) = 1
      // -> 4*x*x / (width*width) + 4*y*y / (height*height) = 1
      const rectx = rect[0] + rect[2] * 0.5;
      const recty = rect[1] + rect[3] * 0.5;
      const rectz = 4 / (rect[2] * rect[2]);
      const rectw = 4 / (rect[3] * rect[3]);

      // float inEllipse =
      //  4.0 * uv.x * uv.x / (vRect.z * vRect.z) +
      //  4.0 * uv.y * uv.y / (vRect.w * vRect.w);
      vertexPosArray[j++] = x1;
      vertexPosArray[j++] = y1;
      vertexRectArray[l++] = rectx;
      vertexRectArray[l++] = recty;
      vertexRectArray[l++] = rectz;
      vertexRectArray[l++] = rectw;
      vertexPosArray[j++] = x2;
      vertexPosArray[j++] = y1;
      vertexRectArray[l++] = rectx;
      vertexRectArray[l++] = recty;
      vertexRectArray[l++] = rectz;
      vertexRectArray[l++] = rectw;
      vertexPosArray[j++] = x1;
      vertexPosArray[j++] = y2;
      vertexRectArray[l++] = rectx;
      vertexRectArray[l++] = recty;
      vertexRectArray[l++] = rectz;
      vertexRectArray[l++] = rectw;
      vertexPosArray[j++] = x2;
      vertexPosArray[j++] = y2;
      vertexRectArray[l++] = rectx;
      vertexRectArray[l++] = recty;
      vertexRectArray[l++] = rectz;
      vertexRectArray[l++] = rectw;

      const indexBase = i * 4;
      vertexIndexArray[k++] = indexBase;
      vertexIndexArray[k++] = indexBase + 1;
      vertexIndexArray[k++] = indexBase + 2;

      vertexIndexArray[k++] = indexBase + 1;
      vertexIndexArray[k++] = indexBase + 2;
      vertexIndexArray[k++] = indexBase + 3;
      usedRectCount++;
    }
    if (usedRectCount > 0) {
      const gl = this.gl;
      this._programManager.use(this._ellipseProgram);
      gl.uniform4f(this._ellipseProgram.uniforms.uColor, r, g, b, a);

      gl.bindBuffer(gl.ARRAY_BUFFER, this._drawingVertexBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, vertexPosArray, gl.STATIC_DRAW);
      gl.vertexAttribPointer(
        this._ellipseProgram.attributes.aPosition,
        2,
        gl.FLOAT,
        false,
        0,
        0,
      );

      gl.bindBuffer(gl.ARRAY_BUFFER, this._drawingVertexBuffer2);
      gl.bufferData(gl.ARRAY_BUFFER, vertexRectArray, gl.STATIC_DRAW);
      gl.vertexAttribPointer(
        this._ellipseProgram.attributes.aRect,
        4,
        gl.FLOAT,
        false,
        0,
        0,
      );

      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._drawingVertexIndexBuffer);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, vertexIndexArray, gl.STATIC_DRAW);
      gl.drawElements(gl.TRIANGLES, usedRectCount * 6, gl.UNSIGNED_SHORT, 0);
    }
  }

  getDrawingContext(): DrawingContext {
    const os = this;
    const state = {
      red: 0,
      green: 0,
      blue: 0,
      alpha: 1,
      layer: 0,
    };
    os._prepareToDraw(0);
    return {
      setLayer(layer: number) {
        state.layer = layer;
      },

      addLayer() {
        os._addLayer();
      },

      setFillStyle(fillStyle: string) {
        const color = parseColor(fillStyle);
        state.red = color[0] / 255;
        state.green = color[1] / 255;
        state.blue = color[2] / 255;
      },

      setAlpha(alpha: number) {
        state.alpha = alpha;
      },

      fillRect(x: number, y: number, w: number, h: number) {
        const { layer, red, green, blue, alpha } = state;
        os._fillRects(layer, [[x, y, w, h]], red, green, blue, alpha);
      },

      fillRects(rects: Rects) {
        const { layer, red, green, blue, alpha } = state;
        os._fillRects(layer, rects, red, green, blue, alpha);
      },

      fillEllipse(x: number, y: number, w: number, h: number) {
        if (w * h === 0) {
          return;
        }
        const { layer, red, green, blue, alpha } = state;
        os._fillEllipses(layer, [[x, y, w, h]], red, green, blue, alpha);
      },

      fillEllipses(ellipses: Rects) {
        const { layer, red, green, blue, alpha } = state;
        os._fillEllipses(layer, ellipses, red, green, blue, alpha);
      },

      drawLine(
        x1: number,
        y1: number,
        size1: number,
        x2: number,
        y2: number,
        size2: number,
      ) {
        const { layer, red, green, blue, alpha } = state;
        os._drawLine(
          layer,
          x1,
          y1,
          size1,
          x2,
          y2,
          size2,
          red,
          green,
          blue,
          alpha,
          true,
        );
      },
    };
  }
}
