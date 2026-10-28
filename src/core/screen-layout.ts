import type { RowCounts } from './collection';

// Pure geometry: uses the measured safe content area, including split-screen/rotation.
export function collectionLayout(width: number, height: number, rows: RowCounts) {
  const horizontal = width >= 640 && width > height;
  const tablet = width >= 600;
  const compact = height < 720;
  const short = height < 440;
  const top = short ? 44 : tablet && !compact ? 64 : 52;
  const bucket = short ? 44 : compact ? 58 : 76;
  const priority = short ? 28 : compact ? 32 : 40;
  const footer = short ? 36 : compact ? 44 : 52;
  const status = short ? 20 : compact ? 22 : 28;
  const heading = short ? 32 : compact ? 36 : 44;
  const labels = short ? 20 : compact ? 20 : 26;
  const gap = short ? 2 : compact ? 3 : 6;
  const sectionCount = horizontal ? 1 : 2;
  const slots = horizontal ? Math.max(rows.EMASC, rows.POLI) : rows.EMASC + rows.POLI;
  const fixed = top + bucket + priority + footer + status + sectionCount * (heading + labels + gap * 2) + 12;
  const rowHeight = Math.max(24, Math.min(tablet ? 84 : 64, Math.floor((height - fixed) / slots) - gap));
  const font = short ? 16 : tablet ? 20 : 16;
  const fieldFont = rowHeight < 38 ? 13 : font;
  return { horizontal, top, bucket, priority, footer, status, heading, labels, gap, rowHeight,
    font, fieldFont, titleFont: tablet ? 23 : 19, headerIcon: short ? 30 : tablet ? 40 : 32,
    topButton: short ? 44 : tablet && !compact ? 64 : 52, compact };
}
