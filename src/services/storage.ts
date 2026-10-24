import * as SQLite from 'expo-sqlite';
import * as Crypto from 'expo-crypto';
import { Store } from '../core/store';
import type { Database } from '../core/store';

let loading: Promise<Store> | undefined;
export function openStore(): Promise<Store> {
  if (!loading) loading = (async () => {
    const database = await SQLite.openDatabaseAsync('acompanhamento-bc.db');
    const store = new Store(database as unknown as Database, () => Crypto.randomUUID());
    await store.initialize();
    return store;
  })().catch(error => { loading = undefined; throw error; });
  return loading;
}
