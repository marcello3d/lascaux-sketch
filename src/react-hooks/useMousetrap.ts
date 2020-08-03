import mousetrap from 'mousetrap';
import { useEffect, useRef } from 'react';

type CallbackFn = (e: ExtendedKeyboardEvent, combo: string) => any;

const currentBindings: Record<string, CallbackFn> = {};

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
