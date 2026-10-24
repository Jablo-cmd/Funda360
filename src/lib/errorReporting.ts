/**
 * Client error monitoring (audit P1-7). Every uncaught render error, window
 * error and unhandled promise rejection is funnelled through reportError().
 *
 * Transport is pluggable and privacy-conscious:
 *  - If VITE_SENTRY_DSN is set at build time, each report is sent to that
 *    Sentry project as one event (src/lib/sentry.ts; no SDK, no user data).
 *  - Otherwise, if VITE_ERROR_REPORT_URL is set, reports are POSTed there as
 *    JSON, for a log drain or any other collector.
 *  - Both use navigator.sendBeacon when available, so they survive a page
 *    unload.
 *  - It always logs to the console, so errors are never silently dropped.
 *
 * A report carries the message, stack, route path (no query string — it can
 * hold tokens), release and a coarse context label. It never includes user
 * names, emails or record contents. Reports are de-duplicated and capped
 * per page load so a render loop cannot flood the collector.
 */

import { parseSentryDsn, toSentryEnvelope } from '@/lib/sentry';

export interface ErrorReport {
  message: string;
  stack: string | null;
  path: string;
  context: string;
  release: string;
  occurredAt: string;
}

const MAX_REPORTS_PER_PAGE = 20;
const sent = new Set<string>();
let count = 0;

export function toErrorReport(
  error: unknown,
  context: string,
  path: string,
  now = new Date(),
): ErrorReport {
  const err =
    error instanceof Error
      ? error
      : new Error(typeof error === 'string' ? error : JSON.stringify(error ?? 'Unknown error'));
  return {
    message: err.message.slice(0, 500),
    stack: err.stack ? err.stack.slice(0, 4000) : null,
    path: path.split('?')[0]!.split('#')[0]!,
    context,
    release: String(import.meta.env.VITE_APP_VERSION ?? 'dev'),
    occurredAt: now.toISOString(),
  };
}

/** True for the errors a browser raises when a lazily-loaded route chunk no longer exists (typically after a redeploy). */
export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk [\w-]+ failed|ChunkLoadError/i.test(
    message,
  );
}

/** Exposed for tests. */
export function resetErrorReportingForTests(): void {
  sent.clear();
  count = 0;
}

export function reportError(error: unknown, context: string): ErrorReport | null {
  const path = typeof window === 'undefined' ? '' : window.location.pathname;
  const report = toErrorReport(error, context, path);
  const key = `${report.context}|${report.message}|${report.path}`;
  if (sent.has(key) || count >= MAX_REPORTS_PER_PAGE) return null;
  sent.add(key);
  count += 1;

  console.error(`[funda360:${context}]`, error);

  const sentry = parseSentryDsn(import.meta.env.VITE_SENTRY_DSN);
  if (sentry) {
    // text/plain keeps the request a simple CORS request; Sentry reads the envelope regardless.
    send(sentry.envelopeUrl, toSentryEnvelope(report, sentry), 'text/plain;charset=UTF-8');
  } else if (import.meta.env.VITE_ERROR_REPORT_URL) {
    send(import.meta.env.VITE_ERROR_REPORT_URL, JSON.stringify(report), 'application/json');
  }
  return report;
}

function send(url: string, body: string, type: string): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      navigator.sendBeacon(url, new Blob([body], { type }));
    } else {
      void fetch(url, { method: 'POST', headers: { 'Content-Type': type }, body, keepalive: true });
    }
  } catch {
    /* the reporter must never throw */
  }
}

let installed = false;

export function installGlobalErrorHandlers(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('error', (event) =>
    reportError(event.error ?? event.message, 'window.error'),
  );
  window.addEventListener('unhandledrejection', (event) =>
    reportError(event.reason, 'unhandledrejection'),
  );
}
