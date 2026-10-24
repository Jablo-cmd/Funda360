// Payment return links (audit 2026-10-23, S-8). create_payment_intent()
// stores whatever return/cancel URL the caller sent, and the provider sends
// the payer there after paying, so an unchecked value is an open redirect.
// Only the app's own origins are accepted; anything else falls back to the
// app's payment-return page. The intent id is added as a query parameter
// with the URL API, so a URL that already has a query string stays valid.

export const DEFAULT_APP_ORIGIN = 'https://app.funda360.aurisnexus.co.za';
export const PAYMENT_RETURN_PATH = '/parent/payment-return';

/** Origins from a comma-separated env value, falling back to the production app. */
export function allowedOrigins(env: string | undefined): string[] {
  const parsed = (env ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => {
      try {
        return new URL(value).origin;
      } catch {
        return null;
      }
    })
    .filter((value): value is string => value !== null);
  return parsed.length > 0 ? parsed : [DEFAULT_APP_ORIGIN];
}

export function safeReturnUrl(
  stored: string | null | undefined,
  intentId: string,
  origins: string[],
): string {
  let url: URL | null = null;
  try {
    url = stored ? new URL(stored) : null;
  } catch {
    url = null;
  }
  if (!url || !origins.includes(url.origin)) url = new URL(PAYMENT_RETURN_PATH, origins[0]);
  url.searchParams.set('intent', intentId);
  return url.toString();
}
