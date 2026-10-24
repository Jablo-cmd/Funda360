import { describe, expect, it } from 'vitest';
import { parseSentryDsn, toSentryEnvelope } from '@/lib/sentry';

const DSN = 'https://abc123@o42.ingest.de.sentry.io/4507';

describe('parseSentryDsn', () => {
  it('builds the envelope endpoint from a DSN', () => {
    expect(parseSentryDsn(DSN)).toEqual({
      envelopeUrl: 'https://o42.ingest.de.sentry.io/api/4507/envelope/?sentry_key=abc123&sentry_version=7&sentry_client=funda360%2F1',
      origin: 'https://o42.ingest.de.sentry.io',
      dsn: DSN,
    });
  });

  it('rejects anything that is not an https DSN with a key and numeric project', () => {
    expect(parseSentryDsn(undefined)).toBeNull();
    expect(parseSentryDsn('http://abc@o42.ingest.sentry.io/1')).toBeNull();
    expect(parseSentryDsn('https://o42.ingest.sentry.io/1')).toBeNull();
    expect(parseSentryDsn('https://abc@o42.ingest.sentry.io/project')).toBeNull();
    expect(parseSentryDsn('not a dsn')).toBeNull();
  });
});

describe('toSentryEnvelope', () => {
  it('sends the report as one event and nothing else', () => {
    const target = parseSentryDsn(DSN)!;
    const envelope = toSentryEnvelope(
      {
        message: "TypeError: Cannot read properties of undefined (reading 'id')",
        stack: 'TypeError: ...\n    at Page (app.js:1:1)',
        path: '/learners/abc',
        context: 'render',
        release: 'f225bd6',
        occurredAt: '2026-10-24T10:00:00.000Z',
      },
      target,
      'e'.repeat(32),
    );
    const [header, item, event] = envelope.split('\n').map((line) => JSON.parse(line));
    expect(header).toEqual({ event_id: 'e'.repeat(32), sent_at: '2026-10-24T10:00:00.000Z', dsn: DSN });
    expect(item).toEqual({ type: 'event' });
    expect(event.release).toBe('f225bd6');
    expect(event.tags).toEqual({ context: 'render' });
    expect(event.request).toEqual({ url: '/learners/abc' });
    expect(event.exception.values[0].type).toBe('TypeError');
    expect(event).not.toHaveProperty('user');
  });
});
