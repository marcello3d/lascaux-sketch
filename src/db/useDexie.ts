import { Collection, PromiseExtended, Table } from 'dexie';
import { useEffect } from 'react';
import { IDatabaseChange } from 'dexie-observable/api';
import { useForceRender } from './useForceRender';

const tableCaches = new Map<string, WeakMap<any, any>>();

type CollectionCache<T, K> = WeakMap<
  Collection<T, K>,
  PromiseExtended<T[]> | T[]
>;

function getCollectionCache<T, K>(table: Table<T, K>): CollectionCache<T, K> {
  let subCache = tableCaches.get(table.name) as CollectionCache<T, K>;
  if (!subCache) {
    subCache = new WeakMap();
    tableCaches.set(table.name, subCache);
  }
  return subCache;
}

const itemCaches = new Map<string, Map<any, any>>();

type ItemCache<T, K> = Map<K, PromiseExtended<T | undefined> | T | undefined>;

function getItemCache<T, K>(table: Table<T, K>): ItemCache<T, K> {
  let subCache = itemCaches.get(table.name) as ItemCache<T, K>;
  if (!subCache) {
    subCache = new Map();
    itemCaches.set(table.name, subCache);
  }
  return subCache;
}

export function useDexieArray<T, K>(
  table: Table<T, K>,
  collection: Collection<T, K>,
): T[] {
  const cache = getCollectionCache(table);
  let existing = cache.get(collection);
  const forceRender = useForceRender();
  useEffect(() => {
    // @ts-ignore
    const listener = (changes: IDatabaseChange[]) => {
      for (const change of changes) {
        if (change.table === table.name) {
          cache.delete(collection);
          forceRender();
          break;
        }
      }
    };
    // @ts-ignore
    table.db.on('changes').subscribe(listener);
    return () => {
      // @ts-ignore
      table.db.on('changes').unsubscribe(listener);
    };
  }, [table.db, table.name, forceRender, cache, collection]);

  if (existing === undefined) {
    existing = collection.toArray();
    cache.set(collection, existing);
    existing.then((result) => {
      cache.set(collection, result);
    });
    throw existing;
  }
  if (!Array.isArray(existing)) {
    throw existing;
  }
  return existing;
}

export function useDexieItem<T, K>(table: Table<T, K>, key: K): T | undefined {
  const cache = getItemCache(table);
  const forceRender = useForceRender();
  useEffect(() => {
    // @ts-ignore
    const listener = (changes: IDatabaseChange[]) => {
      for (const change of changes) {
        if (change.table === table.name && change.key === key) {
          cache.delete(key);
          forceRender();
          break;
        }
      }
    };
    // @ts-ignore
    table.db.on('changes').subscribe(listener);
    return () => {
      // @ts-ignore
      table.db.on('changes').unsubscribe(listener);
    };
  }, [table.db, table.name, forceRender, cache, key]);

  if (!cache.has(key)) {
    const promise = table.get(key);
    cache.set(key, promise);
    promise.then((result) => {
      cache.set(key, result);
    });
    throw promise;
  }
  let existing = cache.get(key)!;
  if (existing && 'then' in existing) {
    throw existing;
  }
  return existing;
}
