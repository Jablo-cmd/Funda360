import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useInterventions } from '@/features/learners/hooks/useInterventions';
import { InterventionFormModal } from '@/features/learners/components/InterventionFormModal';
import { UpdateInterventionStatusDialog } from '@/features/learners/components/UpdateInterventionStatusDialog';
import type { AcademicIntervention, AcademicInterventionStatus } from '@/features/learners/types/intervention.types';
import type { Subject } from '@/features/academic/types/academic.types';

export interface LearnerInterventionsSectionProps {
  schoolId: string;
  learnerId: string;
  academicYearId: string | undefined;
  subjects: Subject[];
  subjectsById: Record<string, Subject>;
  canManage: boolean;
}

const STATUS_STYLES: Record<AcademicInterventionStatus, string> = {
  open: 'bg-danger-50 text-danger-600',
  in_progress: 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200',
  resolved: 'bg-success-500/10 text-success-500',
};

const STATUS_LABELS: Record<AcademicInterventionStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  resolved: 'Resolved',
};

function formatDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** A persisted, actionable academic-support record for the learner (FND-ACA-006) — distinct from the transient "Academic average below X%" banner deriveLearnerAlerts computes on every page load, which stays exactly as-is; this is the durable thing staff can act on. */
export function LearnerInterventionsSection({
  schoolId,
  learnerId,
  academicYearId,
  subjects,
  subjectsById,
  canManage,
}: LearnerInterventionsSectionProps) {
  const { interventions, isLoading, error, refetch } = useInterventions(learnerId);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [statusTarget, setStatusTarget] = useState<AcademicIntervention | null>(null);

  return (
    <div className="flex flex-col gap-4">
      {canManage && academicYearId && (
        <div className="flex justify-end">
          <div className="w-full sm:w-auto sm:min-w-[9rem]">
            <Button type="button" onClick={() => setIsFormOpen(true)}>
              Record intervention
            </Button>
          </div>
        </div>
      )}

      {error && (
        <div role="alert" className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-600">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <span
            aria-hidden="true"
            className="h-8 w-8 animate-spin-smooth rounded-full border-2 border-brand-600 border-t-transparent"
          />
          <span className="sr-only">Loading academic interventions…</span>
        </div>
      ) : interventions.length === 0 ? (
        <p className="rounded-card border border-border bg-surface-raised p-6 text-sm text-content-tertiary">
          No academic interventions recorded for this learner.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {interventions.map((intervention) => (
            <li key={intervention.id} className="rounded-card border border-border bg-surface-raised p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-content-primary">{intervention.title}</p>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[intervention.status]}`}>
                      {STATUS_LABELS[intervention.status]}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-content-tertiary">
                    {intervention.subjectId ? subjectsById[intervention.subjectId]?.name ?? 'Unknown subject' : 'General'}
                    {intervention.targetDate ? ` · Review by ${formatDate(intervention.targetDate)}` : ''}
                  </p>
                  {intervention.description && <p className="mt-2 text-sm text-content-secondary">{intervention.description}</p>}
                  {intervention.status === 'resolved' && intervention.resolutionNotes && (
                    <p className="mt-2 text-sm text-success-600">Resolution: {intervention.resolutionNotes}</p>
                  )}
                </div>
                {canManage && (
                  <div className="w-full sm:w-auto sm:min-w-[9rem]">
                    <Button type="button" variant="secondary" onClick={() => setStatusTarget(intervention)}>
                      Update status
                    </Button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {academicYearId && (
        <InterventionFormModal
          isOpen={isFormOpen}
          onClose={() => setIsFormOpen(false)}
          schoolId={schoolId}
          learnerId={learnerId}
          academicYearId={academicYearId}
          subjects={subjects}
          onSaved={() => void refetch()}
        />
      )}
      {statusTarget && (
        <UpdateInterventionStatusDialog
          isOpen
          onClose={() => setStatusTarget(null)}
          intervention={statusTarget}
          onChanged={() => void refetch()}
        />
      )}
    </div>
  );
}
