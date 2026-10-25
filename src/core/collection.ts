import { today } from './model';
import type { Draft, Evaluation, Profile, Purpose } from './model';

export type DateSuggestions = Record<Purpose, string[]>;
export const defaultDates = (): DateSuggestions => ({ EMASC: [today(), '', ''], POLI: [today(), '', ''] });
export function createSheet(profile: Profile, bucket: string, records: Evaluation[], dates: DateSuggestions, uuid: () => string): Draft[] {
  const sheet: Draft[] = [];
  for (const purpose of ['EMASC', 'POLI'] as const) {
    const saved = records.filter(r => r.user_id === profile.userId && r.block === profile.block && r.cycle === profile.cycle && r.bucket === bucket && r.purpose === purpose)
      .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3).sort((a, b) => a.date.localeCompare(b.date));
    const selectedDates = saved.length ? [...saved.map(r => r.date), ...Array(3 - saved.length).fill('')] : dates[purpose];
    for (let i = 0; i < 3; i++) {
      const record = saved.find(r => r.date === selectedDates[i]);
      sheet.push({ rowId: uuid(), purpose, date: selectedDates[i] ?? '', quantity: String(record?.quantity ?? 0), observation: record?.observation ?? '' });
    }
  }
  return sheet;
}
export function sheetDates(sheet: Draft[]): DateSuggestions {
  return { EMASC: sheet.filter(r => r.purpose === 'EMASC').map(r => r.date), POLI: sheet.filter(r => r.purpose === 'POLI').map(r => r.date) };
}
export function collectionRows(sheet: Draft[]): Draft[] {
  return sheet.filter(r => r.date || r.observation.trim() || (r.quantity.trim() !== '' && Number(r.quantity) !== 0));
}
export function changeSheetDate(sheet: Draft[], id: string, date: string, records: Evaluation[], profile: Profile, bucket: string): Draft[] {
  const row = sheet.find(r => r.rowId === id); if (!row) return sheet;
  if (row.date === date) return sheet;
  if (sheet.some(r => r.rowId !== id && r.purpose === row.purpose && r.date === date))
    throw new Error('Esta data já está em outra linha da mesma finalidade.');
  const saved = records.find(r => r.user_id === profile.userId && r.cycle === profile.cycle && r.block === profile.block && r.bucket === bucket && r.purpose === row.purpose && r.date === date);
  return sheet.map(r => r.rowId === id ? { ...r, date,
    quantity: saved ? String(saved.quantity) : row.date ? '0' : row.quantity,
    observation: saved?.observation ?? (row.date ? '' : row.observation) } : r);
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
