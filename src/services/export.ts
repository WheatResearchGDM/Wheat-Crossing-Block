import { requireOptionalNativeModule } from 'expo';
import { Directory, File, Paths } from 'expo-file-system';
import { exportFilename, toCsv } from '../core/model';
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
    throw new Error(`O arquivo deve se chamar ${filename}. Para atualizar um CSV que já existe, use “Escolher CSV existente”.`);
  return target ? { ...target, filename: target.kind === 'file' ? filename : undefined } : null;
}
export async function exportCsv(profile: Profile, records: Evaluation[], target: OutputTarget): Promise<void> {
  const selected = records.filter(r => r.user_id === profile.userId && r.device_id === profile.deviceId);
  if (!selected.length) throw new Error('Este usuário ainda não tem coletas para exportar.');
  const csv = toCsv(selected); const filename = exportFilename(profile);
  // A complete internal snapshot exists before an external provider is contacted.
  const directory = new Directory(Paths.document, 'exportacoes');
  directory.create({ idempotent: true, intermediates: true });
  new File(directory, filename).write(csv);
  await documents().writeCsvAsync(target.kind, target.uri, filename, csv);
}
