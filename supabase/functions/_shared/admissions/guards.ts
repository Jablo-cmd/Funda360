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

/**
 * Limits that do not depend on the client's IP (audit 2026-10-23, S-3), so
 * rotating addresses or forged headers cannot get past them.
 * `resume_reference`: guesses at one application reference (date of birth).
 * `resume_email`: guesses against one applicant email.
 * `start_school`: new applications for one school.
 */
export const KEYED_LIMITS: Record<string, { max: number; windowMinutes: number }> = {
  resume_reference: { max: 5, windowMinutes: 60 },
  resume_email: { max: 10, windowMinutes: 60 },
  start_school: { max: 200, windowMinutes: 60 },
};

/** Actions whose limiter fails closed: they create data or test a secret. */
export const FAIL_CLOSED_ACTIONS = new Set(['start', 'resume', 'upload-url', 'register-doc']);

/**
 * The client IP, from the header the platform sets rather than one the
 * client can choose (audit 2026-10-23, S-3). Hosted Supabase sits behind
 * Cloudflare, which overwrites `cf-connecting-ip` with the address that
 * connected to it. Without it, the nearest proxy's view is used: `x-real-ip`,
 * then the LAST `x-forwarded-for` hop (proxies append; the first hop is
 * whatever the client sent). Returns the header used so it can be logged.
 */
export function clientIp(headers: Headers): { ip: string; source: string } {
  const cf = headers.get('cf-connecting-ip')?.trim();
  if (cf) return { ip: cf, source: 'cf-connecting-ip' };
  const real = headers.get('x-real-ip')?.trim();
  if (real) return { ip: real, source: 'x-real-ip' };
  const hops = (headers.get('x-forwarded-for') ?? '').split(',').map((hop) => hop.trim()).filter(Boolean);
  if (hops.length > 0) return { ip: hops[hops.length - 1]!, source: 'x-forwarded-for-last' };
  return { ip: 'unknown', source: 'none' };
}

/**
 * A stable, non-reversible UUID for a value (an IP, an email, a reference),
 * salted with a server secret, so rate_limit_events never stores the raw
 * value (POPIA minimisation).
 */
export async function hashedActorId(value: string, salt: string): Promise<string> {
  const digest = new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${value}`)),
  );
  const hex = Array.from(digest.slice(0, 16), (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${
    hex.slice(20, 32)
  }`;
}

/** Normalises an application reference or email for keyed limits. */
export function limitKey(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
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
