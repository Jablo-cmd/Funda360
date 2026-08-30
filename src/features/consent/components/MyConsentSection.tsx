import { useState } from 'react';
import { consentService } from '@/features/consent/services/consentService';
import { useConsentRecords } from '@/features/consent/hooks/useConsentRecords';
import { CONSENT_CATEGORIES, CONSENT_CATEGORY_LABELS, CONSENT_CATEGORY_DESCRIPTIONS } from '@/features/consent/constants/consentCategoryLabels';
import type { ConsentCategory } from '@/lib/database.types';
import { getDbErrorMessage } from '@/lib/dbErrors';

export interface MyConsentSectionProps {
  schoolId: string;
  learnerId: string;
  guardianProfileId: string;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * Guardian self-service consent capture — a fixed row per
 * CONSENT_CATEGORIES, always rendered (unlike the staff-facing
 * LearnerConsentSection, which only ever lists rows that already exist).
 * Toggling records the change immediately; RLS
 * (consent_records_insert/update's is_learner_guardian +
 * guardian_profile_id = auth.uid() clause) is the actual enforcement that
 * this guardian may only ever set their own consent, not another
 * guardian's.
 */
export function MyConsentSection({ schoolId, learnerId, guardianProfileId }: MyConsentSectionProps) {
  const { records, isLoading, error, refetch } = useConsentRecords(learnerId);
  const [savingCategory, setSavingCategory] = useState<ConsentCategory | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleToggle(category: ConsentCategory, granted: boolean) {
    setSavingCategory(category);
    setSaveError(null);
    try {
      await consentService.setConsent(schoolId, learnerId, { guardianProfileId, category, granted });
      await refetch();
    } catch (err) {
      setSaveError(getDbErrorMessage(err, 'Failed to update consent.'));
    } finally {
      setSavingCategory(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-content-tertiary">
        These choices apply only to your own consent for this child — other guardians linked to this child set their own separately.
      </p>

      {(error || saveError) && (
        <div role="alert" className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-600">
          {error ?? saveError}
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-content-tertiary">Loading…</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {CONSENT_CATEGORIES.map((category) => {
            const record = records.find((r) => r.category === category && r.guardianProfileId === guardianProfileId);
            const granted = record?.granted ?? false;
            const isSaving = savingCategory === category;
            return (
              <li key={category} className="rounded-card border border-border bg-surface-raised p-3.5">
                <label className="flex items-start gap-3" aria-label={CONSENT_CATEGORY_LABELS[category]}>
                  <input
                    type="checkbox"
                    checked={granted}
                    disabled={isSaving}
                    onChange={(event) => void handleToggle(category, event.target.checked)}
                    className="focus-ring mt-0.5 h-4 w-4 rounded border-border-strong"
                  />
                  <span className="flex flex-col">
                    <span className="text-sm font-medium text-content-primary">{CONSENT_CATEGORY_LABELS[category]}</span>
                    <span className="mt-0.5 text-xs text-content-tertiary">{CONSENT_CATEGORY_DESCRIPTIONS[category]}</span>
                    <span className="mt-1 text-[11px] text-content-tertiary">
                      {granted && record?.grantedAt
                        ? `Granted ${formatDate(record.grantedAt)}`
                        : !granted && record?.revokedAt
                          ? `Withdrawn ${formatDate(record.revokedAt)}`
                          : 'Not yet responded'}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
