import { Component, type ErrorInfo, type ReactNode } from 'react';
import { isChunkLoadError, reportError } from '@/lib/errorReporting';

const CHUNK_RELOAD_KEY = 'funda360-chunk-reload-at';
const CHUNK_RELOAD_WINDOW_MS = 60_000;
const HOME_HREF: string = import.meta.env.BASE_URL;

export interface ErrorBoundaryProps {
  children: ReactNode;
  /** Where the boundary sits — included in the error report. */
  context: string;
  /** Changing this value (e.g. the route path) clears a caught error, so navigating away recovers. */
  resetKey?: string;
  /** Full-screen fallback for the root boundary; inline card otherwise. */
  fullScreen?: boolean;
}

interface State {
  error: Error | null;
  resetKey?: string;
}

/**
 * Catches render errors so one broken page never blanks the whole app
 * (audit P1-7). A stale lazy chunk after a redeploy triggers one automatic
 * reload (guarded so it cannot loop); anything else is reported through
 * lib/errorReporting and shown as a recoverable message.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, State> {
  state: State = { error: null, resetKey: this.props.resetKey };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  static getDerivedStateFromProps(props: ErrorBoundaryProps, state: State): Partial<State> | null {
    if (props.resetKey !== state.resetKey) return { error: null, resetKey: props.resetKey };
    return null;
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    if (isChunkLoadError(error) && this.tryChunkReload()) return;
    reportError(error, this.props.context);
    if (info.componentStack) console.error(info.componentStack);
  }

  private tryChunkReload(): boolean {
    try {
      const last = Number(window.sessionStorage.getItem(CHUNK_RELOAD_KEY) ?? 0);
      if (Date.now() - last < CHUNK_RELOAD_WINDOW_MS) return false;
      window.sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
    } catch {
      return false;
    }
    window.location.reload();
    return true;
  }

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    const stale = isChunkLoadError(error);
    const card = (
      <div
        role="alert"
        className="mx-auto max-w-lg rounded-card border border-t-4 border-border border-t-accent-500 bg-surface-raised p-6 shadow-card dark:shadow-card-dark"
      >
        <h1 className="text-lg font-semibold text-content-primary">
          {stale ? 'A new version of Funda360 is available' : 'Something went wrong on this page'}
        </h1>
        <p className="mt-2 text-sm text-content-secondary">
          {stale
            ? 'Reload to continue with the latest version.'
            : 'The problem has been recorded. You can reload the page or go back to your dashboard — your data is safe.'}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="focus-ring rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
          {!stale && (
            <a
              href={HOME_HREF}
              className="focus-ring rounded-md border border-border-strong px-4 py-2 text-sm font-semibold text-content-primary"
            >
              Go to dashboard
            </a>
          )}
        </div>
      </div>
    );
    return this.props.fullScreen ? (
      <div className="flex min-h-dvh items-center justify-center bg-surface-sunken p-4">{card}</div>
    ) : (
      <div className="p-4 sm:p-8">{card}</div>
    );
  }
}
