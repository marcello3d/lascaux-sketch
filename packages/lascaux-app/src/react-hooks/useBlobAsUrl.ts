import { useEffect, useMemo } from 'react';

export function useBlobAsUrl(blob: Blob | undefined) {
  const url = useMemo(() => blob && window.URL.createObjectURL(blob), [blob]);
  useEffect(() => {
    if (url === undefined) {
      return undefined;
    }
    return () => {
      window.URL.revokeObjectURL(url);
    };
  }, [url]);
  return url;
}
