import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { Logo } from '@/components/ui/Logo';
import { publicAdmissionService } from '@/features/admissions/services/publicAdmissionService';
import { ADMISSION_STATUS_LABELS } from '@/features/admissions/types/admission.types';
import type { AdmissionApplicationStatus } from '@/features/admissions/types/admission.types';

export function PublicApplyResumePage() {
  const [email, setEmail] = useState('');
  const [reference, setReference] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<
    | { found: false }
    | { found: true; status: string; reference: string; learnerFirstName: string | null }
    | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  const lookup = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await publicAdmissionService.resume(email.trim(), reference.trim(), dateOfBirth);
      if (!res.found) {
        setResult({ found: false });
      } else {
        setResult({
          found: true,
          status: res.status ?? 'submitted',
          reference: res.reference_number ?? reference,
          learnerFirstName: res.learner_first_name ?? null,
        });
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-sunken px-4 py-10">
      <div className="bg-surface-base mx-auto flex w-full max-w-md flex-col gap-4 rounded-card border border-border p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <Logo className="h-8 w-8" />
          <p className="text-lg font-bold text-content-primary">Check your application</p>
        </div>
        <p className="text-sm text-content-secondary">
          Enter the email you applied with, your reference number and your child's date of birth.
        </p>

        {error && (
          <p className="rounded-md bg-danger-50 px-3 py-2 text-sm text-danger-600">{error}</p>
        )}

        <TextField
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <TextField
          label="Reference number"
          placeholder="APP-2026-00042-K7QM3X"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
        />
        <TextField
          label="Child's date of birth"
          type="date"
          value={dateOfBirth}
          onChange={(e) => setDateOfBirth(e.target.value)}
        />
        <Button onClick={lookup} isLoading={busy} disabled={!email || !reference || !dateOfBirth}>
          Look up
        </Button>

        {result && !result.found && (
          <p className="rounded-md bg-surface-sunken px-3 py-2 text-sm text-content-secondary">
            No application matches those details.
          </p>
        )}

        {result && result.found && (
          <div className="rounded-lg border border-border bg-surface-raised p-4 text-sm">
            <p className="font-semibold text-content-primary">
              {result.learnerFirstName ?? 'Application'}
            </p>
            <p className="mt-1 text-content-secondary">
              {result.reference} · Status:{' '}
              <strong>
                {ADMISSION_STATUS_LABELS[result.status as AdmissionApplicationStatus] ??
                  result.status}
              </strong>
            </p>
            {(result.status === 'draft' || result.status === 'incomplete') && (
              <p className="mt-2 text-xs text-content-tertiary">
                This application still needs to be completed and submitted. Use the link your school
                sent you to continue.
              </p>
            )}
          </div>
        )}

        <Link to="/login" className="text-center text-xs text-brand-600 hover:underline">
          Staff sign in
        </Link>
      </div>
    </div>
  );
}
