import { snapshotForDevice } from './model';
import type { Evaluation, Profile } from './model';

export async function exportDevice(
  source: { all(): Promise<Evaluation[]>; completeExport(records: Evaluation[]): Promise<void> },
  profile: Profile,
  write: (records: Evaluation[]) => Promise<void>,
): Promise<Evaluation[]> {
  const { records } = snapshotForDevice(profile, await source.all());
  if (!records.length) throw new Error('Este aparelho ainda não tem coletas para exportar.');
  // Reset only after the writer confirms the complete file; failed/canceled writes keep drafts.
  await write(records);
  await source.completeExport(records);
  return records;
}
