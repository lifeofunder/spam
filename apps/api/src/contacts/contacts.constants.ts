export const DEFAULT_CSV_IMPORT_MAX_BYTES = 1_048_576; // 1 MiB

export function getCsvImportMaxBytes(): number {
  const raw = process.env.CSV_IMPORT_MAX_BYTES;
  if (!raw) {
    return DEFAULT_CSV_IMPORT_MAX_BYTES;
  }
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_CSV_IMPORT_MAX_BYTES;
}
