import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { Logo } from '@/components/ui/Logo';
import {
  publicAdmissionService,
  type PublicAdmissionConfig,
  type PublicApplicationPayload,
} from '@/features/admissions/services/publicAdmissionService';

const inputBase =
  'focus-ring h-11 w-full rounded-md border border-border-strong bg-surface-raised px-3 text-sm text-content-primary';

export function PublicApplyPage() {
  const [params] = useSearchParams();
  const schoolId = params.get('school') ?? '';

  const [config, setConfig] = useState<PublicAdmissionConfig | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [form, setForm] = useState<PublicApplicationPayload>({});
  const [resumeToken, setResumeToken] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [pendingRequirementId, setPendingRequirementId] = useState<string | null>(null);

  const urlToken = params.get('t');

  useEffect(() => {
    if (!schoolId) {
      setConfigError('This application link is missing its school. Please use the link your school provided.');
      return;
    }
    publicAdmissionService
      .config(schoolId)
      .then(setConfig)
      .catch((err: Error) => setConfigError(err.message || 'This school is not accepting online applications.'));
  }, [schoolId]);

  useEffect(() => {
    if (!urlToken) return;
    publicAdmissionService
      .get(urlToken)
      .then((res) => {
        if (!res.found || !res.editable || !res.application) {
          setMessage('This draft can no longer be edited online.');
          return;
        }
        const app = res.application as Record<string, string | null>;
        setResumeToken(urlToken);
        setEmail(app.applicant_email ?? '');
        setForm({
          applicant_first_name: app.applicant_first_name ?? undefined,
          applicant_last_name: app.applicant_last_name ?? undefined,
          applicant_phone: app.applicant_phone ?? undefined,
          applicant_relationship: app.applicant_relationship ?? undefined,
          learner_first_name: app.learner_first_name ?? undefined,
          learner_last_name: app.learner_last_name ?? undefined,
          learner_date_of_birth: app.learner_date_of_birth ?? undefined,
          learner_id_number: app.learner_id_number ?? undefined,
          learner_nationality: app.learner_nationality ?? undefined,
          learner_home_language: app.learner_home_language ?? undefined,
          prior_school: app.prior_school ?? undefined,
          additional_notes: app.additional_notes ?? undefined,
          academic_year_id: app.academic_year_id ?? undefined,
          requested_grade_id: app.requested_grade_id ?? undefined,
        });
      })
      .catch(() => setMessage('We could not load that draft.'));
  }, [urlToken]);

  const set = (key: keyof PublicApplicationPayload, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const requirements = useMemo(
    () => (config?.requirements ?? []).filter((r) => !r.grade_id || r.grade_id === form.requested_grade_id),
    [config, form.requested_grade_id],
  );

  const saveDraft = async () => {
    if (!config) return;
    setBusy('save');
    setMessage(null);
    try {
      if (!resumeToken) {
        const res = await publicAdmissionService.start(config.school.id, email, form);
        setResumeToken(res.resumeToken);
        window.history.replaceState(null, '', `${window.location.pathname}?school=${config.school.id}&t=${res.resumeToken}`);
      } else {
        await publicAdmissionService.save(resumeToken, form);
      }
      setMessage('Draft saved. You can return to this link to continue.');
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const submit = async () => {
    if (!resumeToken) {
      await saveDraft();
    }
    const token = resumeToken;
    if (!token) return;
    setBusy('submit');
    setMessage(null);
    try {
      await publicAdmissionService.save(token, form);
      const res = await publicAdmissionService.submit(token);
      setReference(res.referenceNumber);
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const onFile = async (file: File) => {
    if (!resumeToken) {
      setMessage('Save your draft first, then attach documents.');
      return;
    }
    setBusy('upload');
    try {
      const req = requirements.find((r) => r.id === pendingRequirementId);
      await publicAdmissionService.uploadDocument(resumeToken, file, req?.label ?? file.name, req?.id);
      setMessage(`Uploaded ${file.name}.`);
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setBusy(null);
      setPendingRequirementId(null);
    }
  };

  if (configError) {
    return (
      <Shell>
        <p className="rounded-lg border border-danger-500/30 bg-danger-50 px-4 py-3 text-sm text-danger-600">{configError}</p>
      </Shell>
    );
  }
  if (!config) {
    return (
      <Shell>
        <p className="text-sm text-content-tertiary">Loading…</p>
      </Shell>
    );
  }

  if (reference) {
    return (
      <Shell schoolName={config.school.name}>
        <div className="rounded-lg border border-success-500/30 bg-success-50 p-5 text-center dark:bg-success-500/10">
          <h2 className="text-lg font-bold text-content-primary">Application submitted</h2>
          <p className="mt-2 text-sm text-content-secondary">
            Your reference number is <strong className="font-mono">{reference}</strong>. Keep it safe — you&apos;ll need it (with your
            email) to check your application status.
          </p>
        </div>
        <Link to={`/apply/resume`} className="mt-4 block text-center text-sm text-brand-600 hover:underline">
          Check an application status
        </Link>
      </Shell>
    );
  }

  return (
    <Shell schoolName={config.school.name}>
      <p className="text-sm text-content-secondary">
        Complete this form to apply. You can save a draft and return using the same link, or{' '}
        <Link to="/apply/resume" className="text-brand-600 hover:underline">
          resume a submitted application
        </Link>
        .
      </p>
      {message && <p className="rounded-md bg-surface-sunken px-3 py-2 text-sm text-content-secondary">{message}</p>}

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-semibold text-content-primary">Your details</legend>
        <TextField label="Your email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} disabled={!!resumeToken} />
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label="First name" required value={form.applicant_first_name ?? ''} onChange={(e) => set('applicant_first_name', e.target.value)} />
          <TextField label="Last name" value={form.applicant_last_name ?? ''} onChange={(e) => set('applicant_last_name', e.target.value)} />
          <TextField label="Phone" value={form.applicant_phone ?? ''} onChange={(e) => set('applicant_phone', e.target.value)} />
          <TextField label="Relationship to learner" placeholder="mother / father / legal guardian" value={form.applicant_relationship ?? ''} onChange={(e) => set('applicant_relationship', e.target.value)} />
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-semibold text-content-primary">Learner details</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label="Learner first name" required value={form.learner_first_name ?? ''} onChange={(e) => set('learner_first_name', e.target.value)} />
          <TextField label="Learner last name" required value={form.learner_last_name ?? ''} onChange={(e) => set('learner_last_name', e.target.value)} />
          <TextField label="Date of birth" type="date" value={form.learner_date_of_birth ?? ''} onChange={(e) => set('learner_date_of_birth', e.target.value)} />
          <TextField label="ID / passport number" value={form.learner_id_number ?? ''} onChange={(e) => set('learner_id_number', e.target.value)} />
          <TextField label="Nationality" value={form.learner_nationality ?? ''} onChange={(e) => set('learner_nationality', e.target.value)} />
          <TextField label="Home language" value={form.learner_home_language ?? ''} onChange={(e) => set('learner_home_language', e.target.value)} />
          <TextField label="Current / previous school" value={form.prior_school ?? ''} onChange={(e) => set('prior_school', e.target.value)} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm font-medium text-content-primary">
            Academic year
            <select className={inputBase} value={form.academic_year_id ?? ''} onChange={(e) => set('academic_year_id', e.target.value)}>
              <option value="">Select…</option>
              {config.academicYears.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-content-primary">
            Grade applying for
            <select className={inputBase} value={form.requested_grade_id ?? ''} onChange={(e) => set('requested_grade_id', e.target.value)}>
              <option value="">Select…</option>
              {config.grades.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="flex flex-col gap-1 text-sm font-medium text-content-primary">
          Anything else we should know
          <textarea className="focus-ring min-h-[72px] w-full rounded-md border border-border-strong bg-surface-raised px-3 py-2 text-sm" value={form.additional_notes ?? ''} onChange={(e) => set('additional_notes', e.target.value)} />
        </label>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-semibold text-content-primary">Supporting documents</legend>
        {!resumeToken && <p className="text-xs text-content-tertiary">Save your draft first to attach documents.</p>}
        {requirements.length === 0 && <p className="text-xs text-content-tertiary">No specific documents are required — you may still attach any relevant files.</p>}
        <ul className="flex flex-col gap-2">
          {requirements.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
              <span>
                {r.label}
                {r.required ? <span className="text-danger-600"> *</span> : <span className="text-content-tertiary"> (optional)</span>}
                {r.description && <span className="block text-xs text-content-tertiary">{r.description}</span>}
              </span>
              <Button
                variant="secondary"
                disabled={!resumeToken || busy === 'upload'}
                onClick={() => {
                  setPendingRequirementId(r.id);
                  fileInput.current?.click();
                }}
              >
                Attach
              </Button>
            </li>
          ))}
        </ul>
        <Button
          variant="secondary"
          disabled={!resumeToken || busy === 'upload'}
          onClick={() => {
            setPendingRequirementId(null);
            fileInput.current?.click();
          }}
        >
          Attach another file
        </Button>
        <input
          ref={fileInput}
          type="file"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void onFile(file);
            e.target.value = '';
          }}
        />
      </fieldset>

      <div className="flex flex-wrap gap-2 border-t border-border pt-4">
        <Button variant="secondary" onClick={saveDraft} isLoading={busy === 'save'} disabled={!email}>
          Save draft
        </Button>
        <Button onClick={submit} isLoading={busy === 'submit'} disabled={!email || !form.applicant_first_name || !form.learner_first_name || !form.learner_last_name}>
          Submit application
        </Button>
      </div>
    </Shell>
  );
}

function Shell({ children, schoolName }: { children: ReactNode; schoolName?: string }) {
  return (
    <div className="min-h-screen bg-surface-sunken px-4 py-10">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 rounded-card border border-border bg-surface-base p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <Logo className="h-8 w-8" />
          <div>
            <p className="text-lg font-bold text-content-primary">{schoolName ?? 'Funda360'}</p>
            <p className="text-xs text-content-tertiary">Application for admission</p>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
