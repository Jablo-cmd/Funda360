import type { LearnerGuardian } from '@/features/learners/types/learner.types';
import type { GuardianCandidate } from '@/features/learners/services/guardianService';

export interface GuardiansTableProps {
  guardians: LearnerGuardian[];
  candidatesById: Record<string, GuardianCandidate>;
  canManage: boolean;
  onEdit: (guardian: LearnerGuardian) => void;
}

export function GuardiansTable({ guardians, candidatesById, canManage, onEdit }: GuardiansTableProps) {
  if (guardians.length === 0) {
    return (
      <div className="rounded-card border border-border bg-surface-raised px-4 py-10 text-center text-sm text-content-tertiary">
        No guardians linked yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-card border border-border bg-surface-raised">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wide text-content-tertiary">
            <th scope="col" className="px-4 py-3 font-medium">
              Name
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Relationship
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Primary
            </th>
            {canManage && (
              <th scope="col" className="px-4 py-3 text-right font-medium">
                Actions
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {guardians.map((guardian) => {
            const candidate = candidatesById[guardian.guardianProfileId];
            return (
              <tr key={guardian.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-medium text-content-primary">
                  {candidate ? `${candidate.firstName} ${candidate.lastName}` : guardian.guardianProfileId}
                </td>
                <td className="px-4 py-3 capitalize text-content-secondary">
                  {guardian.relationshipType.replace(/_/g, ' ')}
                </td>
                <td className="px-4 py-3 text-content-secondary">{guardian.isPrimary ? 'Yes' : 'No'}</td>
                {canManage && (
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => onEdit(guardian)}
                        className="focus-ring rounded-md px-2 py-1 text-xs font-medium text-content-secondary hover:bg-surface-sunken hover:text-content-primary"
                      >
                        Edit
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
