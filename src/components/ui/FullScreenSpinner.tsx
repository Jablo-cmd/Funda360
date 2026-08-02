export interface FullScreenSpinnerProps {
  label?: string;
}

export function FullScreenSpinner({ label = 'Loading…' }: FullScreenSpinnerProps) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-surface-sunken">
      <span
        aria-hidden="true"
        className="h-8 w-8 animate-spin-smooth rounded-full border-2 border-brand-600 border-t-transparent"
      />
      <p role="status" aria-live="polite" className="text-sm text-content-secondary">
        {label}
      </p>
    </div>
  );
}
