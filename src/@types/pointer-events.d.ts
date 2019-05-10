interface Window {
  PointerEvent: typeof PointerEvent;
  Touch: typeof Touch;
}

interface PointerEvent {
  getCoalescedEvents?(): PointerEvent[];
}
