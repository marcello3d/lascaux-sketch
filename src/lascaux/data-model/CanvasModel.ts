import { DrawBackend, DrawContext } from '../Drawlet';
import { DrawingDoc, ROOT_USER } from '../DrawingDoc';
import {
  DrawingState,
  handleLegacyEvent,
  makeInitialState,
} from '../legacy-model';
import { PromiseOrValue } from 'promise-or-value';
import { GOTO_EVENT, PATCH_DOC_EVENT } from './events';
import jsonCopy from '../util/json-copy';
import { isSkipped } from './GotoMap';
import DrawingModel from './DrawingModel';
import { GlDrawBackend } from '../webgl/gl-draw-backend';
import { patch } from 'jsondiffpatch';
import produce from 'immer';

export class CanvasModel {
  readonly _drawing: DrawingModel;
  readonly _backend: DrawBackend;

  private _doc: DrawingDoc;
  private _inGoto: boolean;
  private _cursor: number = 0;
  private _targetCursor: number = 0;
  _state: DrawingState = makeInitialState();

  constructor(drawing: DrawingModel) {
    this._doc = drawing._initialDoc;
    this._drawing = drawing;
    this._backend = new GlDrawBackend(this._doc);
    this._inGoto = false;
    this.reset();
  }

  get cursor(): number {
    return this._cursor;
  }

  get targetCursor(): number {
    return this._targetCursor;
  }

  get doc(): DrawingDoc {
    return this._doc;
  }

  get strokeCount(): number {
    return this._drawing._strokeCount;
  }

  get layerCount(): number {
    return this._backend.getLayerCount();
  }

  get dom(): HTMLCanvasElement {
    return this._backend.getDom();
  }

  getPng(): Promise<Blob> {
    return this._backend.getPng();
  }

  setTransform(translateX: number, translateY: number, scale: number): void {
    this._backend.setTransform(translateX, translateY, scale);
  }

  private reset() {
    this._cursor = 0;
    this._state = makeInitialState();
    const doc = this._drawing._initialDoc;
    this._backend.reset(doc);
    this._doc = doc;
  }

  private setDoc(doc: DrawingDoc) {
    this._doc = doc;
    this._backend.setDoc(doc);
  }

  _execute(
    cursor: number,
    eventType: string,
    payload: any,
  ): PromiseOrValue<void> {
    this._targetCursor = cursor;
    if (eventType === GOTO_EVENT) {
      return this._goto(payload);
    }
    this._cursor = cursor;
    this._executeRaw(eventType, payload);
    this._backend.repaint();
  }

  _executeRaw(eventType: string, payload: any) {
    if (eventType === GOTO_EVENT) {
      return;
    }

    if (eventType === PATCH_DOC_EVENT) {
      if (payload) {
        this.setDoc(
          produce(this._doc, (draft) => {
            patch(draft, payload);
          }),
        );
      }
      return;
    }
    const legacy = handleLegacyEvent(this._doc, ROOT_USER, eventType, payload);
    if (legacy) {
      if (legacy !== this._doc) {
        this.setDoc(legacy);
      }
      return;
    }

    const exec = this._drawing._handleCommand;
    // Call from local variable so `this` is null
    exec(
      this._makeDrawContext(),
      this._backend.getDrawingContext(),
      eventType,
      payload,
    );
  }

  _makeDrawContext(): DrawContext {
    return {
      doc: this._doc,
      user: ROOT_USER,
      state: this._state,
    };
  }

  gotoEnd(): PromiseOrValue<void> {
    return this.goto(this.strokeCount);
  }

  redraw() {
    this._backend.repaint();
  }

  goto(targetCursor: number): PromiseOrValue<void> {
    this._targetCursor = targetCursor;
    return this._goto(targetCursor);
  }

  async _goto(targetCursor: number): Promise<void> {
    if (this._inGoto) {
      return;
    }

    const { revert, skips, target } = this._drawing._planGoto(
      this._cursor,
      targetCursor,
    );
    if (target === undefined || skips === undefined) {
      return;
    }

    this._inGoto = true;

    // console.log(`goto ${this._cursor} -> ${targetCursor}: revert ${revert}, target ${target}, skips: ${skips.map(x => '[' + x + ']')}`)
    // Revert back to nearest snapshot
    const loadSnapshot = async (index: number) => {
      if (index === 0) {
        this.reset();
      } else {
        const storageModel = this._drawing._storageModel;
        const snap = await storageModel.getSnapshot(index);
        const { doc, state, snapshot } = snap;
        this.setDoc(doc);
        await this._backend.loadSnapshot(
          snapshot,
          storageModel.getSnapshotLink.bind(storageModel),
        );
        this._cursor = index;
        this._state = jsonCopy(state);
      }
    };
    // Do we need to rewind?
    if (revert !== undefined) {
      await loadSnapshot(
        this._drawing._snapshotMap.getNearestSnapshotIndex(revert, skips),
      );
    } else {
      // Can we skip ahead using snapshots?
      const nearestSnapshotIndex = this._drawing._snapshotMap.getNearestSnapshotIndex(
        target,
        skips,
      );
      // Don't bother loading snapshot if we're not going to skip more than 100 steps with it
      // (This is very common when playing back!)
      const MIN_STEP_SKIP = 750;
      if (
        nearestSnapshotIndex !== 0 &&
        nearestSnapshotIndex > this._cursor + MIN_STEP_SKIP
      ) {
        await loadSnapshot(nearestSnapshotIndex);
      }
    }

    while (this._cursor < target) {
      let stroke = this._drawing._storageModel.getStroke(this._cursor);
      if ('then' in stroke) {
        stroke = await stroke;
      }
      const { type, payload } = stroke;
      if (!isSkipped(skips, this._cursor++)) {
        this._executeRaw(type, payload);
      }
    }

    this._backend.repaint();
    this._inGoto = false;
  }
}
