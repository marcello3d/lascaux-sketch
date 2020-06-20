import { Collection, PromiseExtended, Table } from 'dexie';
import { useEffect } from 'react';
import { IDatabaseChange } from 'dexie-observable/api';
import { useForceRender } from '../react-hooks/useForceRender';
import { db } from './db';

type PromiseExtendedOrValue<T> = PromiseExtended<T> | T;

const tableCaches = new Map<string, Map<any, any>>();

type CacheEntry<T> = {
  stale: boolean;
  promise?: PromiseExtended<T>;
  resolved: boolean;
  value?: T;
};

type CollectionCache<T, K> = Map<Collection<T, K>, CacheEntry<T[]>>;

function getCollectionCache<T, K>(table: Table<T, K>): CollectionCache<T, K> {
  let subCache = tableCaches.get(table.name) as CollectionCache<T, K>;
  if (!subCache) {
    subCache = new Map();
    tableCaches.set(table.name, subCache);
  }
  return subCache;
}

const itemCaches = new Map<string, Map<any, any>>();

type ItemCache<T, K> = Map<K, CacheEntry<T | undefined>>;

function getItemCache<T, K>(table: Table<T, K>): ItemCache<T, K> {
  let subCache = itemCaches.get(table.name) as ItemCache<T, K>;
  if (!subCache) {
    subCache = new Map();
    itemCaches.set(table.name, subCache);
  }
  return subCache;
}

// This logic marks entries in the cache as stale based on any database change
db.on('changes').subscribe((changes: IDatabaseChange[]) => {
  const updatedTableCaches = new Set<string>();
  for (const { table, key } of changes) {
    if (!updatedTableCaches.has(table)) {
      updatedTableCaches.add(table);
      const tableCache = tableCaches.get(table);
      if (tableCache) {
        // Mark all table cache entries as stale
        for (const entry of tableCache.values()) {
          entry.stale = true;
        }
      }
    }
    const itemCache = itemCaches.get(table);
    if (itemCache) {
      // Mark all item as stale by key
      const item = itemCache.get(key);
      if (item) {
        item.stale = true;
      }
    }
  }
});

type CacheMap<K, T> = {
  get(key: K): CacheEntry<T> | undefined;
  set(key: K, value: CacheEntry<T>): void;
};

function useCacheEntry<K, T>(
  cache: CacheMap<K, T>,
  key: K,
  compute: (key: K) => PromiseExtended<T>,
): T {
  const forceRender = useForceRender();

  // Whenever the database changes, re-render this component because it might be stale
  // Future optimization: only re-render on applicable changes
  useEffect(() => {
    db.on('changes').subscribe(forceRender);
    return () => {
      db.on('changes').unsubscribe(forceRender);
    };
  }, [forceRender]);

  const entry = cache.get(key) || { stale: true, resolved: false };
  // Do we have stale (or no) data?
  if (entry.stale) {
    entry.promise = compute(key).then((result) => {
      entry.promise = undefined;
      entry.stale = false;
      entry.value = result;
      if (entry.resolved) {
        // We need to re-render because the current data is stale
        forceRender();
      } else {
        entry.resolved = true;
      }
      return result;
    });
    cache.set(key, entry);
  }

  // Return existing value if we've ever resolved
  if (entry.resolved) {
    return entry.value!;
  }

  // Otherwise throw promise
  throw entry.promise;
}

export function useDexieArray<T, K>(
  table: Table<T, K>,
  collection: Collection<T, K>,
): T[] {
  const cache = getCollectionCache(table);
  return useCacheEntry(cache, collection, () => collection.toArray());
}

export function useDexieItem<T, K>(table: Table<T, K>, key: K): T | undefined {
  const cache = getItemCache(table);
  return useCacheEntry(cache, key, () => table.get(key));
}
