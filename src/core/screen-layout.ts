// Geometry of the fixed two-row screen, measured inside the safe area.
export function collectionLayout(width: number, height: number) {
  const horizontal = width >= 700 && width > height;
  const tablet = width >= 600;
  const short = height < 440;
  const compact = height < 720;
  const topButton = short ? 44 : tablet && !compact ? 64 : 48;
  const bucket = short ? 48 : compact ? 56 : 72;
  const header = Math.max(topButton * 3, topButton + bucket + (short ? 36 : 40));
  const priority = header - topButton - bucket;
  const footer = short ? 40 : compact ? 44 : 52;
  const status = short ? 20 : compact ? 22 : 28;
  const gap = short ? 4 : compact ? 6 : 10;
  const groupGap = compact ? 8 : 14;
  const heading = short ? 30 : compact ? 32 : 38;
  const labels = compact ? 20 : 26;
  const groupsHeight = height - header - footer - status - 4;
  const sectionHeight = horizontal ? groupsHeight : (groupsHeight - groupGap) / 2;
  const rowHeight = Math.max(24, Math.floor((sectionHeight - heading - labels - gap * 4 - 1) / 2));
  const font = short ? 16 : tablet ? 20 : 16;
  return { horizontal, compact, header, bucket, priority, footer, status, heading, labels, gap,
    groupGap, rowHeight, font, fieldFont: font, titleFont: short ? 19 : tablet ? 23 : 19,
    topButton, headerIcon: short ? 30 : tablet ? 40 : 32 };
}
