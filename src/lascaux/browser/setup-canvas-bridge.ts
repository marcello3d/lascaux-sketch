import DrawingModel from '../data-model/DrawingModel';
import { LascauxDomInstance, LascauxUiState } from '../Drawlet';
import pointerEventsBridge, { EventBridge } from './pointer-events-bridge';
import {
  DrawletEvent,
  GOTO_EVENT,
  PATCH_DOC_EVENT,
  PATCH_MODE_EVENT,
} from '../data-model/events';
import { then } from 'promise-or-value';
import { Artboard, DrawingDoc, LOCAL_USER, UserMode } from '../DrawingDoc';
import { diff } from 'jsondiffpatch';
import produce, { Draft } from 'immer';
import { Mode } from 'fs';

export default function createLascauxDomInstance(
  drawingModel: DrawingModel,
  onUpdate: (options: LascauxUiState) => void,
  editable: boolean = true,
  maxInitialWidth?: number,
  maxInitialHeight?: number,
): LascauxDomInstance {
  const transform = {
    translateX: 0,
    translateY: 0,
    scale: 1,
  };

  let requestedAnimation: number | null = null;
  let newTransform = true;
  let targetCursor = 0;
  let playing = false;
  let playTimer: number | null = null;

  const MS_PER_GOTO = 15;

  const canvas = editable
    ? drawingModel.editCanvas
    : drawingModel.createCanvas();

  const handleEvent = (event: DrawletEvent, lastEvent: boolean = true) => {
    const [type, time, payload] = event;
    const pov = drawingModel.addStroke(type, time, payload);
    if (lastEvent) {
      then(pov, requestRepaint);
    }
  };

  then(canvas.gotoEnd(), requestRepaint);

  function requestRepaint() {
    if (!requestedAnimation) {
      requestedAnimation = window.requestAnimationFrame(() => {
        requestedAnimation = null;
        if (newTransform) {
          canvas.setTransform(
            transform.translateX,
            transform.translateY,
            transform.scale,
          );
          newTransform = false;
        }
        canvas.redraw();
        notifyRenderDone();
      });
    }
  }

  let requestNotifyFrame: number | null = null;
  let needToNotify = false;

  function getUiState(): LascauxUiState {
    return {
      artboard: canvas.doc.artboard,
      mode: canvas.latestMode,
      cursor: canvas.targetCursor,
      strokeCount: canvas.strokeCount,
      undo: editable ? drawingModel.computeUndo() : undefined,
      redo: editable ? drawingModel.computeRedo() : undefined,
      gotos: drawingModel.getGotoIndexes(),
      playing,
      transform,
    };
  }

  function notifyRenderDone() {
    // debounce notifications
    if (!requestNotifyFrame) {
      onUpdate(getUiState());
      needToNotify = false;
      requestNotifyFrame = window.requestAnimationFrame(() => {
        requestNotifyFrame = null;
        if (needToNotify) {
          notifyRenderDone();
        }
      });
    } else {
      needToNotify = true;
    }
  }

  function togglePlaying() {
    if (playing) {
      // Stop
      console.log('stop playing');
      if (playTimer) {
        clearTimeout(playTimer);
      }
      playing = false;
    } else {
      playing = true;
      targetCursor = canvas.targetCursor;
      if (targetCursor >= canvas.strokeCount) {
        targetCursor = 0;
        // Rewind to beginning, then play
        then(canvas.goto(0), nextPlay);
      } else {
        nextPlay();
      }
    }
  }

  function nextPlay() {
    let time = 0;
    const timeAllotted = MS_PER_GOTO;

    if (playing) {
      while (targetCursor < canvas.strokeCount && time < timeAllotted) {
        time++;
        targetCursor++;
      }
    }

    let gotoStart = Date.now();
    then(canvas.goto(targetCursor), () => {
      notifyRenderDone();
      if (playing) {
        if (targetCursor < canvas.strokeCount) {
          const gotoTime = Date.now() - gotoStart;
          playTimer = window.setTimeout(nextPlay, timeAllotted - gotoTime);
        } else {
          playing = false;
        }
      }
    });
  }

  function addStroke(name: string, payload: any = {}) {
    then(drawingModel.addStroke(name, Date.now(), payload), notifyRenderDone);
  }

  let eventBridge: EventBridge | undefined;
  return {
    dom: canvas.dom,

    getUiState,

    getInfo() {
      return drawingModel.getInfo();
    },

    flush() {
      return drawingModel.flush();
    },

    getPng(): Promise<Blob> {
      return canvas.getPng();
    },

    mutateArtboard(recipe: (draft: Draft<Artboard>) => void) {
      const payload = diff(
        canvas.doc,
        produce(canvas.doc, (draft) => {
          recipe(draft.artboard);
        }),
      );
      if (payload) {
        addStroke(PATCH_DOC_EVENT, payload);
      }
    },

    mutateMode(recipe: (draft: Draft<UserMode>) => void) {
      const mode = canvas.doc.users[LOCAL_USER];
      const payload = diff(mode, produce(mode, recipe));
      if (payload) {
        addStroke(PATCH_MODE_EVENT, payload);
      }
    },

    setScale(scale: number) {
      if (!eventBridge) {
        throw new Error('trying to set scale when not subscribed');
      }
      eventBridge.setScale(scale);
    },

    addGoto(cursor: number) {
      addStroke(GOTO_EVENT, cursor);
    },

    setPlaying(_playing: boolean) {
      if (playing !== _playing) {
        togglePlaying();
      }
    },

    seekTo(cursor: number) {
      then(canvas.goto(cursor), notifyRenderDone);
    },

    subscribe() {
      eventBridge = pointerEventsBridge(
        canvas.dom,
        // TODO: handle updates to artboard size
        canvas.doc.artboard.width,
        canvas.doc.artboard.height,
        transform,
        handleEvent,
        () => {
          newTransform = true;
          requestRepaint();
        },
        maxInitialWidth,
        maxInitialHeight,
      );
      return eventBridge.unsubscribe;
    },
  };
}
