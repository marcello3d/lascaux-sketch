function findSkipRange(skips, index) {
  // binary search skips
  let min = 0;
  let max = skips.length - 1;
  while (min <= max) {
    const i = (min + max) >> 1;
    const skip = skips[i];
    if (index < skip[0]) {
      max = i - 1;
    } else if (index > skip[1]) {
      min = i + 1;
    } else {
      return skip;
    }
  }
  return null;
}

export function isSkipped(skips, index) {
  // TODO: this could be done with binary search
  for (let i = 0; i < skips.length; i++) {
    const skip = skips[i];
    // skips are in order, so if we a skip that's greater, we can stop looking
    if (skip[0] > index) {
      return false;
    }
    // In range?
    if (skip[1] >= index) {
      return true;
    }
  }
  return false;
}

export default class GotoMap {
  static deserialize({ gotos, keys }) {
    const map = new GotoMap();
    for (let i = 0; i < gotos.length; ) {
      map.addGoto(gotos[i++], gotos[i++]);
    }
    map._keyframes = [...keys];
    return map;
  }

  constructor() {
    this._gotos = [];
    this._gotoMap = {};
    this._keyframes = [];
    this._skipMap = {};
    this._lastStrokeIndex = -1;
    this._previousSkips = [];
  }

  getGotoIndexes() {
    return this._gotos;
  }

  serialize() {
    // Everything can be recomputed from the gotos list
    const gotos = [];
    for (const source of this._gotos) {
      gotos.push(source, this._gotoMap[source]);
    }
    return {
      gotos,
      keys: this._keyframes,
    };
  }

  /**
   * returns stroke index, dereferencing gotos
   */
  dereference(index) {
    const gotoTargetStrokeIndex = index - 1;
    if (gotoTargetStrokeIndex in this._gotoMap) {
      return this._gotoMap[gotoTargetStrokeIndex];
    }
    return index;
  }

  addKeyframe(strokeIndex) {
    if (strokeIndex <= this._keyframes[this._keyframes.length - 1]) {
      throw new Error('keyframes must be added in order');
    }
    this._keyframes.push(strokeIndex);
  }

  addGoto(strokeIndex, targetCursor) {
    if (targetCursor >= strokeIndex) {
      console.error('target >= source');
      return targetCursor;
    }
    if (strokeIndex <= this._lastStrokeIndex) {
      console.error('goto must be added in order');
      return targetCursor;
    }
    targetCursor = this.dereference(targetCursor);
    this._gotos.push(strokeIndex);
    this._gotoMap[strokeIndex] = targetCursor;
    const newSkips = [];
    for (const skip of this._previousSkips) {
      if (skip[1] < targetCursor) {
        newSkips.push(skip);
      }
    }
    newSkips.push([targetCursor, strokeIndex - 1]);
    this._skipMap[strokeIndex] = this._previousSkips = newSkips;
    this._lastStrokeIndex = strokeIndex;
    return targetCursor;
  }

  _getSkips(index) {
    const gotos = this._gotos;
    // binary search gotos map
    let min = 0;
    let max = gotos.length - 1;
    while (min <= max) {
      const i = (min + max) >> 1;
      const gotoIndex = gotos[i];
      if (index < gotoIndex) {
        max = i - 1;
      } else if (index >= gotos[i + 1]) {
        min = i + 1;
      } else {
        return this._skipMap[gotoIndex];
      }
    }
    return [];
  }

  /**
   * Return a plan of how to get from one cursor point to another
   * @param start
   * @param end
   * @returns {Array}
   */
  planGoto(start, end) {
    if (start === end) {
      throw new Error('cannot goto self');
    }
    if (this.dereference(start) !== start) {
      throw new Error('invalid start');
    }
    if (this.dereference(end) !== end) {
      throw new Error('invalid end');
    }
    const steps = {};
    const inEndSkip = findSkipRange(this._getSkips(end), start);
    // Cursor is currently a region that will be canceled,
    // so we must go back to the start of the cancelled region before skipping over it
    if (inEndSkip && inEndSkip[0] !== start) {
      steps.revert = inEndSkip[0];
    } else {
      const inStartSkip = findSkipRange(this._getSkips(start), end);
      // Going (back) to a region that is currently canceled,
      // so we must go back to the start of the cancelled region
      if (inStartSkip) {
        steps.revert = inStartSkip[0];
      } else if (end < start) {
        steps.revert = end;
      }
    }
    steps.skips = this._getSkips(end - 1);
    return steps;
  }

  computeUndo(from) {
    from = this.dereference(from);
    const skips = this._getSkips(from);
    const keyframes = this._keyframes;
    // TODO: binary search to find keyframe < from, then walk backwards
    for (let i = keyframes.length; --i >= 0; ) {
      const keyframe = keyframes[i];
      if (keyframe < from && findSkipRange(skips, keyframe - 1) === null) {
        return this.dereference(keyframe);
      }
    }
    return undefined;
  }

  computeRedo(from) {
    const gotos = this._gotos;
    if (gotos.length === 0) {
      return undefined;
    }
    const lastGotoStrokeIndex = gotos[gotos.length - 1];

    // have we drawn since the last goto?
    if (from > lastGotoStrokeIndex) {
      return undefined;
    }

    // If we're not on the last goto, something's out of sync
    const gotoMap = this._gotoMap;
    if (from !== gotoMap[lastGotoStrokeIndex]) {
      throw new Error(
        `unexpected computeRedo from ${from}, expected ${
          gotoMap[lastGotoStrokeIndex]
        }`,
      );
    }

    // We look at all the gotos at the end of the stroke list
    // We find the original goto that took us to our current spot
    // Work backwards to find the first goto in the last consecutive block of gotos
    let gotoStrokeIndex;
    for (let i = gotos.length; --i >= 0; ) {
      const gotoSource = gotos[i];
      const priorGotoSource = gotos[i - 1];

      // Find earliest goto that targets the current cursor
      if (gotoMap[gotoSource] === from) {
        gotoStrokeIndex = gotoSource;
      }
      // Two gotos in a row?
      if (priorGotoSource !== gotoSource - 1) {
        break;
      }
    }
    if (gotoStrokeIndex - 1 in gotoMap) {
      gotoStrokeIndex = gotoMap[gotoStrokeIndex - 1];
    }
    if (gotoStrokeIndex > from) {
      return gotoStrokeIndex;
    }
    return undefined;
  }
}
