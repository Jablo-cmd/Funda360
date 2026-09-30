/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_APP_NAME?: string;
  /** Optional collector endpoint for client error reports (see src/lib/errorReporting.ts). */
  readonly VITE_ERROR_REPORT_URL?: string;
  /** Optional release identifier attached to error reports. */
  readonly VITE_APP_VERSION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
