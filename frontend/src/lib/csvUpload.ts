const MAX_CSV_BYTES = 5 * 1024 * 1024;
const CSV_TYPES = new Set([
  '',
  'text/csv',
  'application/csv',
  'text/comma-separated-values',
  'application/vnd.ms-excel',
  'text/plain',
  'application/octet-stream',
]);

/** Read a CSV import as bounded UTF-8 text. The selected file is never uploaded or persisted. */
export async function readCsvUpload(file: File): Promise<string> {
  if (!file.name.toLowerCase().endsWith('.csv')) {
    throw new Error('Choose a .csv file. Other file types are not accepted.');
  }
  if (file.size === 0) throw new Error('That CSV file is empty.');
  if (file.size > MAX_CSV_BYTES) throw new Error('CSV files must be 5 MB or smaller.');
  const mediaType = file.type.toLowerCase().split(';', 1)[0].trim();
  if (!CSV_TYPES.has(mediaType)) {
    throw new Error('That file does not appear to be a CSV. Save it as CSV and try again.');
  }

  const bytes = await file.arrayBuffer();
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    if (text.includes('\0')) throw new Error('That file is not a valid CSV text file.');
    return text;
  } catch (error) {
    if (error instanceof Error && error.message === 'That file is not a valid CSV text file.') throw error;
    throw new Error('CSV files must use UTF-8 text encoding.');
  }
}

/** Clean invisible control bytes from imported fields before showing the preview. */
export function sanitizeCsvCell(value: string): string {
  return value.normalize('NFC').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
}
