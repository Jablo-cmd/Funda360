export const SELECT_CLASS =
  'focus-ring h-11 w-full rounded-md border border-border-strong bg-surface-raised px-3.5 text-sm text-content-primary';
export const TEXTAREA_CLASS =
  'focus-ring min-h-[88px] w-full rounded-md border border-border-strong bg-surface-raised px-3 py-2 text-sm text-content-primary';

export const TABLE_CLASS = 'min-w-full divide-y divide-border text-sm';
export const TH_CLASS =
  'px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-content-tertiary';
export const TD_CLASS = 'px-4 py-2.5 align-top text-content-primary';

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' });
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value.length > 10 ? value : `${value}T00:00:00`).toLocaleDateString('en-ZA', {
    dateStyle: 'medium',
  });
}

export function humanise(value: string): string {
  const text = value.replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}
