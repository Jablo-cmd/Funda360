import { useCallback, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PageContainer } from '@/components/ui/PageContainer';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { LoadingBlock } from '@/components/ui/LoadingBlock';
import { Button } from '@/components/ui/Button';
import { usePermissions } from '@/hooks/usePermissions';
import { useSchool } from '@/features/school/hooks/useSchool';
import { useGrades } from '@/features/academic/hooks/useGrades';
import { useAcademic } from '@/features/academic/hooks/useAcademic';
import { useAdmissionApplication } from '@/features/admissions/hooks/useAdmissionApplication';
import { admissionService } from '@/features/admissions/services/admissionService';
import { ApplicationStatusBadge } from '@/features/admissions/components/ApplicationStatusBadge';
import { AdmissionsWorkflowBar } from '@/features/admissions/components/AdmissionsWorkflowBar';
import { ConvertApplicationModal } from '@/features/admissions/components/ConvertApplicationModal';
import { ADMISSION_EDITABLE_STATUSES, type AdmissionApplicationStatus } from '@/features/admissions/types/admission.types';
import { getDbErrorMessage } from '@/lib/dbErrors';
import { useToast } from '@/components/ui/toast/useToast';

function fmt(value: string | null): string {
  return value ? new Date(value).toLocaleString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
}

export function AdmissionApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = usePermissions();
  const canManage = can('admission.manage');
  const { school } = useSchool();
  const { grades } = useGrades(school?.id);
  const { academicYears } = useAcademic();
  const { showToast } = useToast();

  const { application, isLoading, error, notFound, refetch } = useAdmissionApplication(id);
  const [actionError, setActionError] = useState<string | null>(null);
  const [convertOpen, setConvertOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [savingField, setSavingField] = useState<string | null>(null);

  const act = useCallback(
    async (fn: () => Promise<unknown>, msg: string) => {
      setActionError(null);
      try {
        await fn();
        showToast(msg, { variant: 'success' });
        await refetch();
      } catch (err) {
        setActionError(getDbErrorMessage(err, 'That action could not be completed.'));
      }
    },
    [refetch, showToast],
  );

  if (isLoading) return <PageContainer><LoadingBlock label="Loading application…" /></PageContainer>;
  if (notFound || !application)
    return (
      <PageContainer>
        <p className="rounded-card border border-border bg-surface-raised px-4 py-10 text-center text-sm text-content-tertiary">
          This application was not found, or you do not have access. <Link to="/admissions" className="text-brand-600 hover:underline">Back to admissions</Link>
        </p>
      </PageContainer>
    );

  const editable = canManage && ADMISSION_EDITABLE_STATUSES.includes(application.status);
  const gradeName = grades.find((g) => g.id === application.requestedGradeId)?.name;
  const yearName = academicYears.find((y) => y.id === application.academicYearId)?.name;

  const saveField = async (field: string, value: string) => {
    setSavingField(field);
    try {
      await admissionService.updateApplicationData(application.id, { [field]: value || null });
      await refetch();
    } catch (err) {
      setActionError(getDbErrorMessage(err, 'Failed to save.'));
    } finally {
      setSavingField(null);
    }
  };

  const openDocument = async (path: string) => {
    try {
      const url = await admissionService.documentUrl(path);
      window.open(url, '_blank', 'noopener');
    } catch (err) {
      setActionError(getDbErrorMessage(err, 'Could not open the document.'));
    }
  };

  const detail = (label: string, value: string | null | undefined) => (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-content-tertiary">{label}</dt>
      <dd className="mt-0.5 text-sm text-content-secondary">{value || '—'}</dd>
    </div>
  );

  return (
    <PageContainer>
      <div className="flex flex-col gap-4">
        <Link to="/admissions" className="text-sm text-brand-600 hover:underline dark:text-brand-400">
          ← Admissions
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-content-primary">
              {application.learnerFirstName} {application.learnerLastName}
            </h1>
            <p className="mt-1 text-sm text-content-secondary">
              {application.referenceNumber ?? 'Not yet submitted'} · {application.isPublicSubmission ? 'Portal submission' : 'Staff-entered'}
              {application.convertedLearnerId && (
                <>
                  {' · '}
                  <Link to={`/learners/${application.convertedLearnerId}`} className="text-brand-600 hover:underline dark:text-brand-400">
                    View learner record
                  </Link>
                </>
              )}
            </p>
          </div>
          <ApplicationStatusBadge status={application.status} />
        </div>

        <ErrorAlert message={error ?? actionError} />

        <AdmissionsWorkflowBar
          application={application}
          canManage={canManage}
          onSubmit={() => act(() => admissionService.submit(application.id), 'Application submitted.')}
          onTransition={(to: AdmissionApplicationStatus, note?: string) =>
            act(() => admissionService.transition(application.id, to, note), 'Status updated.')
          }
          onConvert={() => setConvertOpen(true)}
        />

        <div className="grid gap-4 lg:grid-cols-3">
          {/* Applicant + learner details */}
          <dl className="flex flex-col gap-3 rounded-card border border-border bg-surface-raised p-4 lg:col-span-2">
            <p className="text-sm font-semibold text-content-primary">Applicant</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {detail('Name', `${application.applicantFirstName ?? ''} ${application.applicantLastName ?? ''}`.trim())}
              {detail('Email', application.applicantEmail)}
              {detail('Phone', application.applicantPhone)}
              {detail('Relationship', application.applicantRelationship)}
            </div>
            <p className="mt-2 text-sm font-semibold text-content-primary">Learner</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {detail('Date of birth', application.learnerDateOfBirth)}
              {detail('Gender', application.learnerGender)}
              {detail('ID number', application.learnerIdNumber)}
              {detail('Nationality', application.learnerNationality)}
              {detail('Home language', application.learnerHomeLanguage)}
              {detail('Prior school', application.priorSchool)}
            </div>
            {application.additionalNotes && detail('Applicant notes', application.additionalNotes)}

            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-content-tertiary">
                Academic year
                <select
                  disabled={!editable}
                  className="focus-ring h-10 rounded-md border border-border-strong bg-surface-raised px-3 text-sm text-content-primary disabled:opacity-60"
                  value={application.academicYearId ?? ''}
                  onChange={(e) => saveField('academic_year_id', e.target.value)}
                >
                  <option value="">Undecided</option>
                  {academicYears.map((y) => (
                    <option key={y.id} value={y.id}>
                      {y.name}
                    </option>
                  ))}
                </select>
                {savingField === 'academic_year_id' && <span className="text-[11px] text-content-tertiary">Saving…</span>}
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-content-tertiary">
                Requested grade
                <select
                  disabled={!editable}
                  className="focus-ring h-10 rounded-md border border-border-strong bg-surface-raised px-3 text-sm text-content-primary disabled:opacity-60"
                  value={application.requestedGradeId ?? ''}
                  onChange={(e) => saveField('requested_grade_id', e.target.value)}
                >
                  <option value="">Undecided</option>
                  {grades.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
                {savingField === 'requested_grade_id' && <span className="text-[11px] text-content-tertiary">Saving…</span>}
              </label>
            </div>
            <p className="text-[11px] text-content-tertiary">
              {yearName ?? 'No year'} · {gradeName ?? 'No grade'}
              {application.decisionReason && ` · Decision note: ${application.decisionReason}`}
            </p>
          </dl>

          {/* Documents */}
          <div className="rounded-card border border-border bg-surface-raised p-4">
            <p className="text-sm font-semibold text-content-primary">Documents</p>
            {application.documents.length === 0 ? (
              <p className="mt-2 text-sm text-content-tertiary">No documents uploaded.</p>
            ) : (
              <ul className="mt-2 flex flex-col gap-2">
                {application.documents.map((doc) => (
                  <li key={doc.id} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
                    <button type="button" onClick={() => openDocument(doc.storagePath)} className="text-left text-brand-600 hover:underline dark:text-brand-400">
                      {doc.label}
                    </button>
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => act(() => admissionService.verifyDocument(doc.id, !doc.verified), doc.verified ? 'Marked unverified.' : 'Verified.')}
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${doc.verified ? 'bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-500' : 'bg-surface-sunken text-content-tertiary'}`}
                      >
                        {doc.verified ? 'Verified' : 'Verify'}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Timeline + notes */}
        <div className="rounded-card border border-border bg-surface-raised p-4">
          <p className="text-sm font-semibold text-content-primary">Timeline</p>
          <ol className="mt-2 flex flex-col gap-2 text-sm">
            {application.events.map((ev) => (
              <li key={ev.id} className="flex flex-wrap items-baseline gap-2">
                <span className="text-xs text-content-tertiary">{fmt(ev.createdAt)}</span>
                <span className="font-medium text-content-primary">{ev.eventType.replace('_', ' ')}</span>
                {ev.fromStatus && ev.toStatus && (
                  <span className="text-content-secondary">
                    {ev.fromStatus} → {ev.toStatus}
                  </span>
                )}
                {ev.note && <span className="text-content-secondary">— {ev.note}</span>}
              </li>
            ))}
          </ol>

          {canManage && (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
              <input
                className="focus-ring h-10 min-w-[16rem] flex-1 rounded-md border border-border-strong bg-surface-raised px-3 text-sm text-content-primary"
                placeholder="Add an internal note"
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
              />
              <Button
                variant="secondary"
                disabled={noteDraft.trim().length === 0}
                onClick={() =>
                  act(async () => {
                    await admissionService.addNote(application.id, noteDraft.trim());
                    setNoteDraft('');
                  }, 'Note added.')
                }
              >
                Add note
              </Button>
            </div>
          )}
        </div>
      </div>

      <ConvertApplicationModal
        isOpen={convertOpen}
        onClose={() => setConvertOpen(false)}
        application={application}
        onConverted={() => {
          showToast('Learner created and enrolled.', { variant: 'success' });
          void refetch();
        }}
      />
    </PageContainer>
  );
}
