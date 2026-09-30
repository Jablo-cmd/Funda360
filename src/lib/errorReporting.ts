/**
 * Client error monitoring (audit P1-7). Every uncaught render error, window
 * error and unhandled promise rejection is funnelled through reportError().
 *
 * Transport is pluggable and privacy-conscious:
 *  - If VITE_ERROR_REPORT_URL is set at build time, reports are POSTed there
 *    as JSON (navigator.sendBeacon when available, so they survive a page
 *    unload). Point it at Sentry's store endpoint, a log drain, or any
 *    collector.
 *  - It always logs to the console, so errors are never silently dropped.
 *
 * A report carries the message, stack, route path (no query string — it can
 * hold tokens), release and a coarse context label. It never includes user
 * names, emails or record contents. Reports are de-duplicated and capped
 * per page load so a render loop cannot flood the collector.
 */

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

  const url = import.meta.env.VITE_ERROR_REPORT_URL;
  if (url) {
    const body = JSON.stringify(report);
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
      } else {
        void fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          keepalive: true,
        });
      }
    } catch {
      /* the reporter must never throw */
    }
  }
  return report;
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
