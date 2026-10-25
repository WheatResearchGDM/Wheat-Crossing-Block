import { exportFilename, logicalKey, validateDrafts } from './model';
import type { Draft, Evaluation, Profile } from './model';
import { catalogKey, validateCatalogEntry } from './catalog';
import type { CatalogEntry } from './catalog';
import { collectionRows, createSheet, defaultDates, sheetDates } from './collection';
import type { DateSuggestions } from './collection';

// Small adapter keeps persistence testable against real SQLite outside Android.
export interface Database {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, ...params: (string | number | null)[]): Promise<unknown>;
  getFirstAsync<T>(sql: string, ...params: (string | number | null)[]): Promise<T | null>;
  getAllAsync<T>(sql: string, ...params: (string | number | null)[]): Promise<T[]>;
  withExclusiveTransactionAsync(task: (tx: Database) => Promise<void>): Promise<void>;
}
export const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA synchronous = FULL;
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS evaluations (
  record_id TEXT PRIMARY KEY, natural_key TEXT NOT NULL UNIQUE,
  version INTEGER NOT NULL CHECK(version > 0), payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS revisions (
  record_id TEXT NOT NULL, version INTEGER NOT NULL, payload TEXT NOT NULL,
  PRIMARY KEY(record_id, version)
);
PRAGMA user_version = 1;
`;
type Payload = { payload: string };

export class Store {
  constructor(private db: Database, private uuid: () => string, private clock = () => new Date().toISOString()) {}
  async initialize(): Promise<void> {
    const current = await this.db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    if (current && current.user_version > 1) throw new Error('Este banco requer uma versão mais recente do aplicativo.');
    await this.db.execAsync(SCHEMA);
  }
  async getProfile(): Promise<Profile> {
    const existing = await this.db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', 'profile');
    if (existing) return JSON.parse(existing.value);
    const profile: Profile = { userId: this.uuid(), deviceId: this.uuid(), userName: '', cycle: '', block: '' };
    await this.setProfile(profile);
    return profile;
  }
  async setProfile(profile: Profile): Promise<void> {
    await this.db.runAsync('INSERT OR REPLACE INTO settings(key,value) VALUES (?,?)', 'profile', JSON.stringify(profile));
  }
  async setting<T>(key: string, fallback: T): Promise<T> {
    const row = await this.db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', key);
    return row ? JSON.parse(row.value) : fallback;
  }
  async setSetting(key: string, value: unknown): Promise<void> {
    await this.db.runAsync('INSERT OR REPLACE INTO settings(key,value) VALUES (?,?)', key, JSON.stringify(value));
  }
  async users(): Promise<Pick<Profile, 'userId' | 'userName'>[]> {
    const profile = await this.getProfile();
    const users = await this.setting<Pick<Profile, 'userId' | 'userName'>[]>('users', []);
    if (profile.userName && !users.some(u => u.userId === profile.userId)) users.push({ userId: profile.userId, userName: profile.userName });
    return users;
  }
  async selectUser(name: string): Promise<Profile> {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 80) throw new Error('Informe um nome com até 80 caracteres.');
    const previous = await this.getProfile(); const users = await this.users();
    const found = users.find(u => u.userName.toLocaleLowerCase('pt-BR') === trimmed.toLocaleLowerCase('pt-BR'));
    const next = { ...previous, userName: found?.userName ?? trimmed, userId: found?.userId ?? (previous.userName ? this.uuid() : previous.userId) };
    if (users.some(u => u.userId !== next.userId && exportFilename({ ...next, userName: u.userName }) === exportFilename(next)))
      throw new Error('Este nome produz o mesmo arquivo de outro usuário. Use um nome diferente.');
    if (!found) users.push({ userId: next.userId, userName: next.userName });
    await this.db.withExclusiveTransactionAsync(async tx => {
      await tx.runAsync('INSERT OR REPLACE INTO settings(key,value) VALUES (?,?)', 'users', JSON.stringify(users));
      await tx.runAsync('INSERT OR REPLACE INTO settings(key,value) VALUES (?,?)', 'profile', JSON.stringify(next));
    });
    return next;
  }
  async getCatalog(): Promise<CatalogEntry[]> {
    const row = await this.db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', 'catalog');
    if (!row) return [];
    const parsed = JSON.parse(row.value);
    if (parsed.length && typeof parsed[0] === 'string') {
      const profile = await this.getProfile();
      return parsed.map((bucket: string) => ({ cycle: profile.cycle, block: profile.block, bucket }));
    }
    return parsed;
  }
  async mergeCatalog(entries: CatalogEntry[]): Promise<CatalogEntry[]> {
    for (const entry of entries) validateCatalogEntry(entry);
    const merged = new Map((await this.getCatalog()).map(e => [catalogKey(e), e]));
    for (const entry of entries) merged.set(catalogKey(entry), entry);
    const all = [...merged.values()].sort((a, b) => a.cycle.localeCompare(b.cycle) || a.block.localeCompare(b.block) || Number(a.bucket) - Number(b.bucket));
    await this.db.runAsync('INSERT OR REPLACE INTO settings(key,value) VALUES (?,?)', 'catalog', JSON.stringify(all));
    return all;
  }
  async replaceCatalog(entries: CatalogEntry[], filename: string): Promise<CatalogEntry[]> {
    if (!entries.length) throw new Error('O cadastro está vazio.');
    const previous = await this.getCatalog();
    const normalized = entries.map(e => {
      validateCatalogEntry(e);
      // Reuse the hidden legacy cycle where unambiguous, so old collected buckets reopen.
      const cycles = [...new Set(previous.filter(p => p.block === e.block).map(p => p.cycle))];
      return { ...e, cycle: e.cycle || (cycles.length === 1 ? cycles[0] : '') };
    });
    const next = [...new Map(normalized.map(e => [catalogKey(e), e])).values()].sort((a, b) => a.block.localeCompare(b.block) || Number(a.bucket) - Number(b.bucket));
    await this.db.withExclusiveTransactionAsync(async tx => {
      await tx.runAsync('INSERT OR REPLACE INTO settings(key,value) VALUES (?,?)', 'catalog', JSON.stringify(next));
      await tx.runAsync('INSERT OR REPLACE INTO settings(key,value) VALUES (?,?)', 'catalogSource', JSON.stringify(filename));
    });
    return next;
  }
  async all(): Promise<Evaluation[]> {
    return (await this.db.getAllAsync<Payload>('SELECT payload FROM evaluations')).map(r => JSON.parse(r.payload));
  }
  async save(profile: Profile, bucket: string, drafts: Draft[], catalog: string[]): Promise<number> {
    const selected = validateDrafts(profile, bucket, drafts, catalog);
    let changed = 0;
    await this.db.withExclusiveTransactionAsync(async tx => { changed = await this.saveRows(tx, profile, bucket, selected); });
    return changed;
  }
  private async saveRows(tx: Database, profile: Profile, bucket: string, selected: Draft[]): Promise<number> {
    let changed = 0;
      for (const draft of selected) {
        const base = { cycle: profile.cycle, block: profile.block, bucket, date: draft.date, purpose: draft.purpose };
        const key = JSON.stringify([profile.userId, ...JSON.parse(logicalKey(base))]);
        const existing = await tx.getFirstAsync<Payload>('SELECT payload FROM evaluations WHERE natural_key = ?', key);
        const previous: Evaluation | null = existing ? JSON.parse(existing.payload) : null;
        const quantity = Number(draft.quantity.trim());
        const observation = draft.observation.trim();
        if (previous && previous.quantity === quantity && previous.observation === observation) continue;
        const now = this.clock();
        const record: Evaluation = { ...base, schema_version: '1', record_id: previous?.record_id ?? this.uuid(),
          version: (previous?.version ?? 0) + 1, quantity, observation, user_id: profile.userId,
          user_name: profile.userName, device_id: profile.deviceId, created_at: previous?.created_at ?? now, updated_at: now };
        const payload = JSON.stringify(record);
        await tx.runAsync('INSERT INTO evaluations(record_id,natural_key,version,payload) VALUES (?,?,?,?) ON CONFLICT(natural_key) DO UPDATE SET version=excluded.version,payload=excluded.payload', record.record_id, key, record.version, payload);
        await tx.runAsync('INSERT INTO revisions(record_id,version,payload) VALUES (?,?,?)', record.record_id, record.version, payload);
        changed++;
      }
    return changed;
  }
  private sheetKey(profile: Profile, bucket: string): string { return 'sheet:' + JSON.stringify([profile.userId, profile.cycle, profile.block, bucket]); }
  async loadSheet(profile: Profile, bucket: string): Promise<Draft[]> {
    const existing = await this.setting<Draft[] | null>(this.sheetKey(profile, bucket), null);
    if (existing) return existing;
    const dates = await this.setting<DateSuggestions>('dates:' + profile.userId, defaultDates());
    return createSheet(profile, bucket, await this.all(), dates, this.uuid);
  }
  async saveSheet(profile: Profile, bucket: string, drafts: Draft[], catalog: string[]): Promise<string | null> {
    const rows = collectionRows(drafts);
    let error: string | null = null;
    try {
      if (rows.some(r => !r.quantity.trim())) throw new Error('Preencha a quantidade. Use 0 para nenhuma espiga.');
      if (rows.length) validateDrafts(profile, bucket, rows, catalog);
    }
    catch (e) { error = e instanceof Error ? e.message : String(e); }
    await this.db.withExclusiveTransactionAsync(async tx => {
      // Persist raw text even while a numeric field is empty or invalid. Recover it on restart.
      await tx.runAsync('INSERT OR REPLACE INTO settings(key,value) VALUES (?,?)', this.sheetKey(profile, bucket), JSON.stringify(drafts));
      await tx.runAsync('INSERT OR REPLACE INTO settings(key,value) VALUES (?,?)', 'activeBucket', JSON.stringify(bucket));
      if (!error) {
        await tx.runAsync('INSERT OR REPLACE INTO settings(key,value) VALUES (?,?)', 'dates:' + profile.userId, JSON.stringify(sheetDates(drafts)));
        if (rows.length) await this.saveRows(tx, profile, bucket, rows);
      }
    });
    return error;
  }
  async markExport(records: Evaluation[]): Promise<void> {
    // Records saved while a share sheet is open must not be marked as exported.
    const versions = Object.fromEntries(records.map(r => [r.record_id, r.version]));
    await this.db.runAsync('INSERT OR REPLACE INTO settings(key,value) VALUES (?,?)', 'export', JSON.stringify({ at: this.clock(), versions }));
  }
  async exportState(records: Evaluation[]): Promise<{ at: string | null; pending: number }> {
    const state = await this.db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', 'export');
    const parsed = state ? JSON.parse(state.value) : { at: null, versions: {} };
    return { at: parsed.at, pending: records.filter(r => parsed.versions[r.record_id] !== r.version).length };
  }
}
