import { assertEquals } from 'jsr:@std/assert@1';
import { allowedOrigins, DEFAULT_APP_ORIGIN, safeReturnUrl } from './returnUrl.ts';

const origins = [DEFAULT_APP_ORIGIN];

Deno.test('a return link on the app keeps its path and gains the intent id', () => {
  assertEquals(
    safeReturnUrl(`${DEFAULT_APP_ORIGIN}/parent/payment-return`, 'i-1', origins),
    `${DEFAULT_APP_ORIGIN}/parent/payment-return?intent=i-1`,
  );
  assertEquals(
    safeReturnUrl(`${DEFAULT_APP_ORIGIN}/parent/payment-return?tab=fees`, 'i-1', origins),
    `${DEFAULT_APP_ORIGIN}/parent/payment-return?tab=fees&intent=i-1`,
  );
});

Deno.test('a foreign, malformed or missing return link falls back to the app (S-8)', () => {
  const fallback = `${DEFAULT_APP_ORIGIN}/parent/payment-return?intent=i-1`;
  assertEquals(safeReturnUrl('https://evil.example/phish', 'i-1', origins), fallback);
  assertEquals(safeReturnUrl('javascript:alert(1)', 'i-1', origins), fallback);
  assertEquals(safeReturnUrl('not a url', 'i-1', origins), fallback);
  assertEquals(safeReturnUrl(null, 'i-1', origins), fallback);
});

Deno.test('allowed origins come from the environment, defaulting to the production app', () => {
  assertEquals(allowedOrigins(undefined), [DEFAULT_APP_ORIGIN]);
  assertEquals(allowedOrigins('http://localhost:5173, https://staging.example.test/x'), [
    'http://localhost:5173',
    'https://staging.example.test',
  ]);
});
