import { createHash } from 'node:crypto';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

/** Payment pages the app hands the browser to with a form POST (PayFast, Ozow); see payments-initiate. */
const PAYMENT_FORM_TARGETS = [
  'https://www.payfast.co.za',
  'https://sandbox.payfast.co.za',
  'https://pay.ozow.com',
  'https://stagingpay.ozow.com',
];

function origin(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/** The Sentry ingest origin from a DSN (https://<key>@<host>/<project>). */
function sentryOrigin(dsn: string | undefined): string | null {
  const parsed = origin(dsn);
  return parsed && dsn?.startsWith('https://') ? parsed : null;
}

/**
 * Content-Security-Policy as a <meta> tag (audit 2026-10-23, S-7): GitHub
 * Pages cannot send response headers. Build only: the dev server injects
 * inline scripts for hot reload. Inline scripts in index.html (the theme
 * bootstrap) are allowed by hash, so any other inline or injected script is
 * refused. The session lives in localStorage, so this is the main defence
 * against a script injection reading it.
 */
function contentSecurityPolicy(env: Record<string, string>): Plugin {
  return {
    name: 'funda360-content-security-policy',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        const scriptHashes = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(
          (match) => `'sha256-${createHash('sha256').update(match[1] ?? '').digest('base64')}'`,
        );
        const supabase = origin(env.VITE_SUPABASE_URL);
        const realtime = supabase ? supabase.replace(/^http/, 'ws') : null;
        const errorReports = origin(env.VITE_ERROR_REPORT_URL);
        const sentry = sentryOrigin(env.VITE_SENTRY_DSN);
        const connect = ["'self'", supabase, realtime, errorReports, sentry].filter(Boolean).join(' ');
        const images = ["'self'", 'data:', 'blob:', supabase].filter(Boolean).join(' ');
        const policy = [
          "default-src 'self'",
          `script-src 'self' ${scriptHashes.join(' ')}`.trim(),
          "style-src 'self' 'unsafe-inline'",
          `img-src ${images}`,
          "font-src 'self' data:",
          `connect-src ${connect}`,
          "worker-src 'self' blob:",
          "frame-src 'none'",
          "object-src 'none'",
          "base-uri 'self'",
          `form-action 'self' ${PAYMENT_FORM_TARGETS.join(' ')}`,
        ].join('; ');
        return html.replace(
          '<meta charset="UTF-8" />',
          `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`,
        );
      },
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    // Served at the root of the custom domain funda360.aurisnexus.co.za
    // (GitHub Pages, CNAME in public/), so the default base "/" is correct.
    // `DEPLOY_BASE` is still honoured for a hypothetical future sub-path
    // deploy, but nothing sets it.
    base: process.env.DEPLOY_BASE || '/',
    plugins: [react(), tsconfigPaths(), contentSecurityPolicy(env)],
    server: {
      port: 5173,
    },
  };
});
