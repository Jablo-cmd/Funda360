import { useState, type FormEvent } from 'react';
import { PageContainer } from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { LoadingBlock } from '@/components/ui/LoadingBlock';
import { TableScrollContainer } from '@/components/ui/TableScrollContainer';
import { ComplianceBadge } from '@/components/ui/complianceIcons';
import { useToast } from '@/components/ui/toast/useToast';
import { useAuth } from '@/features/auth/context/authContext';
import { useCurrentSchool } from '@/features/tenant/hooks/useCurrentSchool';
import { getDbErrorMessage } from '@/lib/dbErrors';
import type {
  AmendmentRecordArea,
  DsarRequestType,
  RecordAmendmentRequestRow,
} from '@/lib/database.types';
import { useAsyncData } from '@/features/compliance/hooks/useAsyncData';
import {
  createDataSubjectRequest,
  getLearnerPrivacyHistory,
  getLearnerRecordPackage,
  getMyPrivacyOverview,
  respondToDenial,
  submitAmendment,
} from '@/features/compliance/services/complianceService';
import { ConsentDecisionForm } from '@/features/compliance/components/ConsentDecisionForm';
import { SectionTitle, EmptyRow } from '@/features/compliance/components/ComplianceUi';
import {
  SELECT_CLASS,
  TABLE_CLASS,
  TD_CLASS,
  TEXTAREA_CLASS,
  TH_CLASS,
  formatDate,
  formatDateTime,
  humanise,
} from '@/features/compliance/utils/formatting';
import {
  downloadTextFile,
  exportFileBase,
  recordPackageToCsv,
  recordPackageToJson,
  recordPackageToPdf,
} from '@/features/compliance/utils/recordExport';
import type { PrivacyChild } from '@/features/compliance/types/compliance.types';

const AMENDMENT_AREAS: AmendmentRecordArea[] = [
  'personal_details',
  'attendance',
  'assessment',
  'report_card',
  'behaviour',
  'medical',
  'financial',
  'other',
];

/**
 * The family's privacy dashboard (FERPA rights of access, amendment and
 * disclosure control; POPIA s.23–25; GDPR Art. 15–21). Used by guardians at
 * /parent/privacy and by learners at /learner/privacy — a learner sees their
 * own record and history, but consent stays with their guardians.
 */
export function PrivacyCenterPage() {
  const { user } = useAuth();
  const school = useCurrentSchool();
  const isLearner = user?.role === 'learner';
  const overview = useAsyncData(
    getMyPrivacyOverview,
    [],
    'Could not load your privacy information.',
  );
  const [learnerId, setLearnerId] = useState<string | null>(null);

  const children = overview.data?.children ?? [];
  const child = children.find((c) => c.learner_id === learnerId) ?? children[0] ?? null;

  return (
    <PageContainer>
      <PageHeader
        title="Privacy & Records"
        description={
          isLearner
            ? 'See your education record, download it, and see who has accessed it.'
            : "Control how your child's information is used, download their full record, and see every access and disclosure."
        }
      />

      <div className="flex flex-wrap gap-3" aria-label="Protections that apply to this record">
        {(['popia', 'ferpa', 'gdpr', 'coppa', 'cipa'] as const).map((icon) => (
          <div
            key={icon}
            className="flex items-center gap-2 rounded-card border border-border bg-surface-raised px-3 py-2 text-sm font-semibold text-content-primary"
          >
            <ComplianceBadge icon={icon} size="sm" />
            {icon === 'popia' ? 'POPIA' : icon.toUpperCase()} protected
          </div>
        ))}
      </div>

      {overview.isLoading && !overview.data && (
        <LoadingBlock label="Loading your privacy information…" />
      )}
      <ErrorAlert message={overview.error} />

      {overview.data?.settings.information_officer_email && (
        <p className="text-sm text-content-secondary">
          Questions or complaints:{' '}
          {overview.data.settings.information_officer_name ?? 'Information Officer'} ·{' '}
          <a
            className="font-medium text-brand-600 underline-offset-2 hover:underline dark:text-brand-300"
            href={`mailto:${overview.data.settings.information_officer_email}`}
          >
            {overview.data.settings.information_officer_email}
          </a>
          . You may also complain to the Information Regulator (South Africa).
        </p>
      )}

      {overview.data && children.length === 0 && (
        <Card title="No linked records">
          <p className="text-sm text-content-secondary">
            There are no learner records linked to your account.
          </p>
        </Card>
      )}

      {children.length > 1 && (
        <label className="block max-w-sm text-sm font-medium text-content-primary">
          Showing records for
          <select
            className={`${SELECT_CLASS} mt-1`}
            value={child?.learner_id ?? ''}
            onChange={(e) => setLearnerId(e.target.value)}
          >
            {children.map((c) => (
              <option key={c.learner_id} value={c.learner_id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {child && overview.data && school && (
        <ChildPrivacy
          key={child.learner_id}
          child={child}
          isLearner={isLearner}
          schoolId={school.id}
          privacyNoticeVersion={overview.data.settings.privacy_notice_version}
          amendments={overview.data.amendments.filter((a) => a.learner_id === child.learner_id)}
          onChanged={overview.reload}
        />
      )}

      {overview.data && overview.data.requests.length > 0 && (
        <Card title="My data requests">
          <TableScrollContainer>
            <table className={TABLE_CLASS}>
              <thead>
                <tr>
                  <th className={TH_CLASS}>Request</th>
                  <th className={TH_CLASS}>Submitted</th>
                  <th className={TH_CLASS}>Respond by</th>
                  <th className={TH_CLASS}>Status</th>
                  <th className={TH_CLASS}>Outcome</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {overview.data.requests.map((r) => (
                  <tr key={r.id}>
                    <td className={TD_CLASS}>{humanise(r.request_type)}</td>
                    <td className={TD_CLASS}>{formatDate(r.requested_at)}</td>
                    <td className={TD_CLASS}>{formatDate(r.due_at)}</td>
                    <td className={TD_CLASS}>{humanise(r.status)}</td>
                    <td className={TD_CLASS}>{r.outcome_notes ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScrollContainer>
        </Card>
      )}
    </PageContainer>
  );
}

interface ChildPrivacyProps {
  child: PrivacyChild;
  isLearner: boolean;
  schoolId: string;
  privacyNoticeVersion: string;
  amendments: RecordAmendmentRequestRow[];
  onChanged: () => void;
}

function ChildPrivacy({
  child,
  isLearner,
  schoolId,
  privacyNoticeVersion,
  amendments,
  onChanged,
}: ChildPrivacyProps) {
  const history = useAsyncData(
    () => getLearnerPrivacyHistory(child.learner_id),
    [child.learner_id],
    'Could not load the access history.',
  );
  const canRequestAmendment = !isLearner || child.age >= 18;

  return (
    <div className="space-y-6">
      {!isLearner && (
        <Card title={`Consent for ${child.name}`}>
          <ConsentDecisionForm
            child={child}
            privacyNoticeVersion={privacyNoticeVersion}
            required={[]}
            onSaved={onChanged}
          />
        </Card>
      )}

      <DownloadRecord child={child} onExported={history.reload} />

      <Card title="Who has accessed this record">
        <p className="mb-3 text-sm text-content-secondary">
          Every time school staff open, export or print {isLearner ? 'your' : `${child.name}'s`}{' '}
          record it is logged here.
        </p>
        <ErrorAlert message={history.error} />
        {history.isLoading && !history.data ? (
          <LoadingBlock label="Loading access history…" compact />
        ) : (
          <TableScrollContainer>
            <table className={TABLE_CLASS}>
              <thead>
                <tr>
                  <th className={TH_CLASS}>When</th>
                  <th className={TH_CLASS}>Who</th>
                  <th className={TH_CLASS}>Role</th>
                  <th className={TH_CLASS}>What</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(history.data?.access ?? []).length === 0 && (
                  <EmptyRow colSpan={4}>No access has been logged yet.</EmptyRow>
                )}
                {(history.data?.access ?? []).slice(0, 100).map((a, i) => (
                  <tr key={`${a.at}-${i}`}>
                    <td className={TD_CLASS}>{formatDateTime(a.at)}</td>
                    <td className={TD_CLASS}>{a.by}</td>
                    <td className={TD_CLASS}>{humanise(a.role)}</td>
                    <td className={TD_CLASS}>
                      {humanise(a.type)} — {a.context}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScrollContainer>
        )}
      </Card>

      <Card title="Disclosures to outside organisations">
        <TableScrollContainer>
          <table className={TABLE_CLASS}>
            <thead>
              <tr>
                <th className={TH_CLASS}>Date</th>
                <th className={TH_CLASS}>Shared with</th>
                <th className={TH_CLASS}>Basis</th>
                <th className={TH_CLASS}>Information</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(history.data?.disclosures ?? []).length === 0 && (
                <EmptyRow colSpan={4}>
                  This record has not been disclosed to anyone outside the school.
                </EmptyRow>
              )}
              {(history.data?.disclosures ?? []).map((d, i) => (
                <tr key={`${d.at}-${i}`}>
                  <td className={TD_CLASS}>{formatDate(d.at)}</td>
                  <td className={TD_CLASS}>{d.to}</td>
                  <td className={TD_CLASS}>
                    {humanise(d.type)} — {d.legal_basis}
                  </td>
                  <td className={TD_CLASS}>{d.data_categories.map(humanise).join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScrollContainer>
      </Card>

      {canRequestAmendment && (
        <AmendmentSection child={child} amendments={amendments} onChanged={onChanged} />
      )}
      <DataRequestForm child={child} schoolId={schoolId} onChanged={onChanged} />
    </div>
  );
}

function DownloadRecord({ child, onExported }: { child: PrivacyChild; onExported: () => void }) {
  const { showToast } = useToast();
  const [busy, setBusy] = useState<'json' | 'csv' | 'pdf' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function download(format: 'json' | 'csv' | 'pdf') {
    setBusy(format);
    setError(null);
    try {
      const pkg = await getLearnerRecordPackage(child.learner_id);
      const base = exportFileBase(pkg);
      if (format === 'json')
        downloadTextFile(`${base}.json`, recordPackageToJson(pkg), 'application/json');
      if (format === 'csv') downloadTextFile(`${base}.csv`, recordPackageToCsv(pkg), 'text/csv');
      if (format === 'pdf') (await recordPackageToPdf(pkg)).save(`${base}.pdf`);
      showToast('Record downloaded. This export has been logged.', { variant: 'success' });
      onExported();
    } catch (err) {
      setError(getDbErrorMessage(err, 'The record could not be exported.'));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card title="Download the full record">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <ComplianceBadge icon="portability" size="lg" />
        <p className="text-sm text-content-secondary">
          One click exports everything the school holds about {child.name}: enrolment, attendance,
          results, report cards, behaviour visible to families, fees, documents, and every consent
          and disclosure.
        </p>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          onClick={() => void download('pdf')}
          isLoading={busy === 'pdf'}
          disabled={busy !== null}
        >
          Download PDF
        </Button>
        <Button
          variant="secondary"
          onClick={() => void download('csv')}
          isLoading={busy === 'csv'}
          disabled={busy !== null}
        >
          Download CSV
        </Button>
        <Button
          variant="secondary"
          onClick={() => void download('json')}
          isLoading={busy === 'json'}
          disabled={busy !== null}
        >
          Download JSON
        </Button>
      </div>
      <div className="mt-3">
        <ErrorAlert message={error} />
      </div>
    </Card>
  );
}

function AmendmentSection({
  child,
  amendments,
  onChanged,
}: {
  child: PrivacyChild;
  amendments: RecordAmendmentRequestRow[];
  onChanged: () => void;
}) {
  const { showToast } = useToast();
  const [area, setArea] = useState<AmendmentRecordArea>('personal_details');
  const [currentValue, setCurrentValue] = useState('');
  const [change, setChange] = useState('');
  const [reason, setReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      await submitAmendment({
        learnerId: child.learner_id,
        recordArea: area,
        requestedChange: change.trim(),
        reason: reason.trim(),
        currentValue: currentValue.trim(),
      });
      setChange('');
      setReason('');
      setCurrentValue('');
      showToast(
        'Correction request submitted. The school must respond within the statutory period.',
        { variant: 'success' },
      );
      onChanged();
    } catch (err) {
      setError(getDbErrorMessage(err, 'Your request could not be submitted.'));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Card title="Request a correction">
      <form onSubmit={(e) => void handleSubmit(e)} className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium text-content-primary">
          Part of the record
          <select
            className={`${SELECT_CLASS} mt-1`}
            value={area}
            onChange={(e) => setArea(e.target.value as AmendmentRecordArea)}
          >
            {AMENDMENT_AREAS.map((a) => (
              <option key={a} value={a}>
                {humanise(a)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-content-primary">
          What it says now (optional)
          <input
            className={`${SELECT_CLASS} mt-1`}
            value={currentValue}
            onChange={(e) => setCurrentValue(e.target.value)}
          />
        </label>
        <label className="text-sm font-medium text-content-primary sm:col-span-2">
          What it should say
          <textarea
            className={`${TEXTAREA_CLASS} mt-1`}
            value={change}
            onChange={(e) => setChange(e.target.value)}
            required
            minLength={3}
          />
        </label>
        <label className="text-sm font-medium text-content-primary sm:col-span-2">
          Why it is inaccurate or misleading
          <textarea
            className={`${TEXTAREA_CLASS} mt-1`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            minLength={3}
          />
        </label>
        <div className="sm:col-span-2">
          <ErrorAlert message={error} />
          <Button
            type="submit"
            isLoading={isSaving}
            disabled={change.trim().length < 3 || reason.trim().length < 3}
          >
            Submit correction request
          </Button>
        </div>
      </form>

      {amendments.length > 0 && (
        <div className="mt-6">
          <SectionTitle>Your correction requests</SectionTitle>
          <ul className="space-y-3">
            {amendments.map((a) => (
              <AmendmentItem key={a.id} amendment={a} onChanged={onChanged} />
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

function AmendmentItem({
  amendment,
  onChanged,
}: {
  amendment: RecordAmendmentRequestRow;
  onChanged: () => void;
}) {
  const [statement, setStatement] = useState(amendment.disagreement_statement ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function respond(requestHearing: boolean) {
    setBusy(true);
    setError(null);
    try {
      await respondToDenial(amendment.id, requestHearing, statement.trim());
      onChanged();
    } catch (err) {
      setError(getDbErrorMessage(err, 'Your response could not be saved.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="rounded-card border border-border p-3 text-sm">
      <div className="flex flex-wrap justify-between gap-2">
        <span className="font-medium text-content-primary">{humanise(amendment.record_area)}</span>
        <span className="text-content-secondary">
          {humanise(amendment.status)} · respond by {formatDate(amendment.due_by)}
        </span>
      </div>
      <p className="mt-1 text-content-secondary">{amendment.requested_change}</p>
      {amendment.decision_notes && (
        <p className="mt-1 text-content-primary">School’s response: {amendment.decision_notes}</p>
      )}
      {(amendment.status === 'denied' || amendment.status === 'hearing_requested') && (
        <div className="mt-3 space-y-2">
          <label className="block font-medium text-content-primary">
            Statement of disagreement (kept with the record and disclosed with it)
            <textarea
              className={`${TEXTAREA_CLASS} mt-1`}
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
            />
          </label>
          <ErrorAlert message={error} />
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              disabled={busy || statement.trim().length < 3}
              onClick={() => void respond(false)}
            >
              Save statement
            </Button>
            {amendment.status === 'denied' && (
              <Button disabled={busy} onClick={() => void respond(true)}>
                Request a hearing
              </Button>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

function DataRequestForm({
  child,
  schoolId,
  onChanged,
}: {
  child: PrivacyChild;
  schoolId: string;
  onChanged: () => void;
}) {
  const { showToast } = useToast();
  const [type, setType] = useState<DsarRequestType>('deletion');
  const [reason, setReason] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      await createDataSubjectRequest({
        schoolId,
        subjectLearnerId: child.learner_id,
        requestType: type,
        reason: reason.trim(),
      });
      setReason('');
      setConfirm(false);
      showToast(
        'Request submitted. The school will verify your identity and respond by the date shown.',
        { variant: 'success' },
      );
      onChanged();
    } catch (err) {
      setError(getDbErrorMessage(err, 'Your request could not be submitted.'));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Card title="Deletion, restriction and other formal requests">
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
        <p className="text-sm text-content-secondary">
          You can ask the school to delete {child.name}'s information (right to be forgotten) or to
          restrict how it is used. The school verifies your identity first. Records the law requires
          the school to keep — such as attendance registers and financial records — are kept in
          anonymised form.
        </p>
        <label className="block max-w-sm text-sm font-medium text-content-primary">
          Request
          <select
            className={`${SELECT_CLASS} mt-1`}
            value={type}
            onChange={(e) => {
              setType(e.target.value as DsarRequestType);
              setConfirm(false);
            }}
          >
            <option value="deletion">Delete my child’s information</option>
            <option value="restriction">Restrict how it is used</option>
            <option value="correction">Correct it (formal POPIA request)</option>
            <option value="access">Formal access request</option>
            <option value="portability">Transfer to another school</option>
          </select>
        </label>
        <label className="block text-sm font-medium text-content-primary">
          Details
          <textarea
            className={`${TEXTAREA_CLASS} mt-1`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            minLength={3}
          />
        </label>
        {type === 'deletion' && (
          <label className="flex items-start gap-2 text-sm text-content-primary">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 accent-brand-600"
              checked={confirm}
              onChange={(e) => setConfirm(e.target.checked)}
            />
            I understand that once the school completes a deletion it cannot be undone, and{' '}
            {child.name}'s online account will be closed.
          </label>
        )}
        <ErrorAlert message={error} />
        <Button
          type="submit"
          isLoading={isSaving}
          disabled={reason.trim().length < 3 || (type === 'deletion' && !confirm)}
        >
          Submit request
        </Button>
      </form>
    </Card>
  );
}
