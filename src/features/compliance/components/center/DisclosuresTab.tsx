import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { LoadingBlock } from '@/components/ui/LoadingBlock';
import { TableScrollContainer } from '@/components/ui/TableScrollContainer';
import { useToast } from '@/components/ui/toast/useToast';
import { getDbErrorMessage } from '@/lib/dbErrors';
import type { DisclosureRecipientType } from '@/lib/database.types';
import { useAsyncData } from '@/features/compliance/hooks/useAsyncData';
import {
  getLearnerNames,
  getProfileNames,
  listDisclosures,
  recordDisclosure,
} from '@/features/compliance/services/complianceService';
import { EmptyRow, SectionTitle } from '@/features/compliance/components/ComplianceUi';
import { LearnerPicker, type PickedLearner } from '@/features/compliance/components/LearnerPicker';
import {
  SELECT_CLASS,
  TABLE_CLASS,
  TD_CLASS,
  TH_CLASS,
  formatDate,
  humanise,
} from '@/features/compliance/utils/formatting';

const RECIPIENT_TYPES: Array<{ value: DisclosureRecipientType; label: string }> = [
  { value: 'education_authority', label: 'Education authority (e.g. provincial DoE, SA-SAMS)' },
  { value: 'transfer_school', label: 'School the learner is transferring to' },
  { value: 'school_official', label: 'Contracted school official with a legitimate interest' },
  { value: 'health_safety_emergency', label: 'Health or safety emergency' },
  { value: 'court_order_or_subpoena', label: 'Court order or subpoena' },
  { value: 'parental_consent', label: 'With guardian consent (third-party sharing)' },
  { value: 'directory_information', label: 'Directory information (with consent)' },
  { value: 'other_lawful_basis', label: 'Other lawful basis' },
];

const DATA_CATEGORIES = [
  'identity',
  'enrolment',
  'attendance',
  'assessment',
  'report_cards',
  'behaviour',
  'medical',
  'financial',
  'contact_details',
];

export function DisclosuresTab({ schoolId, canManage }: { schoolId: string; canManage: boolean }) {
  const list = useAsyncData(
    async () => {
      const rows = await listDisclosures(schoolId);
      const [learners, people] = await Promise.all([
        getLearnerNames(rows.map((r) => r.learner_id)),
        getProfileNames(rows.map((r) => r.disclosed_by ?? '')),
      ]);
      return { rows, learners, people };
    },
    [schoolId],
    'Could not load disclosures.',
  );

  return (
    <div className="space-y-8">
      {canManage && <DisclosureForm schoolId={schoolId} onSaved={list.reload} />}
      <section>
        <SectionTitle description="FERPA §99.32 record of disclosures. Guardians see every disclosure of their child's record.">
          Disclosure log
        </SectionTitle>
        <ErrorAlert message={list.error} />
        {list.isLoading && !list.data ? (
          <LoadingBlock label="Loading disclosures…" />
        ) : (
          <TableScrollContainer>
            <table className={TABLE_CLASS}>
              <thead>
                <tr>
                  <th className={TH_CLASS}>Date</th>
                  <th className={TH_CLASS}>Learner</th>
                  <th className={TH_CLASS}>Disclosed to</th>
                  <th className={TH_CLASS}>Basis</th>
                  <th className={TH_CLASS}>Information</th>
                  <th className={TH_CLASS}>By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(list.data?.rows ?? []).length === 0 && (
                  <EmptyRow colSpan={6}>No disclosures recorded.</EmptyRow>
                )}
                {(list.data?.rows ?? []).map((d) => (
                  <tr key={d.id}>
                    <td className={TD_CLASS}>{formatDate(d.disclosed_at)}</td>
                    <td className={TD_CLASS}>
                      {list.data?.learners.get(d.learner_id)?.name ?? 'Learner'}
                    </td>
                    <td className={TD_CLASS}>{d.disclosed_to}</td>
                    <td className={TD_CLASS}>
                      {humanise(d.recipient_type)}
                      <span className="block text-xs text-content-secondary">{d.legal_basis}</span>
                    </td>
                    <td className={TD_CLASS}>{d.data_categories.map(humanise).join(', ')}</td>
                    <td className={TD_CLASS}>
                      {list.data?.people.get(d.disclosed_by ?? '') ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScrollContainer>
        )}
      </section>
    </div>
  );
}

function DisclosureForm({ schoolId, onSaved }: { schoolId: string; onSaved: () => void }) {
  const { showToast } = useToast();
  const [learner, setLearner] = useState<PickedLearner | null>(null);
  const [to, setTo] = useState('');
  const [type, setType] = useState<DisclosureRecipientType>('education_authority');
  const [basis, setBasis] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!learner) return;
    setBusy(true);
    setError(null);
    try {
      await recordDisclosure({
        learnerId: learner.id,
        disclosedTo: to.trim(),
        recipientType: type,
        legalBasis: basis.trim(),
        dataCategories: categories,
      });
      showToast('Disclosure recorded. The learner’s guardians can see it.', { variant: 'success' });
      setTo('');
      setBasis('');
      setCategories([]);
      onSaved();
    } catch (err) {
      setError(getDbErrorMessage(err, 'The disclosure could not be recorded.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-card border border-border bg-surface-raised p-4">
      <SectionTitle description="Record every release of a learner's record outside the school before or when you share it. Consent-based disclosures are refused unless the guardian has consented.">
        Record a disclosure
      </SectionTitle>
      <form onSubmit={(e) => void handleSubmit(e)} className="grid gap-3 md:grid-cols-2">
        <LearnerPicker schoolId={schoolId} value={learner} onChange={setLearner} />
        <div className="space-y-3">
          <TextField
            label="Disclosed to (organisation or person)"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            required
          />
          <label className="block text-sm font-medium text-content-primary">
            Basis
            <select
              className={`${SELECT_CLASS} mt-1`}
              value={type}
              onChange={(e) => setType(e.target.value as DisclosureRecipientType)}
            >
              {RECIPIENT_TYPES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <TextField
            label="Legal basis / purpose"
            value={basis}
            onChange={(e) => setBasis(e.target.value)}
            required
          />
        </div>
        <fieldset className="md:col-span-2">
          <legend className="text-sm font-medium text-content-primary">
            Information disclosed
          </legend>
          <div className="mt-2 flex flex-wrap gap-3">
            {DATA_CATEGORIES.map((c) => (
              <label key={c} className="flex items-center gap-2 text-sm text-content-secondary">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-brand-600"
                  checked={categories.includes(c)}
                  onChange={(e) =>
                    setCategories((prev) =>
                      e.target.checked ? [...prev, c] : prev.filter((x) => x !== c),
                    )
                  }
                />
                {humanise(c)}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="md:col-span-2">
          <ErrorAlert message={error} />
          <Button
            type="submit"
            isLoading={busy}
            disabled={
              !learner || to.trim().length < 2 || basis.trim().length < 3 || categories.length === 0
            }
          >
            Record disclosure
          </Button>
        </div>
      </form>
    </section>
  );
}
