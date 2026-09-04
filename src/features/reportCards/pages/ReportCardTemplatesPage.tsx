import { useState } from 'react';
import { PageContainer } from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { LoadingBlock } from '@/components/ui/LoadingBlock';
import { NoActiveSchoolNotice } from '@/components/ui/NoActiveSchoolNotice';
import { Button } from '@/components/ui/Button';
import { usePermissions } from '@/hooks/usePermissions';
import { useSchool } from '@/features/school/hooks/useSchool';
import { useReportCardTemplates } from '@/features/reportCards/hooks/useReportCardTemplates';
import { useGradingScales } from '@/features/reportCards/hooks/useGradingScales';
import { reportCardService } from '@/features/reportCards/services/reportCardService';
import { ReportCardTemplateFormModal } from '@/features/reportCards/components/ReportCardTemplateFormModal';
import type { ReportCardTemplate } from '@/features/reportCards/types/reportCard.types';
import { getDbErrorMessage } from '@/lib/dbErrors';
import { useToast } from '@/components/ui/toast/useToast';

export function ReportCardTemplatesPage() {
  const { can } = usePermissions();
  const canManage = can('reportcard.manage');
  const { school } = useSchool();
  const { templates, isLoading, error, refetch } = useReportCardTemplates(school?.id);
  const { scales, isLoading: scalesLoading } = useGradingScales(school?.id);
  const { showToast } = useToast();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ReportCardTemplate | undefined>(undefined);
  const [rowError, setRowError] = useState<string | null>(null);

  const scaleName = (id: string) => scales.find((s) => s.id === id)?.name ?? 'Unknown scale';

  const archive = async (template: ReportCardTemplate) => {
    setRowError(null);
    try {
      await reportCardService.archiveTemplate(template.id);
      showToast(`Archived “${template.name}”.`, { variant: 'success' });
      await refetch();
    } catch (err) {
      setRowError(getDbErrorMessage(err, 'Failed to archive the template.'));
    }
  };

  const noScales = !scalesLoading && scales.length === 0;

  return (
    <PageContainer>
      <PageHeader
        title="Report-Card Templates"
        description="Configurable layouts — sections, HOD review, and the grading scale each card uses."
        action={
          canManage && school && !noScales ? (
            <Button
              onClick={() => {
                setEditing(undefined);
                setModalOpen(true);
              }}
            >
              New template
            </Button>
          ) : undefined
        }
      />

      <ErrorAlert message={error ?? rowError} />

      {!school ? (
        <NoActiveSchoolNotice resource="report-card templates" />
      ) : isLoading || scalesLoading ? (
        <LoadingBlock label="Loading templates…" />
      ) : noScales ? (
        <p className="rounded-card border border-border bg-surface-raised px-4 py-10 text-center text-sm text-content-tertiary">
          Create a grading scale first — a template needs one to resolve achievement codes.
        </p>
      ) : templates.length === 0 ? (
        <p className="rounded-card border border-border bg-surface-raised px-4 py-10 text-center text-sm text-content-tertiary">
          No templates yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {templates.map((template) => (
            <li key={template.id} className="rounded-card border border-border bg-surface-raised p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-content-primary">{template.name}</span>
                  {template.isDefault && (
                    <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
                      Default
                    </span>
                  )}
                  {template.requiresHodReview && (
                    <span className="rounded-full bg-warning-50 px-2 py-0.5 text-[11px] font-medium text-warning-600 dark:bg-warning-500/15 dark:text-warning-500">
                      HOD review required
                    </span>
                  )}
                </div>
                {canManage && (
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setEditing(template);
                        setModalOpen(true);
                      }}
                    >
                      Edit
                    </Button>
                    <Button variant="ghost" onClick={() => archive(template)}>
                      Archive
                    </Button>
                  </div>
                )}
              </div>
              <p className="mt-1 text-xs text-content-tertiary">Grading scale: {scaleName(template.gradingScaleId)}</p>
            </li>
          ))}
        </ul>
      )}

      {school && (
        <ReportCardTemplateFormModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          schoolId={school.id}
          scales={scales}
          template={editing}
          onSaved={() => {
            showToast('Template saved.', { variant: 'success' });
            void refetch();
          }}
        />
      )}
    </PageContainer>
  );
}
