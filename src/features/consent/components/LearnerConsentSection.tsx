import { useEffect, useState } from 'react';
import { useGuardians } from '@/features/learners/hooks/useGuardians';
import { guardianService } from '@/features/learners/services/guardianService';
import type { GuardianCandidate } from '@/features/learners/services/guardianService';
import { consentService } from '@/features/consent/services/consentService';
import { useConsentRecords } from '@/features/consent/hooks/useConsentRecords';
import { CONSENT_CATEGORIES, CONSENT_CATEGORY_LABELS } from '@/features/consent/constants/consentCategoryLabels';
import type { ConsentCategory } from '@/lib/database.types';
import { getDbErrorMessage } from '@/lib/dbErrors';

export interface LearnerConsentSectionProps {
  schoolId: string;
  learnerId: string;
  canManage: boolean;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * Staff view of every guardian's consent for this learner, across the
 * three categories CONSENT_CATEGORIES defines — see
 * 20260829270000_consent_management.sql's migration header for what
 * "consent" does and does not cover here (no core-data-processing
 * category; that remains an unresolved legal question, not something
 * this UI decides). canManage lets staff capture consent on a guardian's
 * behalf (e.g. a signed paper form at enrollment) — RLS
 * (can_manage_learners) is the real enforcement, this prop only hides
 * controls a call would be rejected for anyway.
 */
export function LearnerConsentSection({ schoolId, learnerId, canManage }: LearnerConsentSectionProps) {
  const { guardians, isLoading: isLoadingGuardians, error: guardiansError } = useGuardians(learnerId);
  const { records, isLoading: isLoadingRecords, error: recordsError, refetch } = useConsentRecords(learnerId);
  const [candidatesById, setCandidatesById] = useState<Record<string, GuardianCandidate>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const activeGuardians = guardians.filter((g) => g.active);

  useEffect(() => {
    const ids = activeGuardians.map((g) => g.guardianProfileId);
    if (ids.length === 0) return;
    void guardianService.getGuardianCandidatesByIds(ids).then((candidates) => {
      setCandidatesById((prev) => {
        const next = { ...prev };
        for (const candidate of candidates) next[candidate.id] = candidate;
        return next;
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guardians.length]);

  async function handleToggle(guardianProfileId: string, category: ConsentCategory, granted: boolean) {
    const key = `${guardianProfileId}:${category}`;
    setSavingKey(key);
    setSaveError(null);
    try {
      await consentService.setConsent(schoolId, learnerId, { guardianProfileId, category, granted });
      await refetch();
    } catch (err) {
      setSaveError(getDbErrorMessage(err, 'Failed to update consent.'));
    } finally {
      setSavingKey(null);
    }
  }

  const isLoading = isLoadingGuardians || isLoadingRecords;
  const error = guardiansError ?? recordsError ?? saveError;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-content-tertiary">
        Categories captured: {CONSENT_CATEGORIES.map((c) => CONSENT_CATEGORY_LABELS[c]).join(', ')}. Each guardian sets their own consent —
        this does not cover core enrollment data processing (see FND-SEC-009 for the legal-review status of that separate question).
      </p>

      {error && (
        <div role="alert" className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-600">
          {error}
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-content-tertiary">Loading…</p>
      ) : activeGuardians.length === 0 ? (
        <p className="rounded-card border border-border bg-surface-raised p-4 text-sm text-content-tertiary">
          No guardians linked to this learner yet — consent can be recorded once a guardian is linked.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {activeGuardians.map((guardian) => {
            const candidate = candidatesById[guardian.guardianProfileId];
            return (
              <li key={guardian.id} className="rounded-card border border-border bg-surface-raised p-3.5">
                <p className="text-sm font-medium text-content-primary">
                  {candidate ? `${candidate.firstName} ${candidate.lastName}` : 'Guardian'}{' '}
                  <span className="font-normal capitalize text-content-tertiary">({guardian.relationshipType})</span>
                </p>
                <ul className="mt-2.5 flex flex-col gap-2">
                  {CONSENT_CATEGORIES.map((category) => {
                    const record = records.find((r) => r.category === category && r.guardianProfileId === guardian.guardianProfileId);
                    const granted = record?.granted ?? false;
                    const key = `${guardian.guardianProfileId}:${category}`;
                    const isSaving = savingKey === key;
                    return (
                      <li key={category} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <label className="flex items-center gap-2 text-content-secondary">
                          <input
                            type="checkbox"
                            checked={granted}
                            disabled={!canManage || isSaving}
                            onChange={(event) => void handleToggle(guardian.guardianProfileId, category, event.target.checked)}
                            className="focus-ring h-4 w-4 rounded border-border-strong"
                          />
                          {CONSENT_CATEGORY_LABELS[category]}
                        </label>
                        <span className="text-[11px] text-content-tertiary">
                          {granted && record?.grantedAt
                            ? `Granted ${formatDate(record.grantedAt)}`
                            : !granted && record?.revokedAt
                              ? `Withdrawn ${formatDate(record.revokedAt)}`
                              : 'Not yet responded'}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
