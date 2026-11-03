import * as XLSX from 'xlsx';
import { displayDate, OUTPUT_HEADERS, snapshotForDevice, toCsv } from './model';
import type { Evaluation, OutputTarget, Profile } from './model';

export type OutputFormat = 'xlsx' | 'csv';
export type OutputPreferences = { nickname: string; format: OutputFormat };
export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export function fileFormat(filename: string): OutputFormat {
  if (!filename.trim() || /[\\/\x00-\x1f]/.test(filename)) throw new Error('Nome de arquivo inválido.');
  if (/\.xlsx$/i.test(filename)) return 'xlsx';
  if (/\.csv$/i.test(filename)) return 'csv';
  throw new Error('Escolha um arquivo Excel (.xlsx) ou CSV (.csv).');
}
export function outputPreferences(saved: OutputPreferences | null, target: OutputTarget | null): OutputPreferences {
  // Preserve existing CSV destinations on upgrade. New installations start in Excel.
  return { nickname: saved?.nickname ?? '', format: saved?.format === 'csv' || saved?.format === 'xlsx'
    ? saved.format : target?.kind === 'file' ? fileFormat(target.name) : target ? 'csv' : 'xlsx' };
}
export function validateNickname(value: string): string {
  const name = value.trim();
  if (!name || name.length > 40 || /[\x00-\x1f]/.test(name)) throw new Error('Informe um nome de dispositivo com 1 a 40 caracteres.');
  return name;
}
export function suggestedFilename(preferences: OutputPreferences): string {
  const name = (preferences.nickname.trim() || 'Dispositivo').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'Dispositivo';
  return `REGISTRO_BC_${name}.${preferences.format}`;
}
export function outputFilename(preferences: OutputPreferences, target?: OutputTarget | null): string {
  const filename = target?.kind === 'file' ? target.name : suggestedFilename(preferences);
  if (fileFormat(filename) !== preferences.format) throw new Error('O formato mudou. Escolha um destino compatível antes de exportar.');
  return filename;
}
export function buildOutput(profile: Profile, records: Evaluation[], preferences: OutputPreferences, target?: OutputTarget | null) {
  const nickname = validateNickname(preferences.nickname);
  const selected = snapshotForDevice(profile, records).records;
  if (!selected.length) throw new Error('Não há registros com espigas ou observação para exportar.');
  const filename = outputFilename(preferences, target);
  if (preferences.format === 'csv') return { filename, content: toCsv(selected, nickname), encoding: 'utf8' as const, mime: 'text/csv' };
  const rows = [...selected].sort((a, b) => a.block.localeCompare(b.block) || Number(a.bucket) - Number(b.bucket)
    || a.date.localeCompare(b.date) || a.purpose.localeCompare(b.purpose));
  const data: (string | number)[][] = [[...OUTPUT_HEADERS], ...rows.map(row => [row.block, row.bucket, displayDate(row.date),
    row.purpose === 'EMASC' ? 'Emasculação' : 'Polinização', row.quantity, row.observation,
    row.priority ? 'SIM' : 'NÃO', row.user_name, row.created_at, nickname])];
  // Explicit string cells keep user text literal, including values beginning with '='.
  const sheet = XLSX.utils.aoa_to_sheet(data);
  sheet['!autofilter'] = { ref: sheet['!ref']! };
  sheet['!cols'] = [25, 12, 15, 18, 18, 48, 14, 25, 28, 25].map(wch => ({ wch }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Coletas');
  return { filename, content: XLSX.write(workbook, { bookType: 'xlsx', type: 'base64', compression: true }) as string,
    encoding: 'base64' as const, mime: XLSX_MIME };
}
