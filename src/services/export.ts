import { requireOptionalNativeModule } from 'expo';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { exportFilename, snapshotForDevice } from '../core/model';
import type { Evaluation, OutputTarget, Profile } from '../core/model';

type Documents = {
  chooseAsync(kind: 'folder' | 'create' | 'open', filename: string): Promise<OutputTarget | null>;
  writeCsvAsync(kind: string, uri: string, filename: string, content: string): Promise<{ uri: string; name: string }>;
};
function documents(): Documents {
  const module = requireOptionalNativeModule<Documents>('BCDocuments');
  if (!module) throw new Error('Instale o novo APK Android para escolher um destino permanente.');
  return module;
}
export async function chooseOutput(profile: Profile, kind: 'folder' | 'create' | 'open'): Promise<OutputTarget | null> {
  const filename = exportFilename(profile);
  const target = await documents().chooseAsync(kind, filename);
  if (target?.kind === 'file' && target.name !== filename)
    throw new Error(`O arquivo deste aparelho deve se chamar ${filename}. Para atualizar um CSV que já existe, use “Escolher CSV existente”.`);
  return target ? { ...target, filename: target.kind === 'file' ? filename : undefined } : null;
}
function localSnapshot(profile: Profile, records: Evaluation[]): { file: File; csv: string; filename: string } {
  const snapshot = snapshotForDevice(profile, records);
  if (!snapshot.records.length) throw new Error('Este aparelho ainda não tem coletas para exportar.');
  // A complete internal snapshot exists before an external provider is contacted.
  const directory = new Directory(Paths.document, 'exportacoes');
  directory.create({ idempotent: true, intermediates: true });
  const file = new File(directory, snapshot.filename);
  file.write(snapshot.csv);
  return { file, csv: snapshot.csv, filename: snapshot.filename };
}
export async function exportCsv(profile: Profile, records: Evaluation[], target: OutputTarget): Promise<void> {
  const { csv, filename } = localSnapshot(profile, records);
  await documents().writeCsvAsync(target.kind, target.uri, filename, csv);
}
export async function shareCsv(profile: Profile, records: Evaluation[]): Promise<void> {
  if (!await Sharing.isAvailableAsync()) throw new Error('Compartilhamento indisponível neste aparelho.');
  const { file } = localSnapshot(profile, records);
  await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: 'Enviar CSV do aparelho', UTI: 'public.comma-separated-values-text' });
  // Android does not confirm receipt/upload. Never mark exported or reset forms here.
}
