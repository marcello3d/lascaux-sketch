import md5 from 'md5';
import { Dna } from './dna';

function getTileX(x: number, tileSize: number): number {
  return Math.floor(Math.max(0, x / tileSize));
}
function getTileY(y: number, tileSize: number): number {
  return Math.floor(Math.max(0, y / tileSize));
}
function getTileKey(tilex: number, tiley: number): string {
  return tilex + '.' + tiley;
}

type Snapshot = {
  tiles: Tiles;
  tileSize: number;
}
type Links = Record<string, string>;
type Tile = { x: number; y: number; link: string };
type Tiles = Record<string, Tile>;
export default class BaseDrawOS {
  public readonly dna: Dna;
  public readonly pixelWidth: number;
  public readonly pixelHeight: number;
  public readonly scale: number;
  public readonly tileSize: number;
  private readonly canvas: HTMLCanvasElement;
  private _changedTiles: Record<string, [number, number]> = {};
  private _tiles: Tiles = {};
  constructor(dna: Dna, scale: number = 1, tileSize: number = 64) {
    this.dna = dna;
    this.tileSize = tileSize;

    this.scale = scale;

    const width = Math.ceil(this.dna.width * scale);
    const height = Math.ceil(this.dna.height * scale);
    this.pixelWidth = width;
    this.pixelHeight = height;
    this.canvas = this._makeCanvas(width, height, scale);
    this.saveRect(0, 0, width, height);
  }

  getDom() {
    return this.canvas;
  }

  initialize() {
    throw new Error('initialize() unimplemented');
  }
  getDrawingContext() {
    throw new Error('getDrawingContext() unimplemented');
  }
  toDataUrl(): string {
    throw new Error('toDataUrl() unimplemented');
  }

  protected _makeCanvas(
    width: number,
    height: number,
    scale: number,
  ): HTMLCanvasElement {
    throw new Error('_makeCanvas(…) unimplemented');
  }

  protected _getTile(x: number, y: number, w: number, h: number): any {
    throw new Error('_getRawPixelData(…) unimplemented');
  }
  protected _putTile(
    x: number,
    y: number,
    w: number,
    h: number,
    data: any,
    callback: (error?: Error) => void,
  ) {
    throw new Error('_putRawPixelData(…) unimplemented');
  }

  beforeExecute() {}
  afterExecute() {}

  getSnapshot(): { snapshot: Snapshot, links: Links} {
    const links: Links = {};
    for (const key of Object.keys(this._changedTiles)) {
      const [x, y] = this._changedTiles[key];
      const dataUri = this._getTile(x, y, this.tileSize, this.tileSize);
      const link = md5(dataUri);
      this._tiles[key] = { x, y, link };
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
    getLink: (
      link: string,
      callback: (error: Error | undefined, data: any) => void,
    ) => void,
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
      const { x, y, link } = tiles[key];
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
            this._putTile(x, y, tileSize, tileSize, data, onPutFinish);
          }
        });
      }
    }
  }

  saveRect(x: number, y: number, w: number, h: number) {
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
        const key = getTileKey(tilex, tiley);
        if (!changedTiles[key]) {
          changedTiles[key] = [tilex * tileSize, tiley * tileSize];
        }
      }
    }
  }
}
