export const ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

export const LIMITS = {
  idMax: 128,
  nameMax: 150,
  shortNameMax: 120,
  addressMax: 300,
  phoneMax: 40,
  emailMax: 160,
  categoryMax: 80,
  imageMax: 500,
  notesMax: 300,
  feedbackMax: 500,
  tableMax: 40,
  orderNumberMax: 32,
  unitMax: 30,
  qtyStrMax: 50,
  dateMax: 32,
  dateTimeStrMax: 64,
  codeMax: 64,
  promoCodeMax: 40,
  roleMax: 60,
  maxAllowedEmails: 20,
  maxAvailability: 50,
  maxOrderItems: 50,
  maxRecipeIngredients: 30,
  maxCashDrops: 100,
} as const;

export function sanitizeId(raw: string, prefix = 'doc'): string {
  const cleaned = String(raw || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .slice(0, LIMITS.idMax);
  return cleaned || `${prefix}-${Date.now()}`;
}

export function clampStr(raw: unknown, maxLen: number): string {
  return String(raw ?? '').trim().slice(0, maxLen);
}

export function clampNum(raw: unknown, min = 0, max = 100_000_000): number {
  const num = Number(raw);
  if (!Number.isFinite(num)) return min;
  return Math.min(max, Math.max(min, num));
}

export function isValidEntityId(id: string): boolean {
  return typeof id === 'string' && id.length >= 1 && id.length <= LIMITS.idMax && ID_PATTERN.test(id);
}

export function normalizeAllowedEmails(emails: string[]): string[] {
  const unique = Array.from(
    new Set(
      emails
        .map((e) => String(e || '').trim().toLowerCase())
        .filter((e) => e.length >= 3 && e.length <= LIMITS.emailMax)
    )
  );
  return unique.slice(0, LIMITS.maxAllowedEmails);
}
