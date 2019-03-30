import { MutableRefObject, useLayoutEffect, useRef } from 'react';

export function useAppendChild(
  parentRef: MutableRefObject<HTMLElement | null | undefined>,
  element: HTMLElement,
) {
  useLayoutEffect(() => {
    if (parentRef.current) {
      parentRef.current.appendChild(element);
      return () => {
        if (parentRef.current) {
          parentRef.current.removeChild(element);
        }
      };
    }
  }, [element]);
}
