import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';

export interface ReportCardCommentFieldProps {
  label: string;
  value: string | null;
  editable: boolean;
  placeholder?: string;
  onSave: (text: string) => Promise<void>;
}

/** A labelled multi-line comment with an explicit Save — used for every free-text field on a report card. */
export function ReportCardCommentField({ label, value, editable, placeholder, onSave }: ReportCardCommentFieldProps) {
  const [draft, setDraft] = useState(value ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    setDraft(value ?? '');
  }, [value]);

  const dirty = draft.trim() !== (value ?? '').trim();

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave(draft.trim());
      setSavedAt(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  if (!editable) {
    return (
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-content-tertiary">{label}</p>
        <p className="mt-1 whitespace-pre-wrap text-sm text-content-secondary">{value || <span className="text-content-tertiary">Not set</span>}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold uppercase tracking-wide text-content-tertiary">{label}</label>
      <textarea
        className="focus-ring min-h-[72px] w-full rounded-md border border-border-strong bg-surface-raised px-3 py-2 text-sm text-content-primary"
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
      />
      {error && (
        <p role="alert" className="text-xs font-medium text-danger-600">
          {error}
        </p>
      )}
      <div className="flex items-center gap-2">
        <Button variant="secondary" onClick={save} disabled={!dirty} isLoading={saving}>
          Save
        </Button>
        {savedAt && !dirty && <span className="text-xs text-success-600">Saved</span>}
      </div>
    </div>
  );
}
