import DrawingModel from '../data-model/DrawingModel';
import { LascauxDomInstance, LascauxUiState } from '../Drawlet';
import pointerEventsBridge, { EventBridge } from './pointer-events-bridge';
import {
  DrawletEvent,
  GOTO_EVENT,
  PATCH_ARTBOARD_EVENT,
  PATCH_MODE_EVENT,
} from '../data-model/events';
import { then } from 'promise-or-value';
import { Artboard, UserMode } from '../DrawingDoc';
import { diff } from 'jsondiffpatch';
import produce, { Draft } from 'immer';

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

  const canvas = drawingModel.editCanvas;

  const handleEvent = (event: DrawletEvent, lastEvent: boolean = true) => {
    const [type, time, payload] = event;
    const pov = drawingModel.addStroke(type, time, payload);
    if (lastEvent) {
      then(pov, requestRepaint);
    }
  };

  if (editable) {
    then(canvas.gotoEnd(), requestRepaint);
  } else {
    requestRepaint();
  }

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
        canvas.repaint();
        notifyRenderDone();
      });
    }
  }

  // UI state notifications are throttled to one per frame. A frame is not
  // guaranteed: a hidden or background page gets no animation frames, and
  // when the throttle waited on one alone it never let another notification
  // through, so the UI froze on its last state (the Erase checkbox turned
  // on, then never off: React kept putting back the stale `checked`, and
  // B/E changed the brush without the UI showing it). A timer is the
  // fallback, and the throttle ends before anything in the frame can throw.
  let requestNotifyFrame: number | null = null;
  let requestNotifyTimer: number | null = null;
  let needToNotify = false;
  const uiListeners = new Set<(state: LascauxUiState) => void>();

  function getUiState(): LascauxUiState {
    return {
      artboard: canvas.artboard,
      mode: canvas.uiMode,
      cursor: canvas.targetCursor,
      strokeCount: drawingModel.strokeCount,
      undo: editable ? drawingModel.computeUndo() : undefined,
      redo: editable ? drawingModel.computeRedo() : undefined,
      playing,
      transform,
    };
  }

  function notifyRenderDone() {
    // debounce notifications
    if (requestNotifyFrame === null && requestNotifyTimer === null) {
      const state = getUiState();
      onUpdate(state);
      uiListeners.forEach((listener) => listener(state));
      needToNotify = false;
      requestNotifyFrame = window.requestAnimationFrame(() =>
        endNotifyThrottle(true),
      );
      requestNotifyTimer = window.setTimeout(
        () => endNotifyThrottle(false),
        100,
      );
    } else {
      needToNotify = true;
    }
  }

  function endNotifyThrottle(inFrame: boolean) {
    if (requestNotifyFrame !== null) {
      window.cancelAnimationFrame(requestNotifyFrame);
      requestNotifyFrame = null;
    }
    if (requestNotifyTimer !== null) {
      window.clearTimeout(requestNotifyTimer);
      requestNotifyTimer = null;
    }
    try {
      if (inFrame) {
        canvas.repaint();
      }
    } finally {
      if (needToNotify) {
        notifyRenderDone();
      }
    }
  }

  function togglePlaying() {
    if (playing) {
      // Stop
      if (playTimer) {
        clearTimeout(playTimer);
      }
      playing = false;
    } else {
      playing = true;
      targetCursor = canvas.targetCursor;
      if (targetCursor >= canvas.renderCursor) {
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
      while (targetCursor < canvas.renderCursor && time < timeAllotted) {
        time++;
        targetCursor++;
      }
    }

    let gotoStart = Date.now();
    then(
      canvas.goto(targetCursor),
      () => {
        canvas.repaint();
        notifyRenderDone();
        if (playing) {
          if (targetCursor < canvas.renderCursor) {
            const gotoTime = Date.now() - gotoStart;
            playTimer = window.setTimeout(nextPlay, timeAllotted - gotoTime);
          } else {
            playing = false;
          }
        }
      },
      (error) => {
        console.error(`error playing`, error);
      },
    );
  }

  function addStroke(name: string, payload: any = {}) {
    then(
      drawingModel.addStroke(name, Date.now(), payload),
      notifyRenderDone,
      (error) => {
        console.error(`error adding stroke ${name}`, error);
      },
    );
  }

  let eventBridge: EventBridge | undefined;
  return {
    dom: canvas.dom,

    getUiState,

    listen(listener: (state: LascauxUiState) => void) {
      uiListeners.add(listener);
      return () => {
        uiListeners.delete(listener);
      };
    },

    getInfo() {
      return drawingModel.editCanvas.getInfo();
    },

    flush() {
      return drawingModel.flush();
    },

    getPng(): Promise<Blob> {
      return canvas.getPng();
    },

    mutateArtboard(recipe: (draft: Draft<Artboard>) => void) {
      const payload = diff(canvas.artboard, produce(canvas.artboard, recipe));
      if (payload) {
        addStroke(PATCH_ARTBOARD_EVENT, payload);
      }
    },

    mutateMode(recipe: (draft: Draft<UserMode>) => void) {
      const payload = diff(canvas.uiMode, produce(canvas.uiMode, recipe));
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
        canvas.artboard.width,
        canvas.artboard.height,
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
