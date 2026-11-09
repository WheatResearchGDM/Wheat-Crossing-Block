import { requireOptionalNativeModule } from 'expo';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { buildOutput, fileFormat, outputFilename, suggestedFilename } from '../core/output';
import type { OutputPreferences } from '../core/output';
import type { Evaluation, OutputTarget, Profile } from '../core/model';

type Documents = {
  chooseAsync(kind: 'folder' | 'create' | 'open', filename: string): Promise<OutputTarget | null>;
  writeFileAsync(kind: string, uri: string, filename: string, base64: string, mime: string): Promise<{ uri: string; name: string }>;
};
function documents(): Documents {
  const module = requireOptionalNativeModule<Documents>('BCDocuments');
  if (!module?.writeFileAsync) throw new Error('Instale o APK atualizado para exportar Excel ou CSV.');
  return module;
}
export async function chooseOutput(preferences: OutputPreferences, kind: 'folder' | 'create' | 'open'): Promise<OutputTarget | null> {
  const target = await documents().chooseAsync(kind, suggestedFilename(preferences));
  if (!target) return null;
  // Existing documents retain their own names and determine the format from their extension.
  const format = target.kind === 'file' ? fileFormat(target.name) : preferences.format;
  return { ...target, filename: target.kind === 'file' ? target.name : undefined, format };
}
async function localSnapshot(profile: Profile, records: Evaluation[], preferences: OutputPreferences, target?: OutputTarget) {
  const snapshot = buildOutput(profile, records, preferences, target);
  const directory = new Directory(Paths.document, 'exportacoes');
  directory.create({ idempotent: true, intermediates: true });
  // A fixed private filename avoids relying on provider-specific display-name/path rules.
  const file = new File(directory, target ? `saida.${preferences.format}` : suggestedFilename(preferences));
  await file.write(snapshot.content, { encoding: snapshot.encoding });
  return { ...snapshot, file };
}
export async function exportOutput(profile: Profile, records: Evaluation[], target: OutputTarget, preferences: OutputPreferences): Promise<string> {
  outputFilename(preferences, target);
  const { file, filename, mime } = await localSnapshot(profile, records, preferences, target);
  try {
    const written = await documents().writeFileAsync(target.kind, target.uri, filename, await file.base64(), mime);
    return written.name;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    if (detail.includes('A gravação não pôde ser confirmada'))
      throw new Error('A gravação no destino não foi confirmada. A coleta continua salva no aparelho. Aguarde e tente novamente ou use Configurações → Enviar cópia dos dados.');
    throw error;
  }
}
export async function shareOutput(profile: Profile, records: Evaluation[], preferences: OutputPreferences): Promise<void> {
  if (!await Sharing.isAvailableAsync()) throw new Error('Compartilhamento indisponível neste aparelho.');
  const { file, mime } = await localSnapshot(profile, records, preferences);
  await Sharing.shareAsync(file.uri, { mimeType: mime, dialogTitle: 'Enviar dados do aparelho',
    UTI: preferences.format === 'xlsx' ? 'org.openxmlformats.spreadsheetml.sheet' : 'public.comma-separated-values-text' });
  // Sharing does not confirm delivery. Never reset the collection here.
}

export async function clearInternalCollectionFiles(): Promise<void> {
  // These are private app paths. Never delete a provider URI or any external input/output folder.
  const exports = new Directory(Paths.document, 'exportacoes');
  if (exports.exists) exports.delete();
  const cache = new Directory(Paths.cache);
  if (cache.exists) for (const entry of cache.list()) entry.delete();
}
