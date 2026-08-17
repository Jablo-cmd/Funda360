import { usePermissions } from '@/hooks/usePermissions';
import { useSchool } from '@/features/school/hooks/useSchool';
import { useLearnerReport } from '@/features/reports/hooks/useLearnerReport';
import { SummaryCard } from '@/features/reports/components/SummaryCard';
import { SummaryBar } from '@/features/reports/components/SummaryBar';
import { ExportCsvButton } from '@/features/reports/components/ExportCsvButton';
import { PageContainer } from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { LoadingBlock } from '@/components/ui/LoadingBlock';

export function LearnerReportPage() {
  const { can } = usePermissions();
  const canView = can('learner.view');
  const { school } = useSchool();
  const { data, isLoading, error } = useLearnerReport(canView ? school?.id : undefined);

  if (!canView) {
    return (
      <PageContainer>
        <ErrorAlert message="You don't have permission to view this report." />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Learner report"
        description="Enrollment counts broken down by status."
        action={
          data && (
            <ExportCsvButton
              rows={data.byStatus}
              columns={[
                { key: 'status', header: 'Status' },
                { key: 'count', header: 'Count' },
              ]}
              filename="learner-report.csv"
            />
          )
        }
      />

      <ErrorAlert message={error} />

      {isLoading ? (
        <LoadingBlock label="Loading learner report…" />
      ) : data && data.totalLearners > 0 ? (
        <>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <SummaryCard label="Total learners" value={data.totalLearners} />
          </dl>

          <section className="flex flex-col gap-4 rounded-card border border-border bg-surface-raised p-5 shadow-card sm:p-6 dark:shadow-card-dark">
            <h2 className="text-base font-semibold text-content-primary">By status</h2>
            {data.byStatus.map((entry) => (
              <SummaryBar key={entry.status} label={entry.status} count={entry.count} total={data.totalLearners} />
            ))}
          </section>
        </>
      ) : (
        <div className="rounded-card border border-border bg-surface-raised px-4 py-10 text-center text-sm text-content-tertiary">
          No data yet for this school.
        </div>
      )}
    </PageContainer>
  );
}
