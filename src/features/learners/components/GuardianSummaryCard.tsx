import { Card } from '@/components/ui/Card';
import { LoadingBlock } from '@/components/ui/LoadingBlock';
import type { LearnerGuardian } from '@/features/learners/types/learner.types';
import type { GuardianCandidate } from '@/features/learners/services/guardianService';
import { guardianRelationshipSummary, guardianSecondaryBadges } from '@/features/guardians/utils/guardianDisplay';

export interface GuardianSummaryCardProps {
  guardians: LearnerGuardian[];
  candidatesById: Record<string, GuardianCandidate>;
  isLoading: boolean;
  error: string | null;
  onViewAll: () => void;
}

export function GuardianSummaryCard({ guardians, candidatesById, isLoading, error, onViewAll }: GuardianSummaryCardProps) {
  const activeGuardians = [...guardians]
    .filter((guardian) => guardian.active)
    .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));

  return (
    <Card
      title="Guardian & Family"
      action={
        <button type="button" onClick={onViewAll} className="focus-ring rounded text-xs font-medium text-brand-600 hover:underline dark:text-brand-300">
          View all
        </button>
      }
    >
      {isLoading ? (
        <LoadingBlock label="Loading guardians…" compact />
      ) : error ? (
        <p className="text-sm text-danger-600">{error}</p>
      ) : activeGuardians.length === 0 ? (
        <p className="text-sm text-content-tertiary">No guardians linked to this learner yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {activeGuardians.map((guardian) => {
            const candidate = candidatesById[guardian.guardianProfileId];
            const badges = guardianSecondaryBadges(guardian);
            return (
              <div key={guardian.id}>
                <p className="text-sm font-medium text-content-primary">
                  {candidate ? `${candidate.firstName} ${candidate.lastName}` : '—'}
                </p>
                <p className="text-xs font-medium text-content-secondary">
                  {guardianRelationshipSummary(guardian)}
                  {badges.length > 0 && <span className="text-content-tertiary"> · {badges.join(' · ')}</span>}
                </p>
                <p className="text-xs text-content-tertiary">
                  {[candidate?.phone, candidate?.email].filter(Boolean).join(' · ') || '—'}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
