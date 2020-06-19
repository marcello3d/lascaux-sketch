export default class ModeMap<Mode extends object> {
  private _indexes: number[] = [];
  private _modeMap: Record<number, Mode> = {};
  private _lastStrokeIndex = -1;
  constructor(initialMode?: Mode) {
    if (initialMode) {
      this._lastStrokeIndex = -2;
      this.addMode(-1, initialMode);
    }
  }

  addMode(strokeIndex: number, payload: any): void {
    if (strokeIndex <= this._lastStrokeIndex) {
      throw new Error('modes must be added in order');
    }

    const modes = this._indexes;
    const lastMode = this._modeMap[modes[modes.length - 1]] || {};
    modes.push(strokeIndex);

    this._modeMap[strokeIndex] = { ...lastMode, ...payload };

    this._lastStrokeIndex = strokeIndex;
  }

  getMode(strokeIndex: number): Mode {
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
    return {} as Mode;
  }
}
