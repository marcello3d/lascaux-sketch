import { MutableRefObject, useLayoutEffect, useRef } from 'react';

type Options = {
  capture?: boolean;
  once?: boolean;
  passive?: boolean;
};

export default function useEventEffect<E extends Event>(
  elementOrRef: MutableRefObject<any> | EventTarget | undefined | null,
  type: string,
  listener: (e: E) => any,
  { capture = undefined, once = undefined, passive = undefined }: Options = {},
) {
  const listenerRef = useRef(listener as EventListener);
  useLayoutEffect(() => {
    listenerRef.current = listener as EventListener;
  }, [listener]);
  useLayoutEffect(() => {
    if (!elementOrRef) {
      return undefined;
    }
    const element =
      'addEventListener' in elementOrRef ? elementOrRef : elementOrRef.current;
    if (!element) {
      return undefined;
    }
    const l = listenerRef.current;
    element.addEventListener(type, l, { capture, once, passive });

    return () => {
      element.removeEventListener(type, l, { capture });
    };
  }, [elementOrRef, type, capture, once, passive]);
}
