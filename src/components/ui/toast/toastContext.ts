import { createContext } from 'react';

export type ToastVariant = 'success' | 'error' | 'info';

export interface ToastOptions {
  variant?: ToastVariant;
  /** Milliseconds before auto-dismiss. Defaults to 5000; pass 0 to require manual dismissal (e.g. for an error the user should actively acknowledge). */
  durationMs?: number;
}

export interface ToastContextValue {
  /** Shows a toast and returns its id, in case a caller ever needs to dismiss it early (e.g. superseding a "Saving…" toast with a result). */
  showToast: (message: string, options?: ToastOptions) => string;
  dismissToast: (id: string) => void;
}

export const ToastContext = createContext<ToastContextValue | undefined>(undefined);
