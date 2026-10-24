export type Purpose = 'EMASC' | 'POLI';
export type Profile = { userId: string; userName: string; deviceId: string; cycle: string; block: string };
export type Evaluation = {
  schema_version: '1'; record_id: string; version: number; cycle: string; block: string;
  bucket: string; date: string; purpose: Purpose; quantity: number; observation: string;
  user_id: string; user_name: string; device_id: string; created_at: string; updated_at: string;
};
export type Draft = { rowId: string; date: string; quantity: string; observation: string; purpose: Purpose };
export const HEADERS = ['schema_version', 'record_id', 'version', 'cycle', 'block', 'bucket', 'date',
  'purpose', 'quantity', 'observation', 'user_id', 'user_name', 'device_id', 'created_at', 'updated_at'] as const;
export const MAX_QUANTITY = 100000;

export function today(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  if (y < 2000 || y > 2100) return false;
  const date = new Date(y, m - 1, d, 12);
  return today(date) === value;
}
export function displayDate(value: string): string { return value.split('-').reverse().join('/'); }
export function logicalKey(row: Pick<Evaluation, 'cycle' | 'block' | 'bucket' | 'date' | 'purpose'>): string {
  return JSON.stringify([row.cycle, row.block, row.bucket, row.date, row.purpose]);
}
export function validateProfile(profile: Profile): void {
  for (const [name, value] of [['Nome', profile.userName], ['Safra/ciclo', profile.cycle], ['Bloco', profile.block]]) {
    if (!value.trim() || value.length > 80) throw new Error(`${name}: informe entre 1 e 80 caracteres.`);
  }
}
export function validateDrafts(profile: Profile, bucket: string, drafts: Draft[], catalog: string[]): Draft[] {
  validateProfile(profile);
  if (!catalog.includes(bucket)) throw new Error('Balde não encontrado no cadastro. Confira o número.');
  const selected = drafts.filter(r => r.quantity.trim() !== '' || r.observation.trim() !== '');
  if (!selected.length) throw new Error('Informe a quantidade de pelo menos uma avaliação. Zero é válido.');
  const keys = new Set<string>();
  for (const row of selected) {
    if (!validDate(row.date)) throw new Error('Data inválida. Use uma data entre 2000 e 2100.');
    if (row.purpose !== 'EMASC' && row.purpose !== 'POLI') throw new Error('Finalidade inválida.');
    if (!/^\d+$/.test(row.quantity.trim()) || Number(row.quantity) > MAX_QUANTITY)
      throw new Error(`Informe uma quantidade inteira de 0 a ${MAX_QUANTITY}.`);
    if (row.observation.length > 500) throw new Error('A observação deve ter até 500 caracteres.');
    const key = `${row.purpose}:${row.date}`;
    if (keys.has(key)) throw new Error('Há duas linhas com a mesma data e finalidade. Corrija antes de salvar.');
    keys.add(key);
  }
  return selected;
}

export function toCsv(records: Evaluation[]): string {
  const quote = (value: unknown) => `"${String(value).replace(/"/g, '""')}"`;
  return '\ufeff' + [HEADERS.join(';'), ...[...records].sort((a, b) => a.record_id.localeCompare(b.record_id))
    .map(row => HEADERS.map(key => quote(row[key])).join(';'))].join('\r\n') + '\r\n';
}
export function exportFilename(profile: Profile): string {
  // IDs persist even when the display name changes. Never share a file between devices.
  return `coletas_${profile.userId}_${profile.deviceId}.csv`;
}
