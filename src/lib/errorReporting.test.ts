import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  isChunkLoadError,
  reportError,
  resetErrorReportingForTests,
  toErrorReport,
} from '@/lib/errorReporting';

describe('isChunkLoadError', () => {
  it('recognises stale-chunk failures from every major browser', () => {
    expect(
      isChunkLoadError(
        new TypeError('Failed to fetch dynamically imported module: https://x/assets/Page-abc.js'),
      ),
    ).toBe(true);
    expect(isChunkLoadError(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(isChunkLoadError(new Error('error loading dynamically imported module'))).toBe(true);
  });
  it('does not treat ordinary errors as chunk failures', () => {
    expect(isChunkLoadError(new Error("Cannot read properties of undefined (reading 'id')"))).toBe(
      false,
    );
  });
});

describe('toErrorReport', () => {
  it('drops the query string and hash, which can carry tokens', () => {
    const report = toErrorReport(
      new Error('boom'),
      'render',
      '/reset-password?token=secret#access_token=x',
      new Date('2026-09-30T00:00:00Z'),
    );
    expect(report.path).toBe('/reset-password');
    expect(report.message).toBe('boom');
    expect(report.occurredAt).toBe('2026-09-30T00:00:00.000Z');
  });
  it('accepts non-Error values', () => {
    expect(toErrorReport('plain string', 'x', '/').message).toBe('plain string');
  });
});

describe('reportError', () => {
  beforeEach(() => {
    resetErrorReportingForTests();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  it('de-duplicates identical errors', () => {
    expect(reportError(new Error('same'), 'render')).not.toBeNull();
    expect(reportError(new Error('same'), 'render')).toBeNull();
  });
  it('caps reports per page load', () => {
    const results = Array.from({ length: 30 }, (_, i) => reportError(new Error(`e${i}`), 'loop'));
    expect(results.filter(Boolean)).toHaveLength(20);
  });
});
