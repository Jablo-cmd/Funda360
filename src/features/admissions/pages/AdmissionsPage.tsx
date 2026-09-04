import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageContainer } from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { LoadingBlock } from '@/components/ui/LoadingBlock';
import { NoActiveSchoolNotice } from '@/components/ui/NoActiveSchoolNotice';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import { usePermissions } from '@/hooks/usePermissions';
import { useSchool } from '@/features/school/hooks/useSchool';
import { useAcademic } from '@/features/academic/hooks/useAcademic';
import { useGrades } from '@/features/academic/hooks/useGrades';
import { useAdmissionApplications } from '@/features/admissions/hooks/useAdmissionApplications';
import { ApplicationStatusBadge } from '@/features/admissions/components/ApplicationStatusBadge';
import { CreateApplicationModal } from '@/features/admissions/components/CreateApplicationModal';
import {
  ADMISSION_PIPELINE_STATUSES,
  ADMISSION_STATUS_LABELS,
  type AdmissionApplication,
} from '@/features/admissions/types/admission.types';

function fmtDate(value: string): string {
  return new Date(value).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function AdmissionsPage() {
  const { can } = usePermissions();
  const canManage = can('admission.manage');
  const { school } = useSchool();
  const { academicYears } = useAcademic();
  const { grades } = useGrades(school?.id);

  const [statusFilter, setStatusFilter] = useState('');
  const [gradeFilter, setGradeFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const { applications, isLoading, error, refetch } = useAdmissionApplications(school?.id, {
    status: statusFilter || undefined,
    gradeId: gradeFilter || undefined,
  });

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of applications) map.set(a.status, (map.get(a.status) ?? 0) + 1);
    return map;
  }, [applications]);

  const gradeName = (id: string | null) => (id ? grades.find((g) => g.id === id)?.name ?? '—' : '—');
  const pipelineTotal = ADMISSION_PIPELINE_STATUSES.reduce((sum, s) => sum + (counts.get(s) ?? 0), 0);

  return (
    <PageContainer>
      <PageHeader
        title="Admissions"
        description="Applications from first enquiry through to enrolment."
        action={
          canManage && school ? (
            <div className="flex gap-2">
              <Link
                to="/admissions/requirements"
                className="focus-ring inline-flex h-10 items-center rounded-md border border-border-strong px-3.5 text-sm font-medium text-content-secondary hover:bg-surface-sunken"
              >
                Document requirements
              </Link>
              <Button onClick={() => setCreateOpen(true)}>New application</Button>
            </div>
          ) : undefined
        }
      />

      <ErrorAlert message={error} />

      {!school ? (
        <NoActiveSchoolNotice resource="admissions" />
      ) : (
        <div className="flex flex-col gap-4">
          {/* Pipeline snapshot */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
            <button
              type="button"
              onClick={() => setStatusFilter('')}
              className={`rounded-card border p-3 text-left ${statusFilter === '' ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10' : 'border-border bg-surface-raised'}`}
            >
              <p className="text-xs font-medium text-content-tertiary">In pipeline</p>
              <p className="mt-0.5 text-xl font-bold text-content-primary">{pipelineTotal}</p>
            </button>
            {ADMISSION_PIPELINE_STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(statusFilter === s ? '' : s)}
                className={`rounded-card border p-3 text-left ${statusFilter === s ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10' : 'border-border bg-surface-raised'}`}
              >
                <p className="text-xs font-medium text-content-tertiary">{ADMISSION_STATUS_LABELS[s]}</p>
                <p className="mt-0.5 text-xl font-bold text-content-primary">{counts.get(s) ?? 0}</p>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-xs font-medium text-content-tertiary">
              Status
              <select
                className="focus-ring h-10 rounded-md border border-border-strong bg-surface-raised px-3 text-sm text-content-primary"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">All</option>
                {Object.entries(ADMISSION_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-content-tertiary">
              Grade
              <select
                className="focus-ring h-10 rounded-md border border-border-strong bg-surface-raised px-3 text-sm text-content-primary"
                value={gradeFilter}
                onChange={(e) => setGradeFilter(e.target.value)}
              >
                <option value="">All grades</option>
                {grades.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {isLoading ? (
            <LoadingBlock label="Loading applications…" />
          ) : (
            <DataTable<AdmissionApplication>
              columns={[
                {
                  key: 'learner',
                  header: 'Learner',
                  render: (row) => (
                    <Link to={`/admissions/${row.id}`} className="font-medium text-brand-600 hover:underline dark:text-brand-400">
                      {row.learnerFirstName} {row.learnerLastName}
                    </Link>
                  ),
                },
                { key: 'ref', header: 'Reference', render: (row) => row.referenceNumber ?? '—' },
                { key: 'applicant', header: 'Applicant', render: (row) => `${row.applicantFirstName ?? ''} ${row.applicantLastName ?? ''}`.trim() || row.applicantEmail },
                { key: 'grade', header: 'Grade', render: (row) => gradeName(row.requestedGradeId) },
                { key: 'source', header: 'Source', render: (row) => (row.isPublicSubmission ? 'Portal' : 'Staff') },
                { key: 'submitted', header: 'Submitted', render: (row) => (row.submittedAt ? fmtDate(row.submittedAt) : '—') },
                { key: 'status', header: 'Status', render: (row) => <ApplicationStatusBadge status={row.status} /> },
              ]}
              rows={applications}
              getRowKey={(row) => row.id}
              emptyMessage="No applications for this filter."
            />
          )}
        </div>
      )}

      {school && (
        <CreateApplicationModal
          isOpen={createOpen}
          onClose={() => setCreateOpen(false)}
          schoolId={school.id}
          academicYears={academicYears}
          grades={grades}
          onCreated={() => {
            void refetch();
          }}
        />
      )}
    </PageContainer>
  );
}
