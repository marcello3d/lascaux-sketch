import parseColor from '../parse-color';

import {
  checkRenderTargetSupport,
  createFrameBuffer,
  FrameBuffer,
  setDrawingMatrix,
  setViewportMatrix,
} from './util';

import ProgramManager from './program-manager';
import md5 from 'md5';
import { Dna } from '../dna';
import { Program } from './program';

import raw from 'raw.macro';

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

// cache bust v8
const ellipseVertexShader = raw('./draw-ellipse.vert');
const ellipseFragmentShader = raw('./draw-ellipse.frag');
const rectVertexShader = raw('./draw-rect.vert');
const rectFragmentShader = raw('./draw-rect.frag');
const lineVertexShader = raw('./draw-line.vert');
const lineFragmentShader = raw('./draw-line.frag');
const textureVertexShader = raw('./draw-texture.vert');
const textureFragmentShader = raw('./draw-texture.frag');

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

function getOrThrow<T>(value: T | null, type: string): T {
  if (value === null) {
    throw new Error(`gl.${type} failed`);
  }
  return value;
}

function getTileX(x: number, tileSize: number): number {
  return Math.floor(Math.max(0, x / tileSize));
}
function getTileY(y: number, tileSize: number): number {
  return Math.floor(Math.max(0, y / tileSize));
}
function getTileKey(layer: number, tilex: number, tiley: number): string {
  return layer + '.' + tilex + '.' + tiley;
}

type ChangedTile = [
  // layer
  number,
  // x
  number,
  // y
  number
];
export default class GlOS1 implements DrawOs {
  public readonly dna: Dna;
  public readonly pixelWidth: number;
  public readonly pixelHeight: number;
  public readonly scale: number;
  public readonly tileSize: number;

  private canvas: HTMLCanvasElement;

  private _changedTiles: Record<string, ChangedTile> = {};
  private _tiles: Tiles = {};
  private readonly gl: WebGLRenderingContext;
  private pixelRatio: number = 1;
  private _framebuffer: FrameBuffer | undefined;

  private _mainTextureVertexArray: Float32Array;
  private readonly _layers: FrameBuffer[] = [];
  private readonly _programManager: ProgramManager;
  private readonly _mainProgram: Program;
  private readonly _textureProgram: Program;
  private readonly _ellipseProgram: Program;
  private readonly _rectProgram: Program;
  private readonly _lineProgram: Program;
  private readonly _mainVertexBuffer: WebGLBuffer;
  private readonly _drawingVertexBuffer: WebGLBuffer;
  private readonly _drawingVertexBuffer2: WebGLBuffer;
  private readonly _drawingVertexIndexBuffer: WebGLBuffer;
  private readonly _OES_texture_float: OES_texture_float_linear | null;
  private readonly _OES_texture_half_float: OES_texture_half_float | null;
  private readonly _frameBufferType: GLenum;
  private readonly _frameBufferFormat: GLenum;

  constructor(dna: Dna, scale: number = 1, tileSize: number = 64) {
    this.dna = dna;
    this.tileSize = tileSize;

    this.scale = scale;

    const pixelWidth = Math.ceil(this.dna.width * scale);
    const pixelHeight = Math.ceil(this.dna.height * scale);
    this.pixelWidth = pixelWidth;
    this.pixelHeight = pixelHeight;
    this.saveRect(0, 0, 0, pixelWidth, pixelHeight);

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
    // gl.disable(gl.DEPTH_BUFFER_BIT)

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
          this._mainProgram.uniform('uMVMatrix'),
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
  }

  initialize(): void {
    for (let i = 0; i < this._layers.length; i++) {
      this._layers[i].destroy();
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
    const buffer = createFrameBuffer(
      gl,
      this.pixelWidth,
      this.pixelHeight,
      this._frameBufferType,
      this._frameBufferFormat,
    );
    this._layers.push(buffer);
    this._bindFrameBuffer(buffer);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  getSnapshot(): Snap {
    const links: Links = {};
    for (const key of Object.keys(this._changedTiles)) {
      const [layer, x, y] = this._changedTiles[key];
      const dataUri = this._getTile(layer, x, y, this.tileSize, this.tileSize);
      const link = md5(dataUri);
      this._tiles[key] = { layer, x, y, link };
      links[link] = dataUri;
    }
    this._changedTiles = {};
    return {
      snapshot: {
        tileSize: this.tileSize,
        tiles: { ...this._tiles },
      },
      links,
    };
  }

  loadSnapshot(
    { tiles, tileSize }: Snapshot,
    getLink: GetLinkFn,
    callback: (error?: Error) => void,
  ) {
    if (tileSize !== this.tileSize) {
      throw new Error(`unexpected tileSize: ${tileSize} vs ${this.tileSize}`);
    }
    const keys = Object.keys(tiles);
    if (keys.length === 0) {
      return callback();
    }

    let putCount = 0;
    const onPutFinish = (error?: Error) => {
      if (error) {
        // Prevent multiple callbacks
        putCount = keys.length;
        return callback(error);
      }
      putCount++;
      if (putCount >= keys.length) {
        callback();
      }
    };

    for (const key of keys) {
      const { layer, x, y, link } = tiles[key];
      if (
        !this._changedTiles[key] &&
        this._tiles[key] &&
        this._tiles[key].link === link
      ) {
        // Already have this tile loaded
        this._tiles[key] = tiles[key];
        delete this._changedTiles[key];
        onPutFinish();
      } else {
        // Get tile
        getLink(link, (error: Error | undefined, data: any) => {
          if (error || !data) {
            onPutFinish(error);
          } else {
            this._tiles[key] = tiles[key];
            delete this._changedTiles[key];
            this._putTile(layer, x, y, tileSize, tileSize, data, onPutFinish);
          }
        });
      }
    }
  }

  getDom(): HTMLCanvasElement {
    return this.canvas;
  }

  saveRect(layer: number, x: number, y: number, w: number, h: number): void {
    if (w <= 0 || h <= 0) {
      // no-op
      return;
    }

    const changedTiles = this._changedTiles;
    const tileSize = this.tileSize;
    const tilex1 = getTileX(x, tileSize);
    const tiley1 = getTileY(y, tileSize);
    const tilex2 = Math.floor(
      Math.min((x + w) / tileSize, this.pixelWidth / tileSize - 1),
    );
    const tiley2 = Math.floor(
      Math.min((y + h) / tileSize, this.pixelHeight / tileSize - 1),
    );

    for (let tiley = tiley1; tiley <= tiley2; tiley++) {
      for (let tilex = tilex1; tilex <= tilex2; tilex++) {
        const key = getTileKey(layer, tilex, tiley);
        if (!changedTiles[key]) {
          changedTiles[key] = [layer, tilex * tileSize, tiley * tileSize];
        }
      }
    }
  }

  private _getTile(
    layer: number,
    x: number,
    y: number,
    w: number,
    h: number,
  ): string {
    return this._getDataUrl(layer, x, y, w, h);
  }

  private _putTile(
    layer: number,
    x: number,
    y: number,
    w: number,
    h: number,
    dataUri: string,
    callback: (error?: Error) => void,
  ) {
    const gl = this.gl;
    const image = new Image();
    image.onload = () => {
      if (image.width !== w || image.height !== h) {
        return callback(
          new Error(
            `image size doesn't match: ${image.width}x${
              image.height
            }, expected ${x}x${y}`,
          ),
        );
      }
      this._prepareToDraw(layer);
      const texture = getOrThrow(gl.createTexture(), 'createTexture');
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
      this._drawTexture(
        this._textureProgram,
        texture,
        makeTextureVertexArray(x, y, x + w, y + h),
      );
      callback();
    };
    image.src = dataUri;
  }

  private _getRawPixelData(
    layer: number,
    x: number,
    y: number,
    width: number,
    height: number,
  ): Uint8Array {
    const gl = this.gl;
    const data = new Uint8Array(width * height * 4);
    this._prepareToDraw(layer);
    gl.readPixels(x, y, width, height, gl.RGBA, gl.UNSIGNED_BYTE, data);
    return data;
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

  toDataUrl(): string {
    return this._getDataUrl(0, 0, 0, this.pixelWidth, this.pixelHeight);
  }

  private _getDataUrl(
    layer: number,
    x: number,
    y: number,
    width: number,
    height: number,
    type?: string,
    options?: any,
  ) {
    // Create a 2D canvas to store the result
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('New canvas 2d context is null');
    }

    // Copy the pixels to a 2D canvas
    const imageData = context.createImageData(width, height);
    imageData.data.set(this._getRawPixelData(layer, x, y, width, height));
    context.putImageData(imageData, 0, 0);

    return canvas.toDataURL(type, options);
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

    const buffers = this._layers;
    for (let i = 0; i < buffers.length; i++) {
      this._drawTexture(
        this._mainProgram,
        buffers[i].texture,
        this._mainTextureVertexArray,
      );
    }
  }

  private _drawTexture(
    program: Program,
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
    const program = new Program(
      gl,
      textureVertexShader,
      textureFragmentShader,
      'main',
    );
    this._programManager.use(program);
    program.attribute('aPosition');
    program.enable();
    return program;
  }

  private _createTextureProgram(
    gl: WebGLRenderingContext,
    width: number,
    height: number,
  ) {
    const program = new Program(
      gl,
      textureVertexShader,
      textureFragmentShader,
      'texture',
    );
    this._programManager.use(program);
    program.attribute('aPosition');
    setDrawingMatrix(gl, program.uniform('uMVMatrix'), width, height);
    return program;
  }

  private _createEllipseProgram(
    gl: WebGLRenderingContext,
    width: number,
    height: number,
  ) {
    const program = new Program(
      gl,
      ellipseVertexShader,
      ellipseFragmentShader,
      'ellipse',
    );
    this._programManager.use(program);
    program.attribute('aPosition');
    program.attribute('aRect');
    program.uniform('uColor');
    setDrawingMatrix(gl, program.uniform('uMVMatrix'), width, height);
    return program;
  }

  private _createLineProgram(
    gl: WebGLRenderingContext,
    width: number,
    height: number,
  ) {
    const program = new Program(
      gl,
      lineVertexShader,
      lineFragmentShader,
      'line',
    );
    this._programManager.use(program);
    program.attribute('aPosition');
    program.uniform('uColor');
    program.uniform('uPos1');
    program.uniform('uPos2');
    setDrawingMatrix(gl, program.uniform('uMVMatrix'), width, height);
    return program;
  }

  private _createRectProgram(
    gl: WebGLRenderingContext,
    width: number,
    height: number,
  ) {
    const program = new Program(
      gl,
      rectVertexShader,
      rectFragmentShader,
      'rect',
    );
    this._programManager.use(program);
    program.attribute('aPosition');
    program.uniform('uColor');
    setDrawingMatrix(gl, program.uniform('uMVMatrix'), width, height);
    return program;
  }

  private _prepareToDraw(layer: number) {
    const { gl } = this;
    this._bindFrameBuffer(this._layers[layer]);
    gl.viewport(0, 0, this.pixelWidth, this.pixelHeight);
  }

  private _fillEllipse(
    layer: number,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
    g: number,
    b: number,
    a: number = 1,
  ) {
    const gl = this.gl;

    this._prepareToDraw(layer);
    this._programManager.use(this._ellipseProgram);

    gl.uniform4f(this._ellipseProgram.uniforms.uColor, r, g, b, a);
    gl.uniform4f(this._ellipseProgram.uniforms.uRect, x, y, w, h);

    const x2 = x + w;
    const y2 = y + h;
    gl.bindBuffer(gl.ARRAY_BUFFER, this._drawingVertexBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([x, y, x2, y, x, y2, x2, y2]),
      gl.STATIC_DRAW,
    );
    gl.vertexAttribPointer(
      this._ellipseProgram.attributes.aPosition,
      2,
      gl.FLOAT,
      false,
      0,
      0,
    );
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
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
  private _fillRect(
    layer: number,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
    g: number,
    b: number,
    a: number = 1,
  ) {
    const gl = this.gl;

    this._prepareToDraw(layer);
    this._programManager.use(this._rectProgram);
    gl.uniform4f(this._rectProgram.uniforms.uColor, r, g, b, a);

    const x2 = x + w;
    const y2 = y + h;
    gl.bindBuffer(gl.ARRAY_BUFFER, this._drawingVertexBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([x, y, x2, y, x, y2, x2, y2]),
      gl.STATIC_DRAW,
    );
    gl.vertexAttribPointer(
      this._rectProgram.attributes.aPosition,
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

      fillRect(x: number, y: number, w: number, h: number) {
        if (w * h === 0) {
          return;
        }
        const { layer, red, green, blue } = state;
        os.saveRect(layer, x, y, w, h);
        os._fillRects(layer, [[x, y, w, h]], red, green, blue, 1);
      },

      fillRects(rects: Rects) {
        const { layer, red, green, blue } = state;
        os._fillRects(layer, rects, red, green, blue, 1);
      },

      fillEllipse(x: number, y: number, w: number, h: number) {
        if (w * h === 0) {
          return;
        }
        const { layer, red, green, blue } = state;
        os.saveRect(layer, x, y, w, h);
        os._fillEllipse(layer, x, y, w, h, red, green, blue, 1);
      },

      fillEllipses(ellipses: Rects) {
        const { layer, red, green, blue } = state;
        os._fillEllipses(layer, ellipses, red, green, blue, 1);
      },

      drawLine(
        x1: number,
        y1: number,
        size1: number,
        x2: number,
        y2: number,
        size2: number,
      ) {
        const { layer, red, green, blue } = state;
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
          1,
          true,
        );
      },
    };
  }
}
