import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { exportFilename, toCsv } from '../core/model';
import type { Evaluation, Profile } from '../core/model';

export function writeExport(profile: Profile, records: Evaluation[]): File {
  const directory = new Directory(Paths.document, 'exportacoes');
  directory.create({ idempotent: true, intermediates: true });
  const destination = new File(directory, exportFilename(profile));
  // Generate first; replace the last full snapshot only after a successful write.
  const temporary = new File(directory, 'coletas-em-preparacao.tmp');
  temporary.write(toCsv(records));
  if (destination.exists) destination.delete();
  temporary.move(destination);
  return destination;
}
export async function shareExport(file: File): Promise<void> {
  if (!await Sharing.isAvailableAsync()) throw new Error('Compartilhamento indisponível neste aparelho. O CSV foi mantido no aplicativo.');
  await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: 'Salvar CSV de coletas', UTI: 'public.comma-separated-values-text' });
}
