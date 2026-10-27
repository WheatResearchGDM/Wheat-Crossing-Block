import type { Profile } from './model';

export async function startNewBlock(
  source: { resetBlock(): Promise<Profile> },
  clearInternalFiles: () => Promise<void>,
): Promise<Profile> {
  // A failed file cleanup must not erase the database or forget the current output.
  await clearInternalFiles();
  return source.resetBlock();
}
