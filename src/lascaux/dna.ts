export type Dna = {
  width: number;
  height: number;
  randomseed: string;
  colors: string[];
};

export type DrawingMode = {
  layers: number;
  layer: number;
  color: string;
  erase: boolean;
  size: number;
  alpha: number;
  spacing: number;
  hardness: number;
};

export type DrawingState = {
  size: number;
  a: number;
  x: number;
  y: number;
};

export function newDna(width: number = 512, height: number = 512): Dna {
  return {
    width,
    height,

    // Should mode-changing options be managed by drawlet os?
    colors: ['#497aa6', '#f2c063', '#f2dbce', '#a6654e', '#f2695c'],
    // TODO: move
    randomseed: Math.random().toString(36).slice(2),
  };
}

export function makeInitialState(): DrawingState {
  return {
    x: 0,
    y: 0,
    a: 0,
    size: 0,
  };
}
