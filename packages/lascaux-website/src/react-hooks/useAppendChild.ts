import { MutableRefObject, useLayoutEffect } from 'react';

export function useAppendChild(
  parentRef: MutableRefObject<HTMLElement | null | undefined>,
  element: HTMLElement | null | undefined,
) {
  useLayoutEffect(() => {
    const current = parentRef.current;
    if (current && element) {
      current.appendChild(element);
      return () => {
        current.removeChild(element);
      };
    }
  }, [parentRef, element]);
}
