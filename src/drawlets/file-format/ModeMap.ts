export type ModeSet = Record<string, any>;
export default class ModeMap {
  static deserialize(modes: any[], initialMode?: ModeSet) {
    const hasInitialMode = modes[0] === -1;
    const map = hasInitialMode
      ? new ModeMap(modes[1])
      : new ModeMap(initialMode);
    for (let i = hasInitialMode ? 2 : 0; i < modes.length; ) {
      map.addMode(modes[i++], modes[i++]);
    }
    return map;
  }

  private _indexes: number[] = [];
  private _rawModes: any[] = [];
  private _modeMap: Record<number, ModeSet> = {};
  private _lastStrokeIndex = -1;
  constructor(initialMode?: ModeSet) {
    if (initialMode) {
      this.addMode(-1, initialMode);
    }
  }

  serialize(): any[] {
    return this._rawModes;
  }

  addMode(strokeIndex: number, payload: any): void {
    if (strokeIndex <= this._lastStrokeIndex) {
      throw new Error('modes must be added in order');
    }
    this._rawModes.push(strokeIndex, payload);

    const modes = this._indexes;
    const lastMode = this._modeMap[modes[modes.length - 1]] || {};
    modes.push(strokeIndex);

    this._modeMap[strokeIndex] = { ...lastMode, ...payload };

    this._lastStrokeIndex = strokeIndex;
  }

  getMode(strokeIndex: number): ModeSet {
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
    return {};
  }
}
