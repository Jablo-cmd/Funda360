/**
 * Base-path awareness for the deployed app.
 *
 * Vite sets `import.meta.env.BASE_URL` from the build's `base` option:
 * `"/"` for local dev and any root deployment, `"/Funda360/"` for the
 * GitHub Pages project site. React Router is given this as its `basename`
 * (see `src/App.tsx`), so `<Link to="/dashboard">` already resolves
 * correctly. This module is only for the few places that build an
 * **absolute** URL by hand (auth email redirects, payment return URLs) or
 * compare against `window.location.pathname` directly — `origin` alone
 * drops the base segment.
 */

/** The app's base path — `"/"` locally, `"/Funda360/"` on GitHub Pages. Always has a trailing slash. */
export const BASE_PATH: string = import.meta.env.BASE_URL;

/** Absolute URL to an in-app route, base-path aware. `appUrl('/reset-password')` → `https://host/Funda360/reset-password`. */
export function appUrl(routePath: string): string {
  return new URL(BASE_PATH + routePath.replace(/^\//, ''), window.location.origin).toString();
}

/** True when the browser is currently on `routePath` (given as an app-relative path like `/activate-account`), base-path aware. */
export function isCurrentPath(routePath: string): boolean {
  const expected = (BASE_PATH + routePath.replace(/^\//, '')).replace(/\/$/, '');
  return window.location.pathname.replace(/\/$/, '') === expected;
}
