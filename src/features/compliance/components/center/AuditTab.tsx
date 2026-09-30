import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { LoadingBlock } from '@/components/ui/LoadingBlock';
import { Tabs } from '@/components/ui/Tabs';
import { TableScrollContainer } from '@/components/ui/TableScrollContainer';
import { useAsyncData } from '@/features/compliance/hooks/useAsyncData';
import {
  PAGE_SIZE,
  getLearnerNames,
  getProfileNames,
  listAccessLog,
  listAuditLog,
} from '@/features/compliance/services/complianceService';
import { EmptyRow } from '@/features/compliance/components/ComplianceUi';
import { LearnerPicker, type PickedLearner } from '@/features/compliance/components/LearnerPicker';
import {
  SELECT_CLASS,
  TABLE_CLASS,
  TD_CLASS,
  TH_CLASS,
  formatDateTime,
  humanise,
} from '@/features/compliance/utils/formatting';

type View = 'changes' | 'access';

export function AuditTab({ schoolId }: { schoolId: string }) {
  const [view, setView] = useState<View>('changes');
  return (
    <div className="space-y-4">
      <Tabs
        tabs={[
          { key: 'changes', label: 'Changes to records' },
          { key: 'access', label: 'Record access' },
        ]}
        activeTab={view}
        onChange={setView}
      />
      {view === 'changes' ? <ChangeLog schoolId={schoolId} /> : <AccessLog schoolId={schoolId} />}
    </div>
  );
}

function Pager({
  page,
  total,
  onPage,
}: {
  page: number;
  total: number;
  onPage: (p: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return (
    <div className="flex items-center justify-between gap-2 text-sm text-content-secondary">
      <span>
        {total} entries · page {page + 1} of {pages}
      </span>
      <div className="flex gap-2">
        <Button variant="secondary" disabled={page === 0} onClick={() => onPage(page - 1)}>
          Previous
        </Button>
        <Button variant="secondary" disabled={page + 1 >= pages} onClick={() => onPage(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}

function summarise(before: unknown, after: unknown): string {
  if (after && typeof after === 'object' && 'redacted' in after) return 'Redacted (erasure)';
  if (!before || !after || typeof before !== 'object' || typeof after !== 'object') return '';
  const b = before as Record<string, unknown>;
  const a = after as Record<string, unknown>;
  const changed = Object.keys(a).filter(
    (k) =>
      !['updated_at', 'updated_by'].includes(k) && JSON.stringify(a[k]) !== JSON.stringify(b[k]),
  );
  return changed.length ? `Changed: ${changed.map(humanise).join(', ')}` : '';
}

function ChangeLog({ schoolId }: { schoolId: string }) {
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState('');
  const [applied, setApplied] = useState('');
  const log = useAsyncData(
    async () => {
      const result = await listAuditLog(schoolId, page, applied);
      const names = await getProfileNames(result.rows.map((r) => r.actor_profile_id ?? ''));
      return { ...result, names };
    },
    [schoolId, page, applied],
    'Could not load the audit log.',
  );

  return (
    <section className="space-y-3">
      <p className="text-sm text-content-secondary">
        Every insert, update and delete on student data, with who made it and what changed.
        Append-only: nobody — including administrators — can edit or delete entries.
      </p>
      <form
        className="flex max-w-md gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(0);
          setApplied(filter);
        }}
      >
        <input
          aria-label="Filter by action"
          className={SELECT_CLASS}
          placeholder="Filter by action, e.g. learners, consent, erased"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <Button type="submit" variant="secondary">
          Filter
        </Button>
      </form>
      <ErrorAlert message={log.error} />
      {log.isLoading && !log.data ? (
        <LoadingBlock label="Loading audit log…" />
      ) : (
        <>
          <TableScrollContainer>
            <table className={TABLE_CLASS}>
              <thead>
                <tr>
                  <th className={TH_CLASS}>When</th>
                  <th className={TH_CLASS}>Who</th>
                  <th className={TH_CLASS}>Action</th>
                  <th className={TH_CLASS}>Record</th>
                  <th className={TH_CLASS}>Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(log.data?.rows ?? []).length === 0 && (
                  <EmptyRow colSpan={5}>No entries.</EmptyRow>
                )}
                {(log.data?.rows ?? []).map((r) => (
                  <tr key={r.id}>
                    <td className={TD_CLASS}>{formatDateTime(r.created_at)}</td>
                    <td className={TD_CLASS}>
                      {r.actor_profile_id
                        ? (log.data?.names.get(r.actor_profile_id) ?? 'Unknown user')
                        : 'System'}
                    </td>
                    <td className={TD_CLASS}>{humanise(r.action)}</td>
                    <td className={TD_CLASS}>
                      {humanise(r.entity_table)}
                      <span className="block font-mono text-xs text-content-tertiary">
                        {r.entity_id.slice(0, 8)}
                      </span>
                    </td>
                    <td className={TD_CLASS}>{summarise(r.before, r.after)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScrollContainer>
          <Pager page={page} total={log.data?.total ?? 0} onPage={setPage} />
        </>
      )}
    </section>
  );
}

function AccessLog({ schoolId }: { schoolId: string }) {
  const [page, setPage] = useState(0);
  const [learner, setLearner] = useState<PickedLearner | null>(null);
  const log = useAsyncData(
    async () => {
      const result = await listAccessLog(schoolId, page, learner?.id ?? null);
      const [names, learners] = await Promise.all([
        getProfileNames(result.rows.map((r) => r.actor_profile_id ?? '')),
        getLearnerNames(result.rows.map((r) => r.learner_id)),
      ]);
      return { ...result, names, learners };
    },
    [schoolId, page, learner?.id],
    'Could not load the access log.',
  );

  return (
    <section className="space-y-3">
      <p className="text-sm text-content-secondary">
        Who opened, exported, printed or disclosed which learner's record. Families see the same
        history for their own children.
      </p>
      <div className="max-w-md">
        <LearnerPicker
          schoolId={schoolId}
          value={learner}
          onChange={(l) => {
            setPage(0);
            setLearner(l);
          }}
          label="Filter by learner (optional)"
        />
      </div>
      <ErrorAlert message={log.error} />
      {log.isLoading && !log.data ? (
        <LoadingBlock label="Loading access log…" />
      ) : (
        <>
          <TableScrollContainer>
            <table className={TABLE_CLASS}>
              <thead>
                <tr>
                  <th className={TH_CLASS}>When</th>
                  <th className={TH_CLASS}>Who</th>
                  <th className={TH_CLASS}>Role</th>
                  <th className={TH_CLASS}>Learner</th>
                  <th className={TH_CLASS}>Access</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(log.data?.rows ?? []).length === 0 && (
                  <EmptyRow colSpan={5}>No record access logged.</EmptyRow>
                )}
                {(log.data?.rows ?? []).map((r) => (
                  <tr key={r.id}>
                    <td className={TD_CLASS}>{formatDateTime(r.created_at)}</td>
                    <td className={TD_CLASS}>
                      {log.data?.names.get(r.actor_profile_id ?? '') ?? 'System'}
                    </td>
                    <td className={TD_CLASS}>{humanise(r.actor_role)}</td>
                    <td className={TD_CLASS}>
                      {log.data?.learners.get(r.learner_id)?.name ?? 'Learner'}
                    </td>
                    <td className={TD_CLASS}>
                      {humanise(r.access_type)} — {r.context}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScrollContainer>
          <Pager page={page} total={log.data?.total ?? 0} onPage={setPage} />
        </>
      )}
    </section>
  );
}
