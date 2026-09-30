import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { TextField } from '@/components/ui/TextField';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { LoadingBlock } from '@/components/ui/LoadingBlock';
import { TableScrollContainer } from '@/components/ui/TableScrollContainer';
import { useToast } from '@/components/ui/toast/useToast';
import { getDbErrorMessage } from '@/lib/dbErrors';
import type {
  DataSubjectRequestRow,
  DsarStatus,
  RecordAmendmentRequestRow,
} from '@/lib/database.types';
import { useAsyncData } from '@/features/compliance/hooks/useAsyncData';
import {
  decideAmendment,
  executeLearnerErasure,
  getLearnerNames,
  getProfileNames,
  listAmendments,
  listDataSubjectRequests,
  transitionDataSubjectRequest,
  type ErasureResult,
} from '@/features/compliance/services/complianceService';
import { EmptyRow, SectionTitle } from '@/features/compliance/components/ComplianceUi';
import {
  SELECT_CLASS,
  TABLE_CLASS,
  TD_CLASS,
  TEXTAREA_CLASS,
  TH_CLASS,
  formatDate,
  humanise,
} from '@/features/compliance/utils/formatting';

const DSAR_STATUSES: DsarStatus[] = [
  'received',
  'identity_verified',
  'processing',
  'completed',
  'rejected',
];

function isOverdue(due: string | null | undefined, open: boolean): boolean {
  return open && !!due && new Date(due).getTime() < Date.now();
}

export function RequestsTab({
  schoolId,
  canManage,
  onChanged,
}: {
  schoolId: string;
  canManage: boolean;
  onChanged: () => void;
}) {
  const data = useAsyncData(
    async () => {
      const [requests, amendments] = await Promise.all([
        listDataSubjectRequests(schoolId),
        listAmendments(schoolId),
      ]);
      const [learners, people] = await Promise.all([
        getLearnerNames([
          ...requests.map((r) => r.subject_learner_id ?? ''),
          ...amendments.map((a) => a.learner_id),
        ]),
        getProfileNames([
          ...requests.map((r) => r.requested_by ?? ''),
          ...requests.map((r) => r.subject_profile_id ?? ''),
          ...amendments.map((a) => a.requested_by ?? ''),
        ]),
      ]);
      return { requests, amendments, learners, people };
    },
    [schoolId],
    'Could not load requests.',
  );
  const [erasing, setErasing] = useState<DataSubjectRequestRow | null>(null);

  const refresh = () => {
    data.reload();
    onChanged();
  };

  if (data.isLoading && !data.data) return <LoadingBlock label="Loading requests…" />;
  if (!data.data) return <ErrorAlert message={data.error} />;
  const { requests, amendments, learners, people } = data.data;

  return (
    <div className="space-y-8">
      <section>
        <SectionTitle description="POPIA s.23–25 / GDPR Art. 15–21 requests. The respond-by date is the statutory deadline set in Settings.">
          Data-subject requests
        </SectionTitle>
        <TableScrollContainer>
          <table className={TABLE_CLASS}>
            <thead>
              <tr>
                <th className={TH_CLASS}>Subject</th>
                <th className={TH_CLASS}>Type</th>
                <th className={TH_CLASS}>Requested by</th>
                <th className={TH_CLASS}>Respond by</th>
                <th className={TH_CLASS}>Status</th>
                <th className={TH_CLASS}>Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {requests.length === 0 && <EmptyRow colSpan={6}>No data-subject requests.</EmptyRow>}
              {requests.map((r) => {
                const open = r.status !== 'completed' && r.status !== 'rejected';
                return (
                  <tr key={r.id}>
                    <td className={TD_CLASS}>
                      {r.subject_learner_id
                        ? (learners.get(r.subject_learner_id)?.name ?? 'Learner')
                        : (people.get(r.subject_profile_id ?? '') ?? 'Person')}
                      {r.reason && (
                        <p className="mt-0.5 max-w-xs text-xs text-content-secondary">{r.reason}</p>
                      )}
                    </td>
                    <td className={TD_CLASS}>{humanise(r.request_type)}</td>
                    <td className={TD_CLASS}>{people.get(r.requested_by ?? '') ?? '—'}</td>
                    <td className={TD_CLASS}>
                      <span
                        className={
                          isOverdue(r.due_at, open)
                            ? 'font-semibold text-red-700 dark:text-red-300'
                            : ''
                        }
                      >
                        {formatDate(r.due_at)}
                      </span>
                      {isOverdue(r.due_at, open) && (
                        <span className="block text-xs text-red-700 dark:text-red-300">
                          Overdue
                        </span>
                      )}
                    </td>
                    <td className={TD_CLASS}>{humanise(r.status)}</td>
                    <td className={TD_CLASS}>
                      {canManage && open ? (
                        <DsarActions
                          request={r}
                          onChanged={refresh}
                          onErase={() => setErasing(r)}
                        />
                      ) : (
                        <span className="text-xs text-content-secondary">
                          {r.outcome_notes ?? '—'}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableScrollContainer>
      </section>

      <section>
        <SectionTitle description="FERPA §99.20–99.22 correction requests from families. A denial must give reasons; families may then request a hearing.">
          Record correction requests
        </SectionTitle>
        <TableScrollContainer>
          <table className={TABLE_CLASS}>
            <thead>
              <tr>
                <th className={TH_CLASS}>Learner</th>
                <th className={TH_CLASS}>Area</th>
                <th className={TH_CLASS}>Requested change</th>
                <th className={TH_CLASS}>Decide by</th>
                <th className={TH_CLASS}>Status</th>
                <th className={TH_CLASS}>Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {amendments.length === 0 && <EmptyRow colSpan={6}>No correction requests.</EmptyRow>}
              {amendments.map((a) => (
                <tr key={a.id}>
                  <td className={TD_CLASS}>
                    {learners.get(a.learner_id)?.name ?? 'Learner'}
                    <p className="text-xs text-content-secondary">
                      by {people.get(a.requested_by ?? '') ?? '—'}
                    </p>
                  </td>
                  <td className={TD_CLASS}>{humanise(a.record_area)}</td>
                  <td className={TD_CLASS}>
                    <p className="max-w-sm">{a.requested_change}</p>
                    <p className="mt-0.5 max-w-sm text-xs text-content-secondary">
                      Reason: {a.reason}
                    </p>
                    {a.disagreement_statement && (
                      <p className="mt-0.5 max-w-sm text-xs text-accent-700">
                        Statement of disagreement: {a.disagreement_statement}
                      </p>
                    )}
                  </td>
                  <td className={TD_CLASS}>
                    <span
                      className={
                        isOverdue(a.due_by, ['submitted', 'under_review'].includes(a.status))
                          ? 'font-semibold text-red-700 dark:text-red-300'
                          : ''
                      }
                    >
                      {formatDate(a.due_by)}
                    </span>
                  </td>
                  <td className={TD_CLASS}>{humanise(a.status)}</td>
                  <td className={TD_CLASS}>
                    {canManage && a.status !== 'approved' && a.status !== 'closed' ? (
                      <AmendmentActions amendment={a} onChanged={refresh} />
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScrollContainer>
      </section>

      {erasing && (
        <ErasureModal
          request={erasing}
          learner={learners.get(erasing.subject_learner_id ?? '') ?? null}
          onClose={() => setErasing(null)}
          onDone={() => {
            setErasing(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function DsarActions({
  request,
  onChanged,
  onErase,
}: {
  request: DataSubjectRequestRow;
  onChanged: () => void;
  onErase: () => void;
}) {
  const { showToast } = useToast();
  const [status, setStatus] = useState<DsarStatus>(request.status);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canErase =
    request.request_type === 'deletion' &&
    request.subject_learner_id &&
    (request.status === 'identity_verified' || request.status === 'processing');

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await transitionDataSubjectRequest(request.id, status, notes.trim() || null);
      showToast('Request updated.', { variant: 'success' });
      onChanged();
    } catch (err) {
      setError(getDbErrorMessage(err, 'The request could not be updated.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-w-[14rem] space-y-2">
      <select
        aria-label="New status"
        className={SELECT_CLASS}
        value={status}
        onChange={(e) => setStatus(e.target.value as DsarStatus)}
      >
        {DSAR_STATUSES.map((s) => (
          <option key={s} value={s}>
            {humanise(s)}
          </option>
        ))}
      </select>
      <input
        aria-label="Outcome notes"
        className={SELECT_CLASS}
        placeholder="Outcome notes"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          onClick={() => void save()}
          isLoading={busy}
          disabled={status === request.status && !notes.trim()}
        >
          Update
        </Button>
        {canErase && <Button onClick={onErase}>Execute erasure…</Button>}
      </div>
      <ErrorAlert message={error} />
    </div>
  );
}

function AmendmentActions({
  amendment,
  onChanged,
}: {
  amendment: RecordAmendmentRequestRow;
  onChanged: () => void;
}) {
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(status: 'under_review' | 'approved' | 'denied' | 'closed') {
    setBusy(true);
    setError(null);
    try {
      await decideAmendment(amendment.id, status, notes.trim() || null);
      onChanged();
    } catch (err) {
      setError(getDbErrorMessage(err, 'The decision could not be saved.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-w-[14rem] space-y-2">
      <textarea
        aria-label="Decision notes"
        className={TEXTAREA_CLASS}
        placeholder="Decision notes (required to deny)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        {amendment.status === 'submitted' && (
          <Button variant="secondary" disabled={busy} onClick={() => void decide('under_review')}>
            Start review
          </Button>
        )}
        <Button disabled={busy} onClick={() => void decide('approved')}>
          Approve
        </Button>
        <Button
          variant="secondary"
          disabled={busy || notes.trim().length < 3}
          onClick={() => void decide('denied')}
        >
          Deny
        </Button>
        {amendment.status === 'hearing_requested' && (
          <Button variant="ghost" disabled={busy} onClick={() => void decide('closed')}>
            Close after hearing
          </Button>
        )}
      </div>
      <ErrorAlert message={error} />
    </div>
  );
}

function ErasureModal({
  request,
  learner,
  onClose,
  onDone,
}: {
  request: DataSubjectRequestRow;
  learner: { name: string; learnerNumber: string } | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const { showToast } = useToast();
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ErasureResult | null>(null);

  async function execute() {
    setBusy(true);
    setError(null);
    try {
      const r = await executeLearnerErasure(request.id, confirm.trim());
      setResult(r);
      showToast('Erasure completed and recorded in the audit log.', { variant: 'success' });
    } catch (err) {
      setError(getDbErrorMessage(err, 'The erasure could not be executed.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      isOpen
      onClose={result ? onDone : onClose}
      title="Right to erasure"
      footer={
        result ? (
          <div className="flex justify-end">
            <Button onClick={onDone}>Done</Button>
          </div>
        ) : (
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={() => void execute()}
              isLoading={busy}
              disabled={!learner || confirm.trim() !== learner.learnerNumber}
            >
              Permanently erase
            </Button>
          </div>
        )
      }
    >
      {result ? (
        <div className="space-y-2 text-sm text-content-primary">
          <p>The learner has been erased. Summary:</p>
          <ul className="list-inside list-disc text-content-secondary">
            {Object.entries(result.summary).map(([k, v]) => (
              <li key={k}>
                {humanise(k)}: {v}
              </li>
            ))}
            <li>
              Stored files removed: {result.filesRemoved}
              {result.filesFailed > 0 &&
                ` (${result.filesFailed} could not be removed — retry from the storage console)`}
            </li>
          </ul>
        </div>
      ) : (
        <div className="space-y-3 text-sm">
          <p className="text-content-primary">
            This permanently erases <strong>{learner?.name ?? 'this learner'}</strong>: names,
            identifiers, contacts, medical information, documents and free-text notes are deleted,
            guardian links end, and copies in the audit trail are redacted. Attendance registers,
            the financial ledger and safeguarding records are kept in pseudonymised form because the
            law requires them.
          </p>
          <p className="rounded-card border border-accent-500/60 bg-accent-50 p-3 text-content-primary dark:bg-accent-50/40">
            This cannot be undone. It requires a multi-factor authenticated session —{' '}
            <Link
              to="/my-profile"
              className="font-medium text-brand-600 underline dark:text-brand-300"
            >
              set up MFA on My Profile
            </Link>{' '}
            and sign in again if you have not.
          </p>
          <TextField
            label={`Type the learner number ${learner?.learnerNumber ?? ''} to confirm`}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="off"
          />
          <ErrorAlert message={error} />
        </div>
      )}
    </Modal>
  );
}
