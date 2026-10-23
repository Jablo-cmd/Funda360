import { Link, useParams } from 'react-router-dom';
import { PageContainer } from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { LoadingBlock } from '@/components/ui/LoadingBlock';
import { DataTable } from '@/components/ui/DataTable';
import type { DataTableColumn } from '@/components/ui/DataTable';
import { useAuth } from '@/features/auth/context/authContext';
import { useClassLearnerReport } from '@/features/government/hooks/useGovernmentReports';
import { useReportFilters } from '@/features/government/hooks/useReportFilters';
import { ReportExportButtons } from '@/features/government/components/ReportExportButtons';
import { formatPercent } from '@/features/government/utils/reportDefinitions';
import type { ClassLearnerRow } from '@/features/government/types/government.types';

/**
 * Class -> Learner. get_class_learner_report() requires learner-level
 * access to the school and writes every view to the audit log.
 */
export function DistrictClassPage() {
  const { schoolId, classId } = useParams<{ schoolId: string; classId: string }>();
  const [filters, , filterQuery] = useReportFilters();
  const { user } = useAuth();
  const { data, isLoading, error } = useClassLearnerReport(classId, filters);

  const columns: DataTableColumn<ClassLearnerRow>[] = [
    { key: 'name', header: 'Learner', render: (l) => <span className="font-medium">{`${l.first_name} ${l.last_name}`}</span> },
    { key: 'number', header: 'Learner number', render: (l) => l.learner_number ?? '—' },
    { key: 'attendance', header: 'Attendance', align: 'right', render: (l) => formatPercent(l.attendance_rate) },
    { key: 'absent', header: 'Days absent', align: 'right', render: (l) => l.absent_days },
    { key: 'average', header: 'Average mark', align: 'right', render: (l) => formatPercent(l.average_percent) },
    { key: 'interventions', header: 'Open interventions', align: 'right', render: (l) => l.open_interventions },
    {
      key: 'status',
      header: 'Status',
      render: (l) =>
        l.requires_intervention ? (
          <span className="text-xs font-medium text-danger-600">Requires intervention</span>
        ) : (
          <span className="text-xs font-medium text-success-500">On track</span>
        ),
    },
  ];

  const table = data
    ? {
        columns: [
          { key: 'learner', header: 'Learner' },
          { key: 'number', header: 'Learner number' },
          { key: 'attendance', header: 'Attendance %', numeric: true },
          { key: 'absent', header: 'Days absent', numeric: true },
          { key: 'average', header: 'Average mark %', numeric: true },
          { key: 'interventions', header: 'Open interventions', numeric: true },
          { key: 'status', header: 'Status' },
        ],
        rows: data.learners.map((l) => ({
          learner: `${l.first_name} ${l.last_name}`,
          number: l.learner_number,
          attendance: l.attendance_rate,
          absent: l.absent_days,
          average: l.average_percent,
          interventions: l.open_interventions,
          status: l.requires_intervention ? 'Requires intervention' : 'On track',
        })),
      }
    : null;

  return (
    <PageContainer>
      <Link to={`/district/schools/${schoolId}${filterQuery}`} className="text-sm text-content-tertiary">
        ← School
      </Link>
      <PageHeader
        title={data ? `${data.class.grade} · ${data.class.name}` : 'Class'}
        description="Learner-level figures. This view is recorded in the audit log."
        action={
          table && data ? (
            <ReportExportButtons
              reportId="class_learners"
              table={table}
              filters={{ ...filters, school_id: schoolId }}
              meta={{
                title: `${data.class.grade} ${data.class.name}: learners`,
                description: 'Attendance, marks and interventions per learner. Confidential: contains learner names.',
                scope: `Class ${data.class.name}`,
                generatedAt: new Date(data.generated_at).toLocaleString('en-ZA'),
                generatedBy: user?.email ?? 'Funda360 user',
              }}
            />
          ) : undefined
        }
      />
      <ErrorAlert message={error} />
      {isLoading && <LoadingBlock label="Loading learners…" />}
      {data && (
        <DataTable columns={columns} rows={data.learners} getRowKey={(l) => l.id} emptyMessage="No learners are enrolled in this class for the period." />
      )}
    </PageContainer>
  );
}
