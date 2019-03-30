import localForage from 'localforage';
import usePromise from 'react-use-promise';
import { useCallback } from 'react';

export default function useLocalForage<T>(
  name: string,
): [T | undefined, Error | undefined, (value: T) => Promise<T>] {
  const [result, error] = usePromise<T>(() => localForage.getItem<T>(name), [
    name,
  ]);
  const setItem = useCallback((value: T) => localForage.setItem(name, value), [
    name,
  ]);
  return [result, error, setItem];
}
