import { UserMode } from '../DrawingDoc';

export default class ModeMap<Mode = UserMode> {
  private readonly modes: Record<number, Mode> = {};
  private readonly indexes: number[] = [];
  private _lastStrokeIndex = -2;
  constructor(initialMode: Mode) {
    this.addMode(-1, initialMode);
  }

  addMode(strokeIndex: number, mode: Mode): void {
    if (mode === this.modes[this._lastStrokeIndex]) {
      return;
    }
    if (strokeIndex <= this._lastStrokeIndex) {
      throw new Error('modes must be added in order');
    }

    this.indexes.push(strokeIndex);
    this.modes[strokeIndex] = mode;

    this._lastStrokeIndex = strokeIndex;
  }

  getMode(strokeIndex: number): Mode {
    const modes = this.indexes;
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
        return this.modes[modeIndex];
      }
    }
    throw new Error(`could not load mode for ${strokeIndex}`);
  }

  getLatestMode() {
    return this.modes[this._lastStrokeIndex];
  }
}
