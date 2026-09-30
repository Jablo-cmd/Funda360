// Abuse controls for the unauthenticated admissions endpoint (audit P1-6).
// Pure helpers — the Edge Function wires them to the database.

/** Per-action limits for one client IP within a rolling window. */
export const RATE_LIMITS: Record<string, { max: number; windowMinutes: number }> = {
  config: { max: 300, windowMinutes: 60 },
  start: { max: 10, windowMinutes: 60 },
  save: { max: 240, windowMinutes: 60 },
  submit: { max: 20, windowMinutes: 60 },
  get: { max: 240, windowMinutes: 60 },
  resume: { max: 10, windowMinutes: 15 },
  'upload-url': { max: 40, windowMinutes: 60 },
  'register-doc': { max: 40, windowMinutes: 60 },
};

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const ALLOWED_DOCUMENT_MIME = new Set(['application/pdf', 'image/png', 'image/jpeg']);

/** The client IP as seen by the Supabase edge (first X-Forwarded-For hop). */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]!.trim();
  return headers.get('x-real-ip') ?? headers.get('cf-connecting-ip') ?? 'unknown';
}

/**
 * A stable, non-reversible UUID for an IP, salted with a server secret, so
 * rate_limit_events never stores raw IP addresses (POPIA minimisation).
 */
export async function ipActorId(ip: string, salt: string): Promise<string> {
  const digest = new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${ip}`)),
  );
  const hex = Array.from(digest.slice(0, 16), (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${
    hex.slice(20, 32)
  }`;
}

/** A document may only be registered at a path inside its own application's folder. */
export function isOwnDocumentPath(path: string, schoolId: string, applicationId: string): boolean {
  if (!path || path.includes('..') || path.includes('\\') || path.startsWith('/')) return false;
  const prefix = `${schoolId}/${applicationId}/`;
  return path.startsWith(prefix) && path.length > prefix.length && !path.slice(prefix.length).includes('/');
}

export function isAcceptableDocument(mimeType: unknown, sizeBytes: unknown): boolean {
  const size = Number(sizeBytes);
  return typeof mimeType === 'string' && ALLOWED_DOCUMENT_MIME.has(mimeType.toLowerCase()) &&
    Number.isFinite(size) && size > 0 && size <= MAX_DOCUMENT_BYTES;
}

/** Normalises a YYYY-MM-DD date for comparison; returns null for anything else. */
export function normaliseDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}
