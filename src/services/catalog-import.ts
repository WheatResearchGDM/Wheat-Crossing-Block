import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { parseCatalog } from '../core/catalog';
import type { CatalogImport } from '../core/catalog';

export async function selectCatalog(defaultCycle: string): Promise<(CatalogImport & { filename: string }) | null> {
  const selection = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false });
  if (selection.canceled) return null;
  const asset = selection.assets[0];
  const file = new File(asset.uri);
  try {
    if ((asset.size ?? file.size) > 5 * 1024 * 1024) throw new Error('Use um arquivo com até 5 MB.');
    return { ...parseCatalog(await file.bytes(), asset.name, defaultCycle), filename: asset.name };
  } finally {
    if (file.exists) file.delete(); // only the picker-created cache copy, never the user's source
  }
}
