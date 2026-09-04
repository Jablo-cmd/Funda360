import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageContainer } from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { LoadingBlock } from '@/components/ui/LoadingBlock';
import { NoActiveSchoolNotice } from '@/components/ui/NoActiveSchoolNotice';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { usePermissions } from '@/hooks/usePermissions';
import { useSchool } from '@/features/school/hooks/useSchool';
import { useGrades } from '@/features/academic/hooks/useGrades';
import { useAdmissionRequirements } from '@/features/admissions/hooks/useAdmissionRequirements';
import { admissionService } from '@/features/admissions/services/admissionService';
import { getDbErrorMessage } from '@/lib/dbErrors';

export function AdmissionRequirementsPage() {
  const { can } = usePermissions();
  const canManage = can('admission.manage');
  const { school } = useSchool();
  const { grades } = useGrades(school?.id);
  const { requirements, isLoading, error, refetch } = useAdmissionRequirements(school?.id);

  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [gradeId, setGradeId] = useState('');
  const [required, setRequired] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const removeRequirement = async (reqId: string) => {
    setFormError(null);
    try {
      await admissionService.archiveRequirement(reqId);
      await refetch();
    } catch (err) {
      setFormError(getDbErrorMessage(err, 'Failed to remove the requirement.'));
    }
  };

  const add = async () => {
    if (!school || !label.trim()) return;
    setBusy(true);
    setFormError(null);
    try {
      await admissionService.createRequirement(school.id, { label: label.trim(), description: description.trim() || null, gradeId: gradeId || null, required });
      setLabel('');
      setDescription('');
      setGradeId('');
      setRequired(true);
      await refetch();
    } catch (err) {
      setFormError(getDbErrorMessage(err, 'Failed to add the requirement.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageContainer>
      <PageHeader title="Admission document requirements" description="What families must attach to an application. Shown on the public application form." />
      <Link to="/admissions" className="text-sm text-brand-600 hover:underline dark:text-brand-400">
        ← Admissions
      </Link>

      <ErrorAlert message={error ?? formError} />

      {!school ? (
        <NoActiveSchoolNotice resource="admission requirements" />
      ) : isLoading ? (
        <LoadingBlock label="Loading…" />
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          {canManage && (
            <div className="flex flex-col gap-3 rounded-card border border-border bg-surface-raised p-4">
              <p className="text-sm font-semibold text-content-primary">Add a requirement</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField label="Label" placeholder="Certified copy of birth certificate" value={label} onChange={(e) => setLabel(e.target.value)} />
                <div>
                  <label htmlFor="req-grade" className="mb-1.5 block text-sm font-medium text-content-primary">
                    Grade
                  </label>
                  <select id="req-grade" className="focus-ring h-11 w-full rounded-md border border-border-strong bg-surface-raised px-3 text-sm" value={gradeId} onChange={(e) => setGradeId(e.target.value)}>
                    <option value="">Any grade</option>
                    {grades.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <TextField label="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
              <label className="flex items-center gap-2 text-sm text-content-secondary">
                <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} className="h-4 w-4 rounded border-border-strong" />
                Mandatory
              </label>
              <div>
                <Button onClick={add} isLoading={busy} disabled={!label.trim()}>
                  Add requirement
                </Button>
              </div>
            </div>
          )}

          {requirements.length === 0 ? (
            <p className="rounded-card border border-border bg-surface-raised px-4 py-10 text-center text-sm text-content-tertiary">
              No document requirements configured.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {requirements.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-border bg-surface-raised px-4 py-3">
                  <div>
                    <span className="text-sm font-medium text-content-primary">{r.label}</span>
                    {!r.required && <span className="ml-2 text-xs text-content-tertiary">(optional)</span>}
                    <span className="ml-2 text-xs text-content-tertiary">
                      {r.gradeId ? grades.find((g) => g.id === r.gradeId)?.name ?? 'Grade' : 'Any grade'}
                    </span>
                    {r.description && <p className="text-xs text-content-tertiary">{r.description}</p>}
                  </div>
                  {canManage && (
                    <Button variant="ghost" onClick={() => removeRequirement(r.id)}>
                      Remove
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </PageContainer>
  );
}
