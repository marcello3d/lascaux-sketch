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
};

type Pointer = {
  clientX: number;
  clientY: number;
};

const PointerDownEvent = 'pointerdown';
const PointerMoveEvent = 'pointermove';
const PointerUpEvent = 'pointerup';
const PointerCancelEvent = 'pointercancel';

const POINTER_EVENT_TYPE_MAP: Record<string, DrawletDrawEventType> = {
  [PointerDownEvent]: DRAW_START_EVENT,
  [PointerMoveEvent]: DRAW_EVENT,
  [PointerUpEvent]: DRAW_END_EVENT,
  [PointerCancelEvent]: DRAW_END_EVENT,
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
) {
  const currentPointers: Record<string, Pointer> = {};
  let touchCount = 0;
  const deviceScale = 1 / (window.devicePixelRatio || 1);

  let viewportWidth = 0;
  let viewportHeight = 0;

  function onPointerEvent(event: PointerEvent) {
    const { type, pointerId, clientX, clientY } = event;
    if (type === PointerDownEvent) {
      touchCount++;
      if (touchCount === 1) {
        eventCallback(toCursorEvent(event), false);
      }
    } else if (!(pointerId in currentPointers)) {
      return;
    }
    if (type === PointerUpEvent || type === PointerCancelEvent) {
      touchCount--;
      delete currentPointers[pointerId];
    } else {
      currentPointers[pointerId] = {
        clientX,
        clientY,
      };
    }
    if (transform.touchStart) {
      if (touchCount === 2) {
        pinchZoomUpdate(getCurrentPointers());
      }
    } else if (touchCount === 1) {
      sendDrawEvents(event);
    } else if (touchCount === 2) {
      pinchZoomStart(getCurrentPointers());
    }
    if (touchCount === 0 && transform.touchStart) {
      pinchZoomEnd();
    }
  }

  domElement.addEventListener(PointerDownEvent, onPointerEvent);
  document.addEventListener(PointerUpEvent, onPointerEvent);
  document.addEventListener(PointerMoveEvent, onPointerEvent);
  document.addEventListener(PointerCancelEvent, onPointerEvent);

  function getCurrentPointers(): Pointer[] {
    return Object.values(currentPointers);
  }

  function sendDrawEvents(event: PointerEvent): void {
    const { translateX, translateY, scale } = transform;
    const { left, top } = (event.target as HTMLElement).getBoundingClientRect();;
    const dx = -translateX - left;
    const dy = -translateY - top;
    const toEvent = ({
      type,
      clientX,
      clientY,
      timeStamp,
      pressure,
      tiltX,
      tiltY,
    }: PointerEvent): DrawletDrawEvent => [
      POINTER_EVENT_TYPE_MAP[type],
      timeStamp,
      {
        x: (clientX + dx) / scale,
        y: (clientY + dy) / scale,
        pressure,
        tiltX,
        tiltY,
      },
    ];
    if (event.getCoalescedEvents) {
      const events = event.getCoalescedEvents();
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
    return x1 + (x2 - x1) / 2;
  }

  function getCenterY(pointers: Pointer[]) {
    const y1 = pointers[0].clientY;
    const y2 = pointers[1].clientY;
    return y1 + (y2 - y1) / 2;
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

    const scale = clampScale(
      scaleStart * (distStart > 0 ? getDist(pointers) / distStart : 1),
    );
    const newCenterX = getCenterX(pointers);
    const newCenterY = getCenterY(pointers);
    const newTranslateX = translateX + newCenterX - centerX;
    const newTranslateY = translateY + newCenterY - centerY;

    // The canvas should be able to move such that:
    //  - it's always visible on the screen
    //  - the minimum position is no less than -(width of the canvas - viewportWidth)
    //  - the maximum position is no greater than the viewportWidth - width of canvas or zero

    setTranslateScale(
      clampRange(newTranslateX, getViewportWidth(), canvasWidth, 0.75, scale),
      clampRange(newTranslateY, getViewportHeight(), canvasHeight, 0.75, scale),
      newCenterX,
      newCenterY,
      scale,
    );
  }

  function clampScale(scale: number) {
    const min = Math.min(
      Math.min(maxWidth, viewportWidth) / canvasWidth,
      Math.min(maxHeight, viewportHeight) / canvasHeight,
      deviceScale,
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

  window.onresize = relayout;
  relayout();

  return () => {
    domElement.removeEventListener(PointerDownEvent, onPointerEvent);
    document.removeEventListener(PointerUpEvent, onPointerEvent);
    document.removeEventListener(PointerMoveEvent, onPointerEvent);
    document.removeEventListener(PointerCancelEvent, onPointerEvent);
  }
}
