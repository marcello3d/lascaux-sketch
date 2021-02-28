import { useCallback, useState } from 'react';

export function useForceRender() {
  const [, setCount] = useState(0);
  return useCallback(() => setCount((i) => i + 1), []);
}
