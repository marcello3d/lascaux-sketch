import { MutableRefObject, useEffect } from 'react';

type Options = {
  enabled?: boolean;
  capture?: boolean;
  once?: boolean;
  passive?: boolean;
};

export default function useEventEffect<E extends Event>(
  elementOrRef: MutableRefObject<any> | EventTarget | undefined | null,
  type: string,
  listener: (e: E) => any,
  {
    enabled = true,
    capture = undefined,
    once = undefined,
    passive = undefined,
  }: Options = {},
) {
  useEffect(
    () => {
      if (!elementOrRef || !enabled) {
        return undefined;
      }
      const element =
        'addEventListener' in elementOrRef
          ? elementOrRef
          : elementOrRef.current;
      console.log(`adding ${type} listener to ${element}`);
      element.addEventListener(type, listener as EventListener, {
        capture,
        once,
        passive,
      });

      return () => {
        console.log(`removing ${type} listener from ${element}`);
        element.removeEventListener(type, listener as EventListener, {
          capture,
        });
      };
    },
    [
      enabled ? elementOrRef : null,
      enabled ? type : null,
      enabled ? capture : null,
      enabled ? once : null,
      enabled ? passive : null,
    ],
  );
}
