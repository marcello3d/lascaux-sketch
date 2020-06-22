import { useCallback, useState } from 'react';

export function useToggle(
  initial: boolean = false,
): [boolean, () => void, () => void] {
  const [on, set] = useState(initial);
  const enable = useCallback(() => {
    set(true);
  }, []);
  const disable = useCallback(() => {
    set(false);
  }, []);
  return [on, enable, disable];
}
