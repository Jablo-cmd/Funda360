// Notification links (audit 2026-10-23, O-2). In-app notifications store an
// app path such as /parent/fees; an email or SMS needs a full link.

export const DEFAULT_APP_BASE_URL = 'https://app.funda360.aurisnexus.co.za';

/** An app path becomes a full link; an absolute http(s) link is kept; anything else is dropped. */
export function absoluteLink(linkPath: string, base = DEFAULT_APP_BASE_URL): string {
  const root = base.replace(/\/+$/, '');
  if (/^https?:\/\//i.test(linkPath)) return linkPath;
  return linkPath.startsWith('/') && !linkPath.startsWith('//') ? `${root}${linkPath}` : '';
}
