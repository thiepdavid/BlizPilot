const MAX_TEXT_FIELD_LENGTH = 12_000;
const forbiddenControlChars = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/** Normalize untrusted JSON text before storage. Output is still rendered as escaped React text. */
export function sanitizeSubmittedValues(value: unknown, depth = 0): unknown {
  if (depth > 32) throw new Error('Request data is nested too deeply.');
  if (typeof value === 'string') {
    const sanitized = value.normalize('NFC').replace(forbiddenControlChars, '');
    if (sanitized.length > MAX_TEXT_FIELD_LENGTH) throw new Error('A text field is too long.');
    return sanitized;
  }
  if (Array.isArray(value)) return value.map(item => sanitizeSubmittedValues(item, depth + 1));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, sanitizeSubmittedValues(child, depth + 1)]));
  }
  return value;
}
