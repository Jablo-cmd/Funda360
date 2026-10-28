/**
 * Supabase returns the QR code either as raw SVG markup or already as a `data:image/svg+xml;utf-8,...` URI,
 * depending on the server version. Wrapping the second form again produced a broken image, and the non-standard
 * `;utf-8` parameter is rejected by some browsers, so both forms are normalised to one valid data URI.
 */
export function toQrDataUri(qr: string): string {
  const svg = qr.startsWith('data:')
    ? decodeURIComponent(qr.slice(qr.indexOf(',') + 1))
    : qr;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
