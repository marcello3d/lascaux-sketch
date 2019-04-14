import { Drawing } from '../app/state';

type Tile = ImageData | undefined;
const DirtyTile = null;

interface Snapshot {
  tiles: Array<Tile>;
}

export class Canvas2d {
  readonly canvas: HTMLCanvasElement;
  readonly context: CanvasRenderingContext2D;
  readonly tileSize: number = 64;
  readonly tilesX: number;
  readonly tilesY: number;
  readonly tileCount: number;
  readonly currentTiles: Array<Tile | typeof DirtyTile>;
  readonly snapshots: Snapshot[];
  // List of indexes of dirty tiles
  readonly dirtyTiles = new Set<number>();

  constructor(width: number, height: number) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    const context = this.canvas.getContext('2d');
    if (!context) {
      throw new Error('Could not get context');
    }
    this.context = context;
    this.tilesX = Math.ceil(width / this.tileSize);
    this.tilesY = Math.ceil(height / this.tileSize);
    this.tileCount = this.tilesX * this.tilesY;
    this.snapshots = [
      {
        tiles: new Array(this.tileCount).fill(undefined),
      },
    ];
    this.currentTiles = new Array(this.tileCount).fill(undefined);
  }

  get width(): number {
    return this.canvas.width;
  }

  get height(): number {
    return this.canvas.height;
  }

  tileIndexToXY(index: number): [number, number] {
    return [
      (index % this.tilesX) * this.tileSize,
      Math.floor(index / this.tilesX) * this.tileSize,
    ];
  }
  xyToTile(x: number, y: number): number {
    return (
      Math.floor(x / this.tileSize) +
      Math.floor(y / this.tileSize) * this.tilesX
    );
  }

  private peekSnapshot(): Snapshot {
    const { snapshots } = this;
    if (snapshots.length === 0) {
      throw new Error('no snapshot!');
    }
    return snapshots[snapshots.length - 1];
  }

  snapshot() {
    const { snapshots, tileSize, dirtyTiles, currentTiles, context } = this;
    const lastSnapshot = this.peekSnapshot();
    const tiles = Array.from(lastSnapshot.tiles);
    dirtyTiles.forEach((index) => {
      const [x, y] = this.tileIndexToXY(index);
      const tile = context.getImageData(x, y, tileSize, tileSize);
      tiles[index] = tile;
      currentTiles[index] = tile;
    });
    snapshots.push({ tiles });
    dirtyTiles.clear();
  }


  canUndo(): boolean {
    return this.snapshots.length > 1;
  }

  undo() {
    const snapshot = this.peekSnapshot();
    const { currentTiles, context, tileSize } = this;
    snapshot.tiles.forEach((tile, index) => {
      if (currentTiles[index] !== tile) {
        const [x, y] = this.tileIndexToXY(index);
        if (tile) {
          context.putImageData(tile, x, y);
        } else {
          context.clearRect(x, y, tileSize, tileSize);
        }
        currentTiles[index] = tile;
      }
    });
    if (this.snapshots.length > 1) {
      this.snapshots.pop();
    }
  }

  private markDirty(xx: number, yy: number, w: number, h: number): void {
    const { tileSize, dirtyTiles, width, height, currentTiles } = this;
    const x1 = Math.floor(Math.max(0, xx));
    const y1 = Math.floor(Math.max(0, yy));
    const x2 = Math.ceil(Math.min(xx + w, width));
    const y2 = Math.ceil(Math.min(yy + h, height));
    for (let y = y1; y <= y2; y += tileSize) {
      for (let x = x1; x <= x2; x += tileSize) {
        const index = this.xyToTile(x, y);
        dirtyTiles.add(index);
        currentTiles[index] = DirtyTile;
      }
    }
  }

  set fillStyle(style: string) {
    this.context.fillStyle = style;
  }
  fillRect(x: number, y: number, w: number, h: number): void {
    this.markDirty(x, y, w, h);
    this.context.fillRect(x, y, w, h);
  }
}

const map = new Map<string, Canvas2d>();
export function getCanvas2d(id: string, drawing: Drawing): Canvas2d {
  let canvas2d = map.get(id);
  if (!canvas2d) {
    canvas2d = new Canvas2d(drawing.width, drawing.height);
    map.set(id, canvas2d);
  }
  return canvas2d;
}
