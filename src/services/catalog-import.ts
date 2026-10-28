import { requireOptionalNativeModule } from 'expo';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { Platform } from 'react-native';
import { parseCatalog } from '../core/catalog';
import type { CatalogImport, CatalogSource } from '../core/catalog';

type Imported = CatalogImport & { filename: string; source: CatalogSource | null };
type Documents = {
  chooseAsync(kind: 'catalog', filename: string): Promise<CatalogSource | null>;
  readCatalogAsync(uri: string): Promise<{ name: string; base64: string }>;
};
function documents(): Documents {
  const module = requireOptionalNativeModule<Documents>('BCDocuments');
  if (!module?.readCatalogAsync) throw new Error('Instale o APK atualizado para escolher e atualizar o cadastro.');
  return module;
}
export async function reloadCatalog(source: CatalogSource, defaultCycle = ''): Promise<Imported> {
  if (!source?.uri) throw new Error('Escolha o arquivo do cadastro primeiro.');
  try {
    const result = await documents().readCatalogAsync(source.uri);
    if (result.base64.length > Math.ceil(5 * 1024 * 1024 / 3) * 4) throw new Error('Use um cadastro com até 5 MB.');
    const bytes = Uint8Array.from(atob(result.base64), char => char.charCodeAt(0));
    const filename = result.name || source.name;
    // Parsing and full validation happen before any saved catalog or source is replaced.
    return { ...parseCatalog(bytes, filename, defaultCycle), filename, source: { uri: source.uri, name: filename } };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Não foi possível atualizar o cadastro. O último cadastro e as avaliações foram mantidos. ${detail}`);
  }
}
export async function selectCatalog(defaultCycle = ''): Promise<Imported | null> {
  if (Platform.OS === 'android') {
    const source = await documents().chooseAsync('catalog', '');
    return source ? reloadCatalog(source, defaultCycle) : null;
  }
  const selection = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false });
  if (selection.canceled) return null;
  const asset = selection.assets[0];
  const file = new File(asset.uri);
  try {
    if ((asset.size ?? file.size) > 5 * 1024 * 1024) throw new Error('Use um arquivo com até 5 MB.');
    return { ...parseCatalog(await file.bytes(), asset.name, defaultCycle), filename: asset.name, source: null };
  } finally {
    if (file.exists) file.delete(); // only the picker-created cache copy, never the user's source
  }
}
