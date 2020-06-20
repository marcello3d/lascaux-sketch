import DrawingModel from '../data-model/DrawingModel';
import { LascauxDomInstance, LascauxUiState } from '../Drawlet';
import pointerEventsBridge, { EventBridge } from './pointer-events-bridge';
import {
  ADD_LAYER_EVENT,
  DrawletEvent,
  GOTO_EVENT,
} from '../data-model/events';
import { then } from 'promise-or-value';

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

  const dna = drawingModel._dna;
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
      cursor: canvas.targetCursor,
      strokeCount: canvas.strokeCount,
      undo: editable ? drawingModel.computeUndo() : undefined,
      redo: editable ? drawingModel.computeRedo() : undefined,
      gotos: drawingModel.getGotoIndexes(),
      mode: canvas.mode,
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

    setMode(mode: string, value: any) {
      addStroke(`%${mode}`, value);
    },

    setScale(scale: number) {
      if (!eventBridge) {
        throw new Error('trying to set scale when not subscribed');
      }
      eventBridge.setScale(scale);
    },

    addLayer() {
      const currentLayerCount = getUiState().mode.layers;
      addStroke(ADD_LAYER_EVENT);
      addStroke('%layers', currentLayerCount + 1);
      addStroke('%layer', currentLayerCount);
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
        dna.width,
        dna.height,
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