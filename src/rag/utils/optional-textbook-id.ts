import { Transform } from 'class-transformer';

/** Placeholders clients send when using OpenAPI/Swagger defaults or empty fields. */
const TEXTBOOK_ID_PLACEHOLDERS = new Set([
  'string',
  'uuid',
  'textbookid',
  'null',
  'undefined',
]);

export function normalizeOptionalTextbookId(
  textbookId: string | undefined | null,
): string | undefined {
  if (textbookId == null) {
    return undefined;
  }
  const t = textbookId.trim();
  if (!t) {
    return undefined;
  }
  if (TEXTBOOK_ID_PLACEHOLDERS.has(t.toLowerCase())) {
    return undefined;
  }
  return t;
}

/** Use on optional `textbookId` DTO fields so bad client defaults never hit the DB layer. */
export function TransformOptionalTextbookId() {
  return Transform(({ value }: { value: unknown }) => {
    if (value === undefined || value === null) {
      return undefined;
    }
    return normalizeOptionalTextbookId(String(value));
  });
}
