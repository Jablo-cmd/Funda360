export interface ErrorAlertProps {
  message: string | null | undefined;
}

/**
 * The `role="alert"` danger banner every page rendered independently for
 * its own error/actionError state. Renders nothing when there's no message,
 * so call sites can use it unconditionally: `<ErrorAlert message={error} />`.
 */
export function ErrorAlert({ message }: ErrorAlertProps) {
  if (!message) return null;

  return (
    <div
      role="alert"
      className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-600"
    >
      {message}
    </div>
  );
}
