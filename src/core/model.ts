export type Purpose = 'EMASC' | 'POLI';
export type Profile = { userId: string; userName: string; deviceId: string; cycle: string; block: string };
export type Evaluation = {
  schema_version: '1'; record_id: string; version: number; cycle: string; block: string;
  bucket: string; date: string; purpose: Purpose; quantity: number; observation: string;
  user_id: string; user_name: string; device_id: string; created_at: string; updated_at: string; round_id?: string; priority?: boolean;
};
export type Draft = { rowId: string; date: string; quantity: string; observation: string; purpose: Purpose; roundId?: string };
export type OutputTarget = { kind: 'folder' | 'file'; uri: string; name: string; filename?: string };
export const OUTPUT_HEADERS = ['Nome do Bloco', 'Balde', 'Data', 'Propósito', 'Disponibilidade', 'Observação', 'Data de criação', 'Device ID', 'Nome do usuário', 'Prioridade'] as const;
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
  for (const [name, value] of [['Nome', profile.userName], ['Bloco', profile.block]]) {
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
    if (!row.date) throw new Error('Escolha a data da linha preenchida.');
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
  // Quoting alone does not stop spreadsheet formula execution in user-entered text.
  const quote = (value: unknown) => {
    let text = String(value);
    if (/^[\s]*[=+\-@]/.test(text)) text = "'" + text;
    return `"${text.replace(/"/g, '""')}"`;
  };
  return '\ufeff' + [OUTPUT_HEADERS.join(';'), ...[...records].sort((a, b) =>
    a.block.localeCompare(b.block) || Number(a.bucket) - Number(b.bucket) || a.date.localeCompare(b.date) || a.purpose.localeCompare(b.purpose))
    .map(row => [row.block, row.bucket, displayDate(row.date), row.purpose === 'EMASC' ? 'Emasculação' : 'Polinização',
      row.quantity, row.observation, row.created_at, row.device_id, row.user_name, row.priority ? 'SIM' : 'NÃO'].map(quote).join(';'))].join('\r\n') + '\r\n';
}
export function exportFilename(profile: Profile): string {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(profile.deviceId)) throw new Error('Identificador do aparelho inválido.');
  return `REGISTRO_BC_${profile.deviceId}.csv`;
}
export function snapshotForDevice(profile: Profile, records: Evaluation[]): { filename: string; records: Evaluation[]; csv: string } {
  const selected = records.filter(r => r.device_id === profile.deviceId);
  return { filename: exportFilename(profile), records: selected, csv: toCsv(selected) };
}
