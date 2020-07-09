import { UserMode } from '../DrawingDoc';

export default class ModeMap {
  private _indexes: number[] = [];
  private _modeMap: Record<number, UserMode> = {};
  private _lastStrokeIndex = -2;
  constructor(initialMode: UserMode) {
    this.addMode(-1, initialMode);
  }

  addMode(strokeIndex: number, mode: UserMode): void {
    if (mode === this._modeMap[this._lastStrokeIndex]) {
      return;
    }
    if (strokeIndex <= this._lastStrokeIndex) {
      throw new Error('modes must be added in order');
    }

    this._indexes.push(strokeIndex);
    this._modeMap[strokeIndex] = mode;

    this._lastStrokeIndex = strokeIndex;
  }

  getMode(strokeIndex: number): UserMode {
    const modes = this._indexes;
    // binary search mode map
    let min = 0;
    let max = modes.length - 1;
    while (min <= max) {
      const i = (min + max) >> 1;
      const modeIndex = modes[i];
      if (strokeIndex - 1 < modeIndex) {
        max = i - 1;
      } else if (strokeIndex - 1 >= modes[i + 1]) {
        min = i + 1;
      } else {
        return this._modeMap[modeIndex];
      }
    }
    throw new Error(`could not load mode for ${strokeIndex}`);
  }

  getLatestMode() {
    return this._modeMap[this._lastStrokeIndex];
  }
}
