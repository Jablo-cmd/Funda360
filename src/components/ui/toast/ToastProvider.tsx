import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ToastContext } from '@/components/ui/toast/toastContext';
import type { ToastOptions, ToastVariant } from '@/components/ui/toast/toastContext';
import { CheckIcon, CloseIcon } from '@/components/ui/icons';

interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
}

const DEFAULT_DURATION_MS = 5000;

const VARIANT_CLASSES: Record<ToastVariant, string> = {
  success: 'border-success-500/30 bg-surface-raised text-content-primary',
  error: 'border-danger-500/30 bg-surface-raised text-content-primary',
  info: 'border-border bg-surface-raised text-content-primary',
};

const VARIANT_ICON_CLASSES: Record<ToastVariant, string> = {
  success: 'text-success-500',
  error: 'text-danger-600',
  info: 'text-content-tertiary',
};

/**
 * A global, ephemeral notification queue — distinct from the many
 * per-form static `role="alert"` divs already used throughout this app
 * (a submit error that stays put until the user acts), and distinct from
 * the persisted `notifications` table (FND-COM-001, an in-app inbox with
 * its own bell icon and read/unread state). A toast is for a fire-and-
 * forget confirmation that doesn't need to persist anywhere — "Copied to
 * clipboard", "Draft published" — call sites decide per-action which of
 * the three fits; this does not replace either existing pattern.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, options?: ToastOptions) => {
      const id = crypto.randomUUID();
      const variant = options?.variant ?? 'info';
      setToasts((current) => [...current, { id, message, variant }]);

      const durationMs = options?.durationMs ?? DEFAULT_DURATION_MS;
      if (durationMs > 0) {
        setTimeout(() => dismissToast(id), durationMs);
      }
      return id;
    },
    [dismissToast],
  );

  const value = useMemo(() => ({ showToast, dismissToast }), [showToast, dismissToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/*
        No role on this outer container — it is permanently in the DOM
        (empty when there are no toasts), and a live-region role on a
        persistent element caused a real, documented ARIA collision
        elsewhere in this app (see MfaRequiredBanner's own history: a
        `getByRole('status')` query resolved to 2 elements because a
        persistent banner used the same role a genuinely transient
        success message elsewhere expected to be the only match). Each
        individual toast — which really does appear then disappear — gets
        its own role="status" below instead.
      */}
      {createPortal(
        <div aria-live="polite" className="fixed bottom-4 right-4 z-[60] flex w-full max-w-sm flex-col gap-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              role="status"
              className={`flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm shadow-card dark:shadow-card-dark ${VARIANT_CLASSES[toast.variant]}`}
            >
              {toast.variant !== 'info' && (
                <span className={`mt-0.5 shrink-0 ${VARIANT_ICON_CLASSES[toast.variant]}`}>
                  {toast.variant === 'success' ? <CheckIcon className="h-4 w-4" /> : <CloseIcon className="h-4 w-4" />}
                </span>
              )}
              <span className="flex-1">{toast.message}</span>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                aria-label="Dismiss"
                className="focus-ring shrink-0 rounded p-0.5 text-content-tertiary hover:text-content-primary"
              >
                <CloseIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}
