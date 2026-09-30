import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { LoadingBlock } from '@/components/ui/LoadingBlock';
import { TableScrollContainer } from '@/components/ui/TableScrollContainer';
import { useToast } from '@/components/ui/toast/useToast';
import { getDbErrorMessage } from '@/lib/dbErrors';
import type { ConsentDecision, ConsentPurpose } from '@/lib/database.types';
import { useAsyncData } from '@/features/compliance/hooks/useAsyncData';
import {
  getLearnerNames,
  getProfileNames,
  listConsents,
  recordConsent,
} from '@/features/compliance/services/complianceService';
import {
  CONSENT_PURPOSES,
  CONSENT_PURPOSE_TITLE,
} from '@/features/compliance/constants/consentPurposes';
import { EmptyRow, MetricTile, SectionTitle } from '@/features/compliance/components/ComplianceUi';
import { LearnerPicker, type PickedLearner } from '@/features/compliance/components/LearnerPicker';
import {
  SELECT_CLASS,
  TABLE_CLASS,
  TD_CLASS,
  TH_CLASS,
  formatDateTime,
  humanise,
} from '@/features/compliance/utils/formatting';
import type { ComplianceOverview } from '@/features/compliance/types/compliance.types';

export function ConsentTab({
  schoolId,
  overview,
  canManage,
  onChanged,
}: {
  schoolId: string;
  overview: ComplianceOverview;
  canManage: boolean;
  onChanged: () => void;
}) {
  const ledger = useAsyncData(
    async () => {
      const rows = await listConsents(schoolId);
      const [learners, people] = await Promise.all([
        getLearnerNames(rows.map((r) => r.learner_id)),
        getProfileNames(rows.map((r) => r.guardian_profile_id ?? r.recorded_by ?? '')),
      ]);
      return { rows, learners, people };
    },
    [schoolId],
    'Could not load the consent ledger.',
  );
  const l = overview.learners;

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile
          label="Minors with a guardian decision"
          value={`${l.core_processing_decided}/${l.minors}`}
          tone={l.core_processing_decided < l.minors ? 'alert' : 'neutral'}
        />
        <MetricTile
          label={`Under ${overview.settings.coppa_consent_age}: online consent`}
          value={`${l.under_coppa_with_online_consent}/${l.under_coppa_age}`}
        />
        <MetricTile
          label="Logins without consent"
          value={l.online_accounts_without_consent}
          tone={l.online_accounts_without_consent ? 'alert' : 'neutral'}
          hint="Must be 0 — enforced by the database"
        />
        <MetricTile
          label="Granted / refused / withdrawn"
          value={`${overview.consents.granted}/${overview.consents.refused}/${overview.consents.withdrawn}`}
        />
      </div>

      {canManage && (
        <PaperConsentForm
          schoolId={schoolId}
          onSaved={() => {
            ledger.reload();
            onChanged();
          }}
        />
      )}

      <section>
        <SectionTitle description="Append-only: every decision is kept, so the full history of consent is provable.">
          Consent ledger
        </SectionTitle>
        {ledger.isLoading && !ledger.data ? (
          <LoadingBlock label="Loading consent ledger…" />
        ) : (
          <>
            <ErrorAlert message={ledger.error} />
            <TableScrollContainer>
              <table className={TABLE_CLASS}>
                <thead>
                  <tr>
                    <th className={TH_CLASS}>When</th>
                    <th className={TH_CLASS}>Learner</th>
                    <th className={TH_CLASS}>Purpose</th>
                    <th className={TH_CLASS}>Decision</th>
                    <th className={TH_CLASS}>Given by</th>
                    <th className={TH_CLASS}>Method</th>
                    <th className={TH_CLASS}>Notice</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(ledger.data?.rows ?? []).length === 0 && (
                    <EmptyRow colSpan={7}>No consent decisions recorded yet.</EmptyRow>
                  )}
                  {(ledger.data?.rows ?? []).map((r) => (
                    <tr key={r.id}>
                      <td className={TD_CLASS}>{formatDateTime(r.decided_at)}</td>
                      <td className={TD_CLASS}>
                        {ledger.data?.learners.get(r.learner_id)?.name ?? 'Learner'}
                      </td>
                      <td className={TD_CLASS}>{CONSENT_PURPOSE_TITLE[r.purpose]}</td>
                      <td className={TD_CLASS}>{humanise(r.decision)}</td>
                      <td className={TD_CLASS}>
                        {r.attested_name ?? '—'}
                        <span className="block text-xs text-content-secondary">
                          {ledger.data?.people.get(r.guardian_profile_id ?? r.recorded_by ?? '') ??
                            ''}
                        </span>
                      </td>
                      <td className={TD_CLASS}>{humanise(r.method)}</td>
                      <td className={TD_CLASS}>{r.policy_version}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScrollContainer>
          </>
        )}
      </section>
    </div>
  );
}

function PaperConsentForm({ schoolId, onSaved }: { schoolId: string; onSaved: () => void }) {
  const { showToast } = useToast();
  const [learner, setLearner] = useState<PickedLearner | null>(null);
  const [purpose, setPurpose] = useState<ConsentPurpose | ''>('');
  const [decision, setDecision] = useState<ConsentDecision | ''>('');
  const [signatory, setSignatory] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!learner || !purpose || !decision) return;
    setBusy(true);
    setError(null);
    try {
      await recordConsent({
        learnerId: learner.id,
        purpose,
        decision,
        attestedName: signatory.trim(),
        method: 'paper_form_recorded_by_staff',
      });
      showToast('Paper consent form recorded.', { variant: 'success' });
      setPurpose('');
      setDecision('');
      setSignatory('');
      onSaved();
    } catch (err) {
      setError(getDbErrorMessage(err, 'The consent form could not be recorded.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-card border border-border bg-surface-raised p-4">
      <SectionTitle description="For guardians without the app: capture the signed paper form. File the original — the ledger records who captured it.">
        Record a signed paper consent form
      </SectionTitle>
      <form onSubmit={(e) => void handleSubmit(e)} className="grid gap-3 md:grid-cols-2">
        <LearnerPicker schoolId={schoolId} value={learner} onChange={setLearner} />
        <div className="space-y-3">
          <label className="block text-sm font-medium text-content-primary">
            Purpose
            <select
              className={`${SELECT_CLASS} mt-1`}
              value={purpose}
              onChange={(e) => setPurpose(e.target.value as ConsentPurpose)}
              required
            >
              <option value="">Select a purpose</option>
              {CONSENT_PURPOSES.map((p) => (
                <option key={p.purpose} value={p.purpose}>
                  {p.title}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-content-primary">
            Decision on the form
            <select
              className={`${SELECT_CLASS} mt-1`}
              value={decision}
              onChange={(e) => setDecision(e.target.value as ConsentDecision)}
              required
            >
              <option value="">Select the decision</option>
              <option value="granted">Consent given</option>
              <option value="refused">Consent refused</option>
              <option value="withdrawn">Consent withdrawn</option>
            </select>
          </label>
          <TextField
            label="Guardian's name as signed"
            value={signatory}
            onChange={(e) => setSignatory(e.target.value)}
            required={decision === 'granted'}
          />
        </div>
        <div className="md:col-span-2">
          <ErrorAlert message={error} />
          <Button
            type="submit"
            isLoading={busy}
            disabled={
              !learner ||
              !purpose ||
              !decision ||
              (decision === 'granted' && signatory.trim().length < 3)
            }
          >
            Record form
          </Button>
        </div>
      </form>
    </section>
  );
}
