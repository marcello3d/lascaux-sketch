import mousetrap from 'mousetrap';
import { useEffect, useRef } from 'react';

type CallbackFn = (e: KeyboardEvent, combo: string) => any;

const currentBindings: Record<string, CallbackFn> = {};

// Mousetrap skips shortcuts while an <input> has focus, checkboxes and
// buttons included, so after a click on the Erase checkbox B and E did
// nothing. Only inputs that take typing should hold shortcuts back.
const NON_TEXT_INPUTS = [
  'checkbox',
  'radio',
  'button',
  'submit',
  'reset',
  'range',
  'color',
];
// (The document's instance looks it up on the prototype; the static
// `mousetrap.stopCallback` is only a forwarder to it.)
const mousetrapPrototype = (mousetrap as any).prototype as {
  stopCallback: (e: KeyboardEvent, element: Element, combo: string) => boolean;
};
const defaultStopCallback = mousetrapPrototype.stopCallback;
mousetrapPrototype.stopCallback = function (this: unknown, e, element, combo) {
  if (
    element instanceof HTMLInputElement &&
    NON_TEXT_INPUTS.includes(element.type)
  ) {
    return false;
  }
  return defaultStopCallback.call(this, e, element, combo);
};

export function useMousetrap(shortcut: string, callback: CallbackFn) {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (currentBindings[shortcut]) {
      console.warn(`${shortcut} is already bound`);
      return;
    }
    mousetrap.bind(shortcut, callbackRef.current);
    currentBindings[shortcut] = callbackRef.current;
    return () => {
      delete currentBindings[shortcut];
      mousetrap.unbind(shortcut);
    };
  });
}
