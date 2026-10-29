import { snapshotForDevice } from './model';
import type { Evaluation, Profile } from './model';

export async function exportDevice(
  source: { all(): Promise<Evaluation[]>; completeExport(records: Evaluation[]): Promise<void>; exportState(records: Evaluation[]): Promise<{ newRecords: number }> },
  profile: Profile,
  write: (records: Evaluation[]) => Promise<void>,
): Promise<{ total: number; newRecords: number }> {
  const deviceRecords = (await source.all()).filter(row => row.device_id === profile.deviceId);
  const { records } = snapshotForDevice(profile, deviceRecords);
  if (!records.length) throw new Error('Não há registros com pelo menos uma espiga para exportar.');
  const { newRecords } = await source.exportState(records);
  // Reset only after the writer confirms the complete file; failed/canceled writes keep drafts.
  await write(records);
  // Keep zero-quantity revisions in the acknowledgment for concurrency checks and round reset.
  // Only positive quantities are written to the CSV or counted in its summary.
  await source.completeExport(deviceRecords);
  return { total: records.length, newRecords };
}
