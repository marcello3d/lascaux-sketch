import { MutableRefObject, useLayoutEffect } from 'react';

export function useAppendChild(
  parentRef: MutableRefObject<HTMLElement | null | undefined>,
  element: HTMLElement,
) {
  useLayoutEffect(() => {
    const current = parentRef.current;
    if (current) {
      current.appendChild(element);
      return () => {
        current.removeChild(element);
      };
    }
  }, [parentRef, element]);
}
