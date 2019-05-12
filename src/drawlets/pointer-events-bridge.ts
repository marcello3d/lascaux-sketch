import { clamp, clampRange } from './clipping';

import {
  CURSOR_EVENT,
  CursorType,
  DRAW_END_EVENT,
  DRAW_EVENT,
  DRAW_START_EVENT,
  DrawletCursorEvent,
  DrawletDrawEvent,
  DrawletDrawEventType,
  DrawletEvent,
} from './Drawlet';

import styles from './pointer-events-bridge.module.css';

const CURSOR_TYPE_MAP: Record<string, CursorType> = {
  touch: 'touch',
  mouse: 'cursor',
  pen: 'stylus',
};

export type Transform = {
  translateX: number;
  translateY: number;
  scale: number;

  touchStart?: boolean;
  distStart?: number;
  scaleStart?: number;
  centerX?: number;
  centerY?: number;
  translateXStart?: number;
  translateYStart?: number;
};

type Pointer = {
  clientX: number;
  clientY: number;
};

const PointerDownEventName = 'pointerdown';
const PointerMoveEventName = 'pointermove';
const PointerUpEventName = 'pointerup';
const PointerCancelEventName = 'pointercancel';
const ResizeEventName = 'resize';
const WheelEventName = 'wheel';
const GestureStartEventName = 'gesturestart';
const GestureChangeEventName = 'gesturechange';
const GestureEndEventName = 'gestureend';
const KeyDownEventName = 'keydown';
const KeyUpEventName = 'keyup';
const KeySpace = ' ';

const POINTER_EVENT_TYPE_MAP: Record<string, DrawletDrawEventType> = {
  [PointerDownEventName]: DRAW_START_EVENT,
  [PointerMoveEventName]: DRAW_EVENT,
  [PointerUpEventName]: DRAW_END_EVENT,
  [PointerCancelEventName]: DRAW_END_EVENT,
};

export type EventBridge = {
  setScale(scale: number): void;
  unsubscribe(): void;
};

export default function pointerEventsBridge(
  domElement: HTMLElement,
  canvasWidth: number,
  canvasHeight: number,
  transform: Transform,
  eventCallback: (event: DrawletEvent, lastEvent: boolean) => void,
  transformCallback: () => void,
  maxWidth: number = Infinity,
  maxHeight: number = Infinity,
): EventBridge {
  const currentPointers: Record<string, Pointer> = {};
  let pointerCount = 0;
  const deviceScale = 1 / (window.devicePixelRatio || 1);

  let viewportWidth = 0;
  let viewportHeight = 0;

  let gesturing = false;
  let spacebar = false;
  let spacebarPanning:
    | {
        translateX: number;
        translateY: number;
        clientXStart: number;
        clientYStart: number;
      }
    | undefined;

  let rect: ClientRect | DOMRect = domElement.getBoundingClientRect();

  function onPointerEvent(event: PointerEvent) {
    const { type, pointerId, clientX, clientY } = event;
    const existingPointer = pointerId in currentPointers;
    if (type === PointerDownEventName) {
      if (existingPointer) {
        console.warn(`Unexpected ${type} event for existing pointer`);
        return;
      }
      rect = domElement.getBoundingClientRect();
      pointerCount++;
      if (pointerCount === 1) {
        eventCallback(toCursorEvent(event), false);
        document.addEventListener(PointerUpEventName, onPointerEvent);
        document.addEventListener(PointerMoveEventName, onPointerEvent);
        document.addEventListener(PointerCancelEventName, onPointerEvent);
        if (spacebar) {
          spacebarPanning = {
            translateX: transform.translateX,
            translateY: transform.translateY,
            clientXStart: clientX,
            clientYStart: clientY,
          };
          document.body.classList.add(styles.DrawletPanningActive);
        }
      }
    } else if (!existingPointer) {
      console.warn(`Unexpected ${type} event for new pointer`);
      return;
    }
    event.preventDefault();
    const pointerUp =
      type === PointerUpEventName || type === PointerCancelEventName;
    currentPointers[pointerId] = {
      clientX,
      clientY,
    };

    if (gesturing) {
      // Priority 1: safari gesture
    } else if (spacebarPanning) {
      // Priority 2: spacebar pan/zoom gestures
      setClampedTranslateScale(
        spacebarPanning.translateX - spacebarPanning.clientXStart + clientX,
        spacebarPanning.translateY - spacebarPanning.clientYStart + clientY,
      );
    } else if (transform.touchStart) {
      // Priority 3: multi-touch pan/zoom gestures
      if (pointerCount === 2) {
        pinchZoomUpdate(getCurrentPointers());
      }
    } else if (pointerCount === 1) {
      // Only draw with one pointer
      sendDrawEvents(event);
    } else if (pointerCount === 2) {
      // Start new pinch-zoom
      pinchZoomStart(getCurrentPointers());
    }
    if (pointerUp) {
      pointerCount--;
      delete currentPointers[pointerId];
      if (pointerCount === 0) {
        // Last pointer up
        removePointerMoveListeners();
        if (transform.touchStart) {
          pinchZoomEnd();
        }
        spacebarPanning = undefined;
        document.body.classList.remove(styles.DrawletPanningActive);
      }
    }
  }

  domElement.addEventListener(PointerDownEventName, onPointerEvent);
  domElement.addEventListener(WheelEventName, onWheelEvent);

  function getCurrentPointers(): Pointer[] {
    return Object.values(currentPointers);
  }

  function sendDrawEvents(event: PointerEvent): void {
    const { translateX, translateY, scale } = transform;
    const dx = -translateX - rect.left;
    const dy = -translateY - rect.top;
    const { type } = event;
    const eventType = POINTER_EVENT_TYPE_MAP[type];
    const toEvent = ({
      clientX,
      clientY,
      timeStamp,
      pressure,
      tiltX,
      tiltY,
    }: PointerEvent): DrawletDrawEvent => [
      eventType,
      timeStamp,
      {
        x: (clientX + dx) / scale,
        y: (clientY + dy) / scale,
        pressure,
        tiltX,
        tiltY,
      },
    ];
    if (type === PointerMoveEventName && event.getCoalescedEvents) {
      const events = event.getCoalescedEvents();
      if (events.length === 0) {
        throw new Error('got no coalesced events');
      }
      for (let i = 0; i < events.length; i++) {
        eventCallback(toEvent(events[i]), i === events.length - 1);
      }
    } else {
      eventCallback(toEvent(event), true);
    }
  }

  function toCursorEvent(event: PointerEvent): DrawletCursorEvent {
    const { pointerType, timeStamp } = event;
    return [
      CURSOR_EVENT,
      timeStamp,
      {
        cursor: CURSOR_TYPE_MAP[pointerType],
      },
    ];
  }

  function pinchZoomStart(pointers: Pointer[]) {
    transform.touchStart = true;
    transform.distStart = getDist(pointers);
    transform.scaleStart = transform.scale || 1;
    transform.centerX = getCenterX(pointers);
    transform.centerY = getCenterY(pointers);
  }

  function getCenterX(pointers: Pointer[]) {
    const x1 = pointers[0].clientX;
    const x2 = pointers[1].clientX;
    return x1 + (x2 - x1) / 2 - rect.left;
  }

  function getCenterY(pointers: Pointer[]) {
    const y1 = pointers[0].clientY;
    const y2 = pointers[1].clientY;
    return y1 + (y2 - y1) / 2 - rect.top;
  }

  function getDist(pointers: Pointer[]) {
    const dx = pointers[0].clientX - pointers[1].clientX;
    const dy = pointers[0].clientY - pointers[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function pinchZoomEnd() {
    delete transform.touchStart;
    delete transform.distStart;
    delete transform.scaleStart;
    delete transform.centerX;
    delete transform.centerY;
  }

  function pinchZoomUpdate(pointers: Pointer[]) {
    const {
      distStart = 0,
      scaleStart = 1,
      centerX = 0,
      centerY = 0,
      translateX,
      translateY,
    } = transform;

    const newCenterX = getCenterX(pointers);
    const newCenterY = getCenterY(pointers);
    // The canvas should be able to move such that:
    //  - it's always visible on the screen
    //  - the minimum position is no less than -(width of the canvas - viewportWidth)
    //  - the maximum position is no greater than the viewportWidth - width of canvas or zero

    setClampedTranslateScale(
      translateX + newCenterX - centerX,
      translateY + newCenterY - centerY,
      scaleStart * (distStart > 0 ? getDist(pointers) / distStart : 1),
      newCenterX,
      newCenterY,
    );
  }

  function setClampedTranslateScale(
    translateX: number,
    translateY: number,
    scale: number = transform.scale,
    centerX: number = getViewportWidth() / 2,
    centerY: number = getViewportHeight() / 2,
  ) {
    const clampedScale = clampScale(scale);
    setTranslateScale(
      clampRange(
        translateX,
        getViewportWidth(),
        canvasWidth,
        0.75,
        clampedScale,
      ),
      clampRange(
        translateY,
        getViewportHeight(),
        canvasHeight,
        0.75,
        clampedScale,
      ),
      centerX,
      centerY,
      clampedScale,
    );
  }

  function clampScale(scale: number) {
    const min = Math.min(
      Math.min(maxWidth, viewportWidth) / canvasWidth,
      Math.min(maxHeight, viewportHeight) / canvasHeight,
      deviceScale,
      0.1,
    );
    return clamp(scale, min, 10);
  }

  function setTranslateScale(
    translateX: number,
    translateY: number,
    centerX: number,
    centerY: number,
    newScale: number,
  ) {
    const currentScale = transform.scale;

    const x = centerX - translateX;
    const y = centerY - translateY;

    const scaledX = (x * newScale) / currentScale;
    const scaledY = (y * newScale) / currentScale;

    const newTranslateX = translateX + x - scaledX;
    const newTranslateY = translateY + y - scaledY;

    transform.centerX = centerX;
    transform.centerY = centerY;
    transform.translateX = newTranslateX;
    transform.translateY = newTranslateY;
    transform.scale = newScale;
    transformCallback();
  }

  function onWheelEvent(event: WheelEvent) {
    if (event.deltaMode === WheelEvent.DOM_DELTA_PIXEL) {
      if (event.ctrlKey) {
        setClampedTranslateScale(
          transform.translateX,
          transform.translateY,
          transform.scale - event.deltaY * 0.03,
          event.clientX - rect.left,
          event.clientY - rect.top,
        );
      } else {
        setClampedTranslateScale(
          transform.translateX - event.deltaX,
          transform.translateY - event.deltaY,
        );
      }
      transformCallback();
      event.preventDefault();
    }
  }
  interface GestureEvent extends MouseEvent {
    rotation: number;
    scale: number;
  }
  function onGestureStart(e: GestureEvent) {
    e.preventDefault();
    gesturing = true;
    transform.scaleStart = transform.scale;
    transform.centerX = e.clientX - rect.left;
    transform.centerY = e.clientY - rect.top;
    window.addEventListener(
      GestureChangeEventName,
      onGestureChange as EventListenerOrEventListenerObject,
    );
    window.addEventListener(
      GestureEndEventName,
      onGestureEnd as EventListenerOrEventListenerObject,
    );
  }
  function onGestureChange(e: GestureEvent) {
    e.preventDefault();
    const {
      translateX,
      translateY,
      centerX = 0,
      centerY = 0,
      scaleStart = 0,
    } = transform;
    const newCenterX = e.clientX - rect.left;
    const newCenterY = e.clientY - rect.top;
    setClampedTranslateScale(
      translateX + newCenterX - centerX,
      translateY + newCenterY - centerY,
      scaleStart * e.scale,
      newCenterX,
      newCenterY,
    );
    transformCallback();
  }
  function onGestureEnd(e: GestureEvent) {
    e.preventDefault();
    gesturing = false;
    removeGestureChangeListeners();
  }
  window.addEventListener(
    GestureStartEventName,
    onGestureStart as EventListenerOrEventListenerObject,
  );

  function getViewportWidth() {
    return document.documentElement.clientWidth;
  }

  function getViewportHeight() {
    return document.documentElement.clientHeight;
  }

  function relayout() {
    const newViewportWidth = getViewportWidth();
    const newViewportHeight = getViewportHeight();
    if (!viewportWidth || !viewportHeight) {
      const scale = Math.min(
        Math.min(maxWidth, newViewportWidth) / canvasWidth,
        Math.min(maxHeight, newViewportHeight) / canvasHeight,
      );
      const effectiveWidth = canvasWidth * scale;
      const effectiveHeight = canvasHeight * scale;
      transform.translateX = (newViewportWidth - effectiveWidth) / 2;
      transform.translateY = (newViewportHeight - effectiveHeight) / 2;
      transform.scale = scale;
      transformCallback();
    } else if (
      viewportWidth !== newViewportWidth ||
      viewportHeight !== newViewportHeight
    ) {
      // Keep center centered when resizing window (e.g. orientation change)
      transform.translateX =
        transform.translateX - viewportWidth / 2 + newViewportWidth / 2;
      transform.translateY =
        transform.translateY - viewportHeight / 2 + newViewportHeight / 2;
      transformCallback();
    }

    viewportWidth = newViewportWidth;
    viewportHeight = newViewportHeight;
  }

  window.addEventListener(ResizeEventName, relayout);
  relayout();

  function removeGestureChangeListeners() {
    window.removeEventListener(
      GestureChangeEventName,
      onGestureChange as EventListenerOrEventListenerObject,
    );
    window.removeEventListener(
      GestureEndEventName,
      onGestureEnd as EventListenerOrEventListenerObject,
    );
  }

  function removePointerMoveListeners() {
    document.removeEventListener(PointerUpEventName, onPointerEvent);
    document.removeEventListener(PointerMoveEventName, onPointerEvent);
    document.removeEventListener(PointerCancelEventName, onPointerEvent);
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === KeySpace) {
      spacebar = true;
      document.body.classList.add(styles.DrawletPanning);
    }
  }
  function onKeyUp(event: KeyboardEvent) {
    if (event.key === KeySpace) {
      spacebar = false;
      document.body.classList.remove(styles.DrawletPanning);
    }
  }
  document.addEventListener(KeyDownEventName, onKeyDown);
  document.addEventListener(KeyUpEventName, onKeyUp);

  return {
    setScale(scale: number) {
      setClampedTranslateScale(
        transform.translateX,
        transform.translateY,
        scale,
      );
    },
    unsubscribe() {
      domElement.removeEventListener(PointerDownEventName, onPointerEvent);
      domElement.removeEventListener(WheelEventName, onWheelEvent);
      document.removeEventListener(KeyDownEventName, onKeyDown);
      document.removeEventListener(KeyUpEventName, onKeyUp);
      removePointerMoveListeners();
      window.removeEventListener(
        GestureStartEventName,
        onGestureStart as EventListenerOrEventListenerObject,
      );
      removeGestureChangeListeners();
      window.removeEventListener(ResizeEventName, relayout);
    },
  };
}
