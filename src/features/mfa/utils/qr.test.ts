import { describe, expect, it } from 'vitest';
import { toQrDataUri } from '@/features/mfa/utils/qr';

const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>';

describe('toQrDataUri', () => {
  it('wraps raw SVG markup in one valid data URI', () => {
    const uri = toQrDataUri(svg);
    expect(uri.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true);
    expect(decodeURIComponent(uri.split(',')[1] ?? '')).toBe(svg);
  });
  it('does not wrap a data URI twice', () => {
    const uri = toQrDataUri(`data:image/svg+xml;utf-8,${svg}`);
    expect(decodeURIComponent(uri.split(',')[1] ?? '')).toBe(svg);
    expect(uri.match(/data:/g)).toHaveLength(1);
  });
});
