import type { ErrorReport } from '@/lib/errorReporting';

/**
 * Minimal Sentry transport for client error reports: no SDK, no automatic
 * breadcrumbs, no user data. A report becomes one Sentry event sent as an
 * envelope to the project's ingest endpoint, authenticated by the DSN's
 * public key (public by design; it can only submit events).
 */
export interface SentryTarget {
  envelopeUrl: string;
  origin: string;
  dsn: string;
}

/** Parses https://<publicKey>@<host>/<projectId>; returns null for anything else. */
export function parseSentryDsn(dsn: string | undefined): SentryTarget | null {
  if (!dsn) return null;
  let url: URL;
  try {
    url = new URL(dsn);
  } catch {
    return null;
  }
  const projectId = url.pathname.replace(/^\/+|\/+$/g, '');
  if (url.protocol !== 'https:' || !url.username || !/^\d+$/.test(projectId)) return null;
  const query = new URLSearchParams({ sentry_key: url.username, sentry_version: '7', sentry_client: 'funda360/1' });
  return {
    envelopeUrl: `${url.origin}/api/${projectId}/envelope/?${query.toString()}`,
    origin: url.origin,
    dsn,
  };
}

function eventId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** One envelope (newline-delimited JSON): envelope header, item header, event. */
export function toSentryEnvelope(report: ErrorReport, target: SentryTarget, id = eventId()): string {
  const [type, ...rest] = report.message.split(': ');
  const event = {
    event_id: id,
    timestamp: report.occurredAt,
    platform: 'javascript',
    level: 'error',
    release: report.release,
    environment: report.release === 'dev' ? 'development' : 'production',
    transaction: report.path,
    tags: { context: report.context },
    request: { url: report.path },
    exception: {
      values: [{ type: rest.length > 0 && /^\w+$/.test(type ?? '') ? type : 'Error', value: report.message }],
    },
    extra: { stack: report.stack },
  };
  return [
    JSON.stringify({ event_id: id, sent_at: report.occurredAt, dsn: target.dsn }),
    JSON.stringify({ type: 'event' }),
    JSON.stringify(event),
  ].join('\n');
}
