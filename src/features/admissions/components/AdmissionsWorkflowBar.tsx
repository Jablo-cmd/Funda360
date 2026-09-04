import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import {
  ADMISSION_NEXT_STATUSES,
  ADMISSION_STATUS_LABELS,
  type AdmissionApplication,
  type AdmissionApplicationStatus,
} from '@/features/admissions/types/admission.types';

export interface AdmissionsWorkflowBarProps {
  application: AdmissionApplication;
  canManage: boolean;
  onSubmit: () => Promise<void>;
  onTransition: (to: AdmissionApplicationStatus, note?: string) => Promise<void>;
  onConvert: () => void;
}

const DECISION_STATUSES: AdmissionApplicationStatus[] = ['accepted', 'rejected', 'waitlisted'];

export function AdmissionsWorkflowBar({ application, canManage, onSubmit, onTransition, onConvert }: AdmissionsWorkflowBarProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const [noteFor, setNoteFor] = useState<AdmissionApplicationStatus | null>(null);
  const [note, setNote] = useState('');

  if (!canManage) return null;

  const run = async (fn: () => Promise<void>, key: string) => {
    setBusy(key);
    try {
      await fn();
      setNoteFor(null);
      setNote('');
    } finally {
      setBusy(null);
    }
  };

  const nextStatuses = ADMISSION_NEXT_STATUSES[application.status];

  return (
    <div className="flex flex-col gap-2 rounded-card border border-border bg-surface-raised p-3">
      <div className="flex flex-wrap items-center gap-2">
        {application.status === 'draft' && (
          <Button variant="primary" isLoading={busy === 'submit'} onClick={() => run(onSubmit, 'submit')}>
            Submit application
          </Button>
        )}

        {application.status === 'accepted' && application.convertedLearnerId === null && (
          <Button variant="primary" onClick={onConvert}>
            Convert to learner
          </Button>
        )}

        {nextStatuses.map((to) => (
          <Button
            key={to}
            variant={to === 'accepted' ? 'primary' : to === 'rejected' || to === 'withdrawn' ? 'secondary' : 'secondary'}
            isLoading={busy === to}
            onClick={() => (DECISION_STATUSES.includes(to) || to === 'withdrawn' ? setNoteFor(to) : run(() => onTransition(to), to))}
          >
            {ADMISSION_STATUS_LABELS[to]}
          </Button>
        ))}
      </div>

      {noteFor && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-2">
          <input
            className="focus-ring h-10 min-w-[16rem] flex-1 rounded-md border border-border-strong bg-surface-raised px-3 text-sm text-content-primary"
            placeholder={`Reason / note for "${ADMISSION_STATUS_LABELS[noteFor]}"`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <Button variant="primary" isLoading={busy === noteFor} onClick={() => run(() => onTransition(noteFor, note.trim() || undefined), noteFor)}>
            Confirm
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setNoteFor(null);
              setNote('');
            }}
          >
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}
