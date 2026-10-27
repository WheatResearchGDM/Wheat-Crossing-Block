import { snapshotForDevice } from './model';
import type { Evaluation, Profile } from './model';

export async function exportDevice(
  source: { all(): Promise<Evaluation[]>; completeExport(records: Evaluation[]): Promise<void>; exportState(records: Evaluation[]): Promise<{ newRecords: number }> },
  profile: Profile,
  write: (records: Evaluation[]) => Promise<void>,
): Promise<{ total: number; newRecords: number }> {
  const { records } = snapshotForDevice(profile, await source.all());
  if (!records.length) throw new Error('Este aparelho ainda não tem coletas para exportar.');
  const { newRecords } = await source.exportState(records);
  // Reset only after the writer confirms the complete file; failed/canceled writes keep drafts.
  await write(records);
  await source.completeExport(records);
  return { total: records.length, newRecords };
}
