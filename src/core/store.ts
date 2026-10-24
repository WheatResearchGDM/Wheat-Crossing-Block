import { logicalKey, validateDrafts } from './model';
import type { Draft, Evaluation, Profile } from './model';
import { catalogKey, validateCatalogEntry } from './catalog';
import type { CatalogEntry } from './catalog';

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
  async all(): Promise<Evaluation[]> {
    return (await this.db.getAllAsync<Payload>('SELECT payload FROM evaluations')).map(r => JSON.parse(r.payload));
  }
  async save(profile: Profile, bucket: string, drafts: Draft[], catalog: string[]): Promise<number> {
    const selected = validateDrafts(profile, bucket, drafts, catalog);
    let changed = 0;
    await this.db.withExclusiveTransactionAsync(async tx => {
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
    });
    return changed;
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
