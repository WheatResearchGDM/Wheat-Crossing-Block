import type { Draft, Evaluation, Profile, Purpose } from './model';

export type DateSuggestions = Record<Purpose, string[]>;
export const MAX_ROWS = 4;
export const VISIBLE_ROWS = 2;
export function visibleSheet(sheet: Draft[]): Draft[] {
  const counts = { EMASC: 0, POLI: 0 };
  return sheet.filter(row => counts[row.purpose]++ < VISIBLE_ROWS);
}
export type RowCounts = Record<Purpose, number>;
export const defaultRowCounts = (): RowCounts => ({ EMASC: 2, POLI: 2 });
export function normalizeRowCounts(value: Partial<RowCounts>): RowCounts {
  const count = (n: number | undefined) => Number.isInteger(n) ? Math.max(1, Math.min(MAX_ROWS, n!)) : 2;
  return { EMASC: count(value.EMASC), POLI: count(value.POLI) };
}
export function hasRowData(row: Draft): boolean {
  return !!(row.date || row.observation.trim() || (row.quantity.trim() && Number(row.quantity) !== 0));
}
export function expandSheet(sheet: Draft[], uuid: () => string, roundId: string): Draft[] {
  return (['EMASC', 'POLI'] as const).flatMap(purpose => {
    const rows = sheet.filter(r => r.purpose === purpose);
    while (rows.length < MAX_ROWS) rows.push({ rowId: uuid(), purpose, date: '', quantity: '0', observation: '', roundId });
    return rows;
  });
}
export const defaultDates = (): DateSuggestions => ({ EMASC: ['', '', '', ''], POLI: ['', '', '', ''] });
export function createSheet(profile: Profile, bucket: string, records: Evaluation[], dates: DateSuggestions, uuid: () => string, roundId = ''): Draft[] {
  const sheet: Draft[] = [];
  for (const purpose of ['EMASC', 'POLI'] as const) {
    const saved = records.filter(r => r.user_id === profile.userId && r.block === profile.block && r.cycle === profile.cycle && r.bucket === bucket && r.purpose === purpose && (r.round_id ?? '') === roundId)
      .sort((a, b) => b.date.localeCompare(a.date)).slice(0, MAX_ROWS).sort((a, b) => a.date.localeCompare(b.date));
    const selectedDates = saved.length ? [...saved.map(r => r.date), ...Array(MAX_ROWS - saved.length).fill('')] : dates[purpose];
    for (let i = 0; i < MAX_ROWS; i++) {
      const record = saved.find(r => r.date === selectedDates[i]);
      sheet.push({ rowId: uuid(), purpose, date: selectedDates[i] ?? '', quantity: String(record?.quantity ?? 0), observation: record?.observation ?? '', roundId });
    }
  }
  return sheet;
}
export function sheetDates(sheet: Draft[]): DateSuggestions {
  return { EMASC: sheet.filter(r => r.purpose === 'EMASC').map(r => r.date), POLI: sheet.filter(r => r.purpose === 'POLI').map(r => r.date) };
}
export function suggestMissingDates(sheet: Draft[], dates: DateSuggestions): Draft[] {
  const slots: Record<Purpose, number> = { EMASC: 0, POLI: 0 };
  const used = { EMASC: new Set(sheet.filter(r => r.purpose === 'EMASC' && r.date).map(r => r.date)),
    POLI: new Set(sheet.filter(r => r.purpose === 'POLI' && r.date).map(r => r.date)) };
  return sheet.map(row => {
    const date = dates[row.purpose][slots[row.purpose]++];
    if (row.date || !date || used[row.purpose].has(date)) return row;
    used[row.purpose].add(date);
    return { ...row, date };
  });
}
export function collectionRows(sheet: Draft[]): Draft[] {
  return sheet.filter(r => r.date || r.observation.trim() || (r.quantity.trim() !== '' && Number(r.quantity) !== 0));
}
export function changeSheetDate(sheet: Draft[], id: string, date: string, records: Evaluation[], profile: Profile, bucket: string, visibleOnly = false): Draft[] {
  const row = sheet.find(r => r.rowId === id); if (!row) return sheet;
  if (row.date === date) return sheet;
  if ((visibleOnly ? visibleSheet(sheet) : sheet).some(r => r.rowId !== id && r.purpose === row.purpose && r.date === date))
    throw new Error('Esta data já está em outra linha da mesma finalidade.');
  const saved = records.find(r => r.user_id === profile.userId && r.cycle === profile.cycle && r.block === profile.block && r.bucket === bucket && r.purpose === row.purpose && r.date === date && (r.round_id ?? '') === (row.roundId ?? ''));
  return sheet.map(r => r.rowId === id ? { ...r, date,
    quantity: saved ? String(saved.quantity) : row.quantity,
    observation: saved?.observation ?? row.observation } : r);
}

// Every keystroke has its own immutable snapshot. Writes never race across buckets/users.
// Failures remain observable by flush; the next snapshot can recover a transient failure.
export class SaveQueue {
  private tail: Promise<void> = Promise.resolve();
  private failures = new Map<string, unknown>();
  private pending = 0;
  constructor(private onState: (pending: number, error: unknown) => void = () => {}) {}
  enqueue(task: () => Promise<void>, key = 'default'): void {
    this.pending++; this.onState(this.pending, this.failures.values().next().value);
    this.tail = this.tail.then(async () => {
      try { await task(); this.failures.delete(key); }
      catch (error) { this.failures.set(key, error); }
      finally { this.pending--; this.onState(this.pending, this.failures.values().next().value); }
    });
  }
  async flush(): Promise<void> { await this.tail; if (this.failures.size) throw this.failures.values().next().value; }
}
