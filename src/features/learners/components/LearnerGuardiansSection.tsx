import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useGuardians } from '@/features/learners/hooks/useGuardians';
import { guardianService } from '@/features/learners/services/guardianService';
import type { GuardianCandidate } from '@/features/learners/services/guardianService';
import { GuardiansTable } from '@/features/learners/components/GuardiansTable';
import { GuardianFormModal } from '@/features/learners/components/GuardianFormModal';
import type { LearnerGuardian } from '@/features/learners/types/learner.types';

export interface LearnerGuardiansSectionProps {
  schoolId: string;
  learnerId: string;
  canManage: boolean;
}

export function LearnerGuardiansSection({ schoolId, learnerId, canManage }: LearnerGuardiansSectionProps) {
  const { guardians, isLoading, error, refetch } = useGuardians(learnerId);
  const [candidatesById, setCandidatesById] = useState<Record<string, GuardianCandidate>>({});
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingGuardian, setEditingGuardian] = useState<LearnerGuardian | null>(null);

  const guardianProfileIds = useMemo(() => guardians.map((guardian) => guardian.guardianProfileId), [guardians]);

  useEffect(() => {
    const missingIds = guardianProfileIds.filter((id) => !candidatesById[id]);
    if (missingIds.length === 0) return;
    void guardianService.getGuardianCandidatesByIds(missingIds).then((results) => {
      setCandidatesById((prev) => {
        const next = { ...prev };
        for (const candidate of results) next[candidate.id] = candidate;
        return next;
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guardianProfileIds]);

  const openCreate = () => {
    setEditingGuardian(null);
    setIsFormOpen(true);
  };

  const openEdit = (guardian: LearnerGuardian) => {
    setEditingGuardian(guardian);
    setIsFormOpen(true);
  };

  return (
    <div className="flex flex-col gap-4">
      {canManage && (
        <div className="flex justify-end">
          <div className="w-full sm:w-auto sm:min-w-[9rem]">
            <Button type="button" onClick={openCreate}>
              Add guardian
            </Button>
          </div>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-600"
        >
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-10">
          <span
            aria-hidden="true"
            className="h-6 w-6 animate-spin-smooth rounded-full border-2 border-brand-600 border-t-transparent"
          />
        </div>
      ) : (
        <GuardiansTable
          guardians={guardians}
          candidatesById={candidatesById}
          canManage={canManage}
          onEdit={openEdit}
        />
      )}

      <GuardianFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        schoolId={schoolId}
        learnerId={learnerId}
        guardian={editingGuardian}
        onSaved={(_, candidate) => {
          if (candidate) setCandidatesById((prev) => ({ ...prev, [candidate.id]: candidate }));
          void refetch();
        }}
      />
    </div>
  );
}
