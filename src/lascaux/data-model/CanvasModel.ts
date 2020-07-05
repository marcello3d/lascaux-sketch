import { patch } from 'jsondiffpatch';
import produce, { Draft } from 'immer';
import { PromiseOrValue } from 'promise-or-value';

import { DrawBackend, Snap } from '../Drawlet';
import { DrawingDoc, Id, LOCAL_USER, UserMode } from '../DrawingDoc';
import {
  DrawingState,
  handleLegacyEvent,
  isLegacyEvent,
  makeInitialState,
} from '../legacy-model';
import { GOTO_EVENT, PATCH_DOC_EVENT, PATCH_MODE_EVENT } from './events';
import jsonCopy from '../util/json-copy';
import { isSkipped } from './GotoMap';
import DrawingModel from './DrawingModel';
import { GlDrawBackend } from '../webgl/gl-draw-backend';
import ModeMap from './ModeMap';

export class CanvasModel {
  private readonly _drawing: DrawingModel;
  private readonly _backend: DrawBackend;
  private readonly _modeMap: ModeMap;

  private _doc: DrawingDoc;
  private _inGoto: boolean;
  private _cursor: number = 0;
  private _targetCursor: number = 0;
  _state: DrawingState = makeInitialState();

  constructor(drawing: DrawingModel, private readonly userId: Id = LOCAL_USER) {
    this._doc = drawing._initialDoc;
    this._modeMap = new ModeMap(drawing._initialDoc.users[userId]);
    this._drawing = drawing;
    this._backend = new GlDrawBackend(this._doc.artboard);
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

  get latestMode(): UserMode {
    return this._modeMap.getMode(this.strokeCount);
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
    this._backend.reset(doc.artboard);
    this._doc = doc;
  }

  private setDoc(doc: DrawingDoc) {
    this._doc = doc;
    this._backend.setArtboard(doc.artboard);
  }

  addStroke(
    cursor: number,
    eventType: string,
    payload: any,
  ): PromiseOrValue<void> {
    this._targetCursor = cursor;
    if (eventType === GOTO_EVENT) {
      return this._goto(payload);
    }
    this._cursor = cursor;
    this.execute(eventType, payload);
    this._modeMap.setMode(cursor, this._doc.users[this.userId]);
    this._backend.repaint();
  }

  private mutateDoc(recipe: (draft: Draft<DrawingDoc>) => void) {
    this.setDoc(produce(this._doc, recipe));
  }

  private execute(eventType: string, payload: any) {
    switch (eventType) {
      case GOTO_EVENT:
        return;
      case PATCH_DOC_EVENT:
        if (payload) {
          this.mutateDoc((draft) => {
            patch(draft.artboard, payload);
          });
        }
        return;
      case PATCH_MODE_EVENT:
        if (payload) {
          this.mutateDoc((draft) => {
            patch(draft.users[this.userId], payload);
          });
        }
        return;
    }
    if (isLegacyEvent(eventType)) {
      this.mutateDoc((draft) => {
        handleLegacyEvent(draft, this.userId, eventType, payload);
      });
      return;
    }

    this._drawing._handleCommand(
      this._modeMap.getMode(this._cursor),
      this._state,
      this._backend.getDrawingContext(),
      eventType,
      payload,
    );
  }
  gotoEnd(): PromiseOrValue<void> {
    return this.goto(this.strokeCount);
  }

  repaint() {
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

    const { revert, skips, target } = this._drawing.planGoto(
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
        this.execute(type, payload);
      }
    }

    this._backend.repaint();
    this._inGoto = false;
  }

  getSnap(): Snap {
    return {
      ...this._backend.getSnapshot(),
      doc: this.doc,
      state: jsonCopy(this._state),
    };
  }

  getInfo(): string | undefined {
    return this._backend.getInfo();
  }
}
