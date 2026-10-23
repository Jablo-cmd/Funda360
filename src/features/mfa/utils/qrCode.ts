/**
 * supabase-js already prefixes `totp.qr_code` with `data:image/svg+xml;utf-8,`
 * but leaves the SVG unencoded (its `#` colours end the URI early). Strip any
 * data-URI prefix and percent-encode the SVG once. Wrapping the prefixed value
 * again produced a broken image on every phone and browser.
 */
export function qrCodeToDataUri(qrCode: string): string {
  const svg = qrCode.replace(/^data:[^,]*,/, '');
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
