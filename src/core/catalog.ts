import * as XLSX from 'xlsx';

export type CatalogEntry = { cycle: string; block: string; bucket: string };
export type CatalogImport = { entries: CatalogEntry[]; duplicates: number; sheetName: string };
const normalized = (text: unknown) => String(text ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[ _-]+/g, ' ');
export const catalogKey = (entry: CatalogEntry) => JSON.stringify([entry.cycle, entry.block, entry.bucket]);
export function validateCatalogEntry(entry: CatalogEntry): void {
  if (entry.cycle.length > 80) throw new Error('Safra/ciclo maior que 80 caracteres.');
  if (!entry.block.trim() || entry.block.length > 80) throw new Error('Bloco ausente ou maior que 80 caracteres.');
  if (!/^\d{1,8}$/.test(entry.bucket)) throw new Error('Balde deve conter apenas números, com até 8 dígitos.');
}
function columns(header: unknown[]): { cycle: number; block: number; bucket: number } {
  const names = header.map(normalized);
  const find = (aliases: string[]) => {
    const matches = names.map((n, i) => aliases.includes(n) ? i : -1).filter(i => i >= 0);
    if (matches.length > 1) throw new Error('Há colunas repetidas para safra, bloco ou balde.');
    return matches[0] ?? -1;
  };
  return { cycle: find(['safra', 'ciclo', 'safra/ciclo', 'cycle']), block: find(['nome do bloco', 'bloco', 'bloco de cruzamento', 'bc', 'block']), bucket: find(['balde', 'numero do balde', 'bucket']) };
}
export function parseCatalog(bytes: Uint8Array, filename: string, defaultCycle = ''): CatalogImport {
  if (!/\.(csv|xlsx|xls)$/i.test(filename)) throw new Error('Selecione um arquivo CSV, XLSX ou XLS.');
  if (bytes.byteLength > 5 * 1024 * 1024) throw new Error('Use um cadastro com até 5 MB.');
  const book = XLSX.read(bytes, { type: 'array', raw: true, codepage: 65001, cellFormula: true, sheetRows: 10002 });
  const candidates: { name: string; rows: string[][]; cols: ReturnType<typeof columns> }[] = [];
  for (const name of book.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<string[]>(book.Sheets[name], { header: 1, raw: false, defval: '', blankrows: true });
    if (!rows.length) continue;
    const cols = columns(rows[0]);
    if (cols.block >= 0 && cols.bucket >= 0) candidates.push({ name, rows, cols });
  }
  const preferred = candidates.find(candidate => normalized(candidate.name) === 'cadastro');
  if (!preferred && candidates.length !== 1) throw new Error('Informe Bloco e Balde na primeira linha de uma aba. Se houver várias abas compatíveis, nomeie a desejada CADASTRO.');
  const selected = preferred ?? candidates[0];
  if (selected.rows.length > 10001) throw new Error('O cadastro pode ter até 10.000 linhas de dados.');
  const entries: CatalogEntry[] = []; const seen = new Set<string>(); let duplicates = 0;
  for (let index = 1; index < selected.rows.length; index++) {
    const row = selected.rows[index];
    if (row.every(cell => !String(cell).trim())) continue;
    const { cols } = selected;
    const entry = { cycle: String(cols.cycle >= 0 ? row[cols.cycle] ?? '' : defaultCycle).trim(),
      block: String(row[cols.block] ?? '').trim(), bucket: String(row[cols.bucket] ?? '').trim() };
    try {
      for (const col of [cols.cycle, cols.block, cols.bucket].filter(c => c >= 0)) {
        if (book.Sheets[selected.name][XLSX.utils.encode_cell({ r: index, c: col })]?.f) throw new Error('Use valores fixos, sem fórmulas, no cadastro.');
      }
      validateCatalogEntry(entry);
    } catch (error) { throw new Error(`Linha ${index + 1}: ${error instanceof Error ? error.message : String(error)}`); }
    const key = catalogKey(entry);
    if (seen.has(key)) { duplicates++; continue; }
    entries.push(entry); seen.add(key);
  }
  if (!entries.length) throw new Error('O arquivo não contém baldes válidos.');
  return { entries, duplicates, sheetName: selected.name };
}
