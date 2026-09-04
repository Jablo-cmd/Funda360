import { useState } from 'react';
import { PageContainer } from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { LoadingBlock } from '@/components/ui/LoadingBlock';
import { NoActiveSchoolNotice } from '@/components/ui/NoActiveSchoolNotice';
import { Button } from '@/components/ui/Button';
import { usePermissions } from '@/hooks/usePermissions';
import { useSchool } from '@/features/school/hooks/useSchool';
import { useGradingScales } from '@/features/reportCards/hooks/useGradingScales';
import { gradingScaleService } from '@/features/reportCards/services/gradingScaleService';
import { GradingScaleFormModal } from '@/features/reportCards/components/GradingScaleFormModal';
import type { GradingScaleWithBands } from '@/features/reportCards/types/reportCard.types';
import { getDbErrorMessage } from '@/lib/dbErrors';
import { useToast } from '@/components/ui/toast/useToast';

export function GradingScalesPage() {
  const { can } = usePermissions();
  const canManage = can('reportcard.manage');
  const { school } = useSchool();
  const { scales, isLoading, error, refetch } = useGradingScales(school?.id);
  const { showToast } = useToast();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<GradingScaleWithBands | undefined>(undefined);
  const [rowError, setRowError] = useState<string | null>(null);

  const openNew = () => {
    setEditing(undefined);
    setModalOpen(true);
  };
  const openEdit = (scale: GradingScaleWithBands) => {
    setEditing(scale);
    setModalOpen(true);
  };

  const archive = async (scale: GradingScaleWithBands) => {
    setRowError(null);
    try {
      await gradingScaleService.archiveScale(scale.id);
      showToast(`Archived “${scale.name}”.`, { variant: 'success' });
      await refetch();
    } catch (err) {
      setRowError(getDbErrorMessage(err, 'Failed to archive the scale.'));
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Grading Scales"
        description="Percentage-to-achievement mappings used by report-card templates."
        action={canManage && school ? <Button onClick={openNew}>New scale</Button> : undefined}
      />

      <ErrorAlert message={error ?? rowError} />

      {!school ? (
        <NoActiveSchoolNotice resource="grading scales" />
      ) : isLoading ? (
        <LoadingBlock label="Loading grading scales…" />
      ) : scales.length === 0 ? (
        <p className="rounded-card border border-border bg-surface-raised px-4 py-10 text-center text-sm text-content-tertiary">
          No grading scales yet.{canManage ? ' Create one to start building report-card templates.' : ''}
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {scales.map((scale) => (
            <li key={scale.id} className="rounded-card border border-border bg-surface-raised p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-content-primary">{scale.name}</span>
                  {scale.isDefault && (
                    <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
                      Default
                    </span>
                  )}
                </div>
                {canManage && (
                  <div className="flex gap-1">
                    <Button variant="ghost" onClick={() => openEdit(scale)}>
                      Edit
                    </Button>
                    <Button variant="ghost" onClick={() => archive(scale)}>
                      Archive
                    </Button>
                  </div>
                )}
              </div>
              {scale.description && <p className="mt-1 text-xs text-content-tertiary">{scale.description}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                {scale.bands.map((band) => (
                  <span key={band.id} className="rounded-md border border-border px-2 py-1 text-xs text-content-secondary">
                    <span className="font-semibold">{band.code}</span> · {band.minPercentage}–{band.maxPercentage}% · {band.label}
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}

      {school && (
        <GradingScaleFormModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          schoolId={school.id}
          scale={editing}
          onSaved={() => {
            showToast('Grading scale saved.', { variant: 'success' });
            void refetch();
          }}
        />
      )}
    </PageContainer>
  );
}
