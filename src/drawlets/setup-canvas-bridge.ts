import DrawingModel from './file-format/DrawingModel';
import { Dna } from './drawos/dna';
import { DrawletEvent, DrawletInstance, UpdateObject } from './Drawlet';
import pointerEventsBridge, { EventBridge } from './pointer-events-bridge';
import { ADD_LAYER_EVENT, GOTO_EVENT } from './file-format/events';
import { FiverMode } from './fiver/fiver';

export default function setupHtmlCanvasBridge<
  DrawletDna extends Dna,
  Mode extends object,
  State extends object
>(
  drawingModel: DrawingModel<DrawletDna, Mode, State>,
  onUpdate: (options: UpdateObject<Mode>) => void,
  editable: boolean = true,
  maxInitialWidth?: number,
  maxInitialHeight?: number,
): DrawletInstance<Mode> {
  const transform = {
    translateX: 0,
    translateY: 0,
    scale: 1,
  };

  let requestedAnimation: number | null = null;
  let newTransform = true;
  let targetCursor = 0;
  let loaded = false;
  let playing = false;
  let playTimer: number | null = null;

  const MS_PER_GOTO = 15;

  const dna = drawingModel._dna;
  const canvas = editable
    ? drawingModel.editCanvas
    : drawingModel.createCanvas();

  const handleEvent = (event: DrawletEvent, lastEvent: boolean = true) => {
    const [type, time, payload] = event;
    drawingModel.addStroke(
      type,
      time,
      payload,
      lastEvent ? requestRepaint : undefined,
    );
  };

  drawingModel.onceLoaded(() => {
    console.log(`drawingModel loaded: ${canvas.strokeCount}`);
    loaded = true;
    canvas.gotoEnd(requestRepaint);
  });

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

  function getUpdateObject(): UpdateObject<Mode> {
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
      onUpdate(getUpdateObject());
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
        canvas.goto(0, nextPlay);
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
    canvas.goto(targetCursor, () => {
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
    drawingModel.addStroke(name, Date.now(), payload, notifyRenderDone);
  }

  let eventBridge: EventBridge | undefined;
  return {
    dom: canvas.dom,

    getUpdateObject,

    getInfo() {
      return drawingModel.getInfo();
    },

    flush() {
      return drawingModel.flush(() => {});
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
      const currentLayerCount = (getUpdateObject().mode as FiverMode).layers;
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
      canvas.goto(cursor, notifyRenderDone);
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
          if (loaded) {
            requestRepaint();
          }
        },
        maxInitialWidth,
        maxInitialHeight,
      );
      return eventBridge.unsubscribe;
    },
  };
}
