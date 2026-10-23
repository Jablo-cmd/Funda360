import { describe, expect, it } from 'vitest';
import { qrCodeToDataUri } from './qrCode';

const SVG =
  '<svg xmlns="http://www.w3.org/2000/svg"><rect fill="#000000" width="1" height="1"/></svg>';

describe('qrCodeToDataUri', () => {
  it('encodes the SVG once when supabase-js has already prefixed it', () => {
    const uri = qrCodeToDataUri(`data:image/svg+xml;utf-8,${SVG}`);
    expect(uri).toBe(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(SVG)}`);
    expect(decodeURIComponent(uri.slice(uri.indexOf(',') + 1))).toBe(SVG);
  });

  it('accepts a bare SVG', () => {
    expect(qrCodeToDataUri(SVG)).toBe(
      `data:image/svg+xml;charset=utf-8,${encodeURIComponent(SVG)}`,
    );
  });

  it('leaves no raw "#" that would cut the URI short', () => {
    expect(qrCodeToDataUri(`data:image/svg+xml;utf-8,${SVG}`)).not.toContain('#');
  });
});
