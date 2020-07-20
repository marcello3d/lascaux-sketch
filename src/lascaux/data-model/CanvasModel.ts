import produce from 'immer';
import { PromiseOrValue } from 'promise-or-value';

import { DrawingContext, Snap } from '../Drawlet';
import { Artboard, UserMode } from '../DrawingDoc';
import {
  DrawingState,
  handleLegacyEvent,
  isLegacyEvent,
  makeInitialState,
} from '../legacy-model';
import { GOTO_EVENT, PATCH_ARTBOARD_EVENT, PATCH_MODE_EVENT } from './events';
import jsonCopy from '../util/json-copy';
import { isSkipped } from './GotoMap';
import DrawingModel from './DrawingModel';
import { GlDrawingContext } from '../webgl/GlDrawingContext';
import ModeMap from './ModeMap';
import { immerPatch } from './patch';
import { safeMode } from '../DrawingDocUtil';
import { isPromise } from '../util/promise-or-value';

export class CanvasModel {
  private readonly _ctx: DrawingContext;
  private readonly _modeMap: ModeMap<UserMode>;

  private _artboard: Artboard;
  private _inGoto: boolean;
  // The number of strokes currently drawn on the drawing context
  private _renderCursor: number = 0;
  // The stroke cursor we're trying to get to
  private _targetCursor: number = 0;
  _state: DrawingState = makeInitialState();

  constructor(
    private readonly _drawing: DrawingModel,
    private readonly initialArtboard: Artboard,
    private readonly initialMode: UserMode,
  ) {
    this._artboard = initialArtboard;
    this._modeMap = new ModeMap<UserMode>(initialMode);
    this._ctx = new GlDrawingContext(initialArtboard);
    this._inGoto = false;
    this.reset();
  }

  get artboard(): Artboard {
    return this._artboard;
  }
  get cursor(): number {
    return this._renderCursor;
  }

  get targetCursor(): number {
    return this._targetCursor;
  }

  /** The mode at the current cursor location */
  private get cursorMode() {
    return safeMode(this.artboard, this._modeMap.getMode(this._renderCursor));
  }

  /** The mode that represents what the user should see, regardless of cursor position */
  get uiMode(): UserMode {
    return safeMode(this.artboard, this._modeMap.getLatestMode());
  }

  get renderCursor(): number {
    return this._drawing._strokeCount;
  }

  get layerCount(): number {
    return this._ctx.getLayerCount();
  }

  get dom(): HTMLCanvasElement {
    return this._ctx.getDom();
  }

  getPng(): Promise<Blob> {
    return this._ctx.getPng();
  }

  setTransform(translateX: number, translateY: number, scale: number): void {
    this._ctx.setTransform(translateX, translateY, scale);
  }

  private reset() {
    this._renderCursor = 0;
    this._state = makeInitialState();
    this._artboard = this.initialArtboard;
    this._ctx.reset(this.initialArtboard);
  }

  private setArtboard(artboard: Artboard) {
    this._artboard = artboard;
    this._ctx.setArtboard(artboard);
  }

  addStroke(index: number, eventType: string, payload: any): void {
    this.execute(index, eventType, payload, true);
    this._renderCursor = this._targetCursor = index + 1;
  }

  private execute(
    index: number,
    eventType: string,
    payload: any,
    adding: boolean,
  ): void {
    this._renderCursor = index;
    switch (eventType) {
      case GOTO_EVENT:
        throw new Error('unexpected goto');

      case PATCH_ARTBOARD_EVENT:
        this.setArtboard(immerPatch(this._artboard, payload));
        return;

      case PATCH_MODE_EVENT:
        if (adding) {
          this.setCursorMode(immerPatch(this.cursorMode, payload));
        }
        return;
    }
    if (this.handleLegacyEvent(eventType, payload, adding)) {
      return;
    }
    this._drawing._handleCommand(
      this.cursorMode,
      this._state,
      this._ctx,
      eventType,
      payload,
    );
  }
  private handleLegacyEvent(
    eventType: string,
    payload: any,
    adding: boolean,
  ): boolean {
    if (!isLegacyEvent(eventType)) {
      return false;
    }
    const { artboard, cursorMode } = this;
    const [newMode, newArtboard] = produce(
      [cursorMode, artboard],
      ([modeDraft, artboardDraft]) => {
        handleLegacyEvent(artboardDraft, modeDraft, eventType, payload);
      },
    );
    if (adding && newMode !== cursorMode) {
      this.setCursorMode(newMode);
    }
    this.setArtboard(newArtboard);
    return true;
  }

  private setCursorMode(newMode: UserMode) {
    this._modeMap.addMode(this._renderCursor, newMode);
  }

  gotoEnd(): PromiseOrValue<void> {
    return this.goto(this.renderCursor);
  }

  repaint() {
    this._ctx.repaint();
  }

  goto(targetCursor: number): PromiseOrValue<void> {
    if (targetCursor > this.renderCursor) {
      throw new Error(
        `targetCursor > this.strokeCount (${targetCursor} > ${this.renderCursor})`,
      );
    }
    this._targetCursor = targetCursor;
    return this._goto(targetCursor);
  }

  async _goto(targetCursor: number): Promise<void> {
    if (this._inGoto) {
      return;
    }

    const { revert, skips, target } = this._drawing.planGoto(
      this._renderCursor,
      targetCursor,
    );
    if (target === undefined || skips === undefined) {
      return;
    }

    this._inGoto = true;

    // console.log(
    //   `goto ${
    //     this._renderCursor
    //   } -> ${targetCursor}: revert ${revert}, target ${target}, skips: ${skips.map(
    //     (x) => '[' + x + ']',
    //   )}`,
    // );
    // Revert back to nearest snapshot
    const loadSnapshot = async (index: number) => {
      const storageModel = this._drawing._storageModel;
      const snap = await storageModel.getSnapshot(index);
      const { artboard, state, snapshot } = snap;
      this.setArtboard(artboard);
      await this._ctx.loadSnapshot(
        snapshot,
        storageModel.getSnapshotLink.bind(storageModel),
      );
      this._renderCursor = index;
      this._state = jsonCopy(state);
    };
    // Do we need to rewind?

    if (revert !== undefined) {
      const nearestSnapshotIndex = this._drawing._snapshotMap.getNearestSnapshotIndex(
        revert,
        skips,
      );
      if (nearestSnapshotIndex === 0) {
        this.reset();
      } else {
        await loadSnapshot(nearestSnapshotIndex);
      }
    } else {
      // Can we skip ahead using snapshots?
      const nearestSnapshotIndex = this._drawing._snapshotMap.getNearestSnapshotIndex(
        target,
        skips,
      );
      // Don't bother loading snapshot if we're not going to skip more than 100 steps with it
      // (This is very common when playing back!)
      const MIN_STEP_SKIP = 0;
      if (nearestSnapshotIndex > this._renderCursor + MIN_STEP_SKIP) {
        await loadSnapshot(nearestSnapshotIndex);
      }
    }

    while (this._renderCursor < target) {
      let stroke = this._drawing._storageModel.getStroke(this._renderCursor);
      if (isPromise(stroke)) {
        stroke = await stroke;
      }
      const { type, payload } = stroke;
      if (!isSkipped(skips, this._renderCursor)) {
        this.execute(this._renderCursor, type, payload, false);
      }
      this._renderCursor++;
    }

    this._inGoto = false;
  }

  getSnap(): Snap {
    return {
      ...this._ctx.getSnapshotAndLinks(),
      artboard: this.artboard,
      state: jsonCopy(this._state),
    };
  }

  getInfo(): string | undefined {
    return this._ctx.getInfo();
  }
}
