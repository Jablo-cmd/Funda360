import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { Checkbox } from '@/components/ui/Checkbox';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { LoadingBlock } from '@/components/ui/LoadingBlock';
import { TableScrollContainer } from '@/components/ui/TableScrollContainer';
import { useToast } from '@/components/ui/toast/useToast';
import { getDbErrorMessage } from '@/lib/dbErrors';
import type {
  ContentSafetyCategory,
  ContentSafetyEventRow,
  ContentSafetyEventStatus,
} from '@/lib/database.types';
import { useAsyncData } from '@/features/compliance/hooks/useAsyncData';
import {
  getProfileNames,
  listContentSafetyEvents,
  listContentSafetyRules,
  reviewContentSafetyEvent,
  saveContentSafetyRule,
} from '@/features/compliance/services/complianceService';
import { EmptyRow, SectionTitle } from '@/features/compliance/components/ComplianceUi';
import {
  SELECT_CLASS,
  TABLE_CLASS,
  TD_CLASS,
  TH_CLASS,
  formatDateTime,
  humanise,
} from '@/features/compliance/utils/formatting';

const CATEGORIES: ContentSafetyCategory[] = [
  'adult',
  'gambling',
  'violence',
  'self_harm',
  'bullying',
  'drugs',
  'hate',
  'custom',
];

export function SafetyTab({
  schoolId,
  canManage,
  onChanged,
}: {
  schoolId: string;
  canManage: boolean;
  onChanged: () => void;
}) {
  const [status, setStatus] = useState<ContentSafetyEventStatus | 'all'>('open');
  const events = useAsyncData(
    async () => {
      const rows = await listContentSafetyEvents(schoolId, status);
      return { rows, names: await getProfileNames(rows.map((r) => r.actor_profile_id ?? '')) };
    },
    [schoolId, status],
    'Could not load flagged content.',
  );
  const rules = useAsyncData(
    listContentSafetyRules,
    [schoolId],
    'Could not load safe-content rules.',
  );

  return (
    <div className="space-y-8">
      <section>
        <SectionTitle description="Self-harm and violence flags also alert the owner and principal immediately. Blocked content never reaches the database.">
          Flagged content
        </SectionTitle>
        <select
          aria-label="Filter flags by status"
          className={`${SELECT_CLASS} mb-3 max-w-xs`}
          value={status}
          onChange={(e) => setStatus(e.target.value as ContentSafetyEventStatus | 'all')}
        >
          <option value="open">Awaiting review</option>
          <option value="escalated">Escalated</option>
          <option value="resolved">Resolved</option>
          <option value="reviewed_no_action">Reviewed — no action</option>
          <option value="all">All</option>
        </select>
        <ErrorAlert message={events.error} />
        {events.isLoading && !events.data ? (
          <LoadingBlock label="Loading flagged content…" />
        ) : (
          <TableScrollContainer>
            <table className={TABLE_CLASS}>
              <thead>
                <tr>
                  <th className={TH_CLASS}>When</th>
                  <th className={TH_CLASS}>Category</th>
                  <th className={TH_CLASS}>Where</th>
                  <th className={TH_CLASS}>Posted by</th>
                  <th className={TH_CLASS}>Excerpt</th>
                  <th className={TH_CLASS}>Review</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(events.data?.rows ?? []).length === 0 && (
                  <EmptyRow colSpan={6}>Nothing to review.</EmptyRow>
                )}
                {(events.data?.rows ?? []).map((e) => (
                  <tr key={e.id}>
                    <td className={TD_CLASS}>{formatDateTime(e.created_at)}</td>
                    <td className={TD_CLASS}>
                      <span
                        className={
                          e.category === 'self_harm' || e.category === 'violence'
                            ? 'font-semibold text-red-700 dark:text-red-300'
                            : ''
                        }
                      >
                        {humanise(e.category)}
                      </span>
                    </td>
                    <td className={TD_CLASS}>{humanise(e.source_table)}</td>
                    <td className={TD_CLASS}>
                      {events.data?.names.get(e.actor_profile_id ?? '') ?? '—'}
                    </td>
                    <td className={TD_CLASS}>
                      <p className="max-w-xs break-words text-content-secondary">{e.excerpt}</p>
                    </td>
                    <td className={TD_CLASS}>
                      {canManage && e.status === 'open' ? (
                        <ReviewForm
                          event={e}
                          onDone={() => {
                            events.reload();
                            onChanged();
                          }}
                        />
                      ) : (
                        <span className="text-xs text-content-secondary">
                          {humanise(e.status)}
                          {e.review_notes ? ` — ${e.review_notes}` : ''}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScrollContainer>
        )}
      </section>

      <section>
        <SectionTitle description="Platform baseline rules apply to every school and are maintained by the platform. Add your own school rules below.">
          Safe-content rules
        </SectionTitle>
        <ErrorAlert message={rules.error} />
        <TableScrollContainer>
          <table className={TABLE_CLASS}>
            <thead>
              <tr>
                <th className={TH_CLASS}>Scope</th>
                <th className={TH_CLASS}>Category</th>
                <th className={TH_CLASS}>Action</th>
                <th className={TH_CLASS}>Description</th>
                <th className={TH_CLASS}>Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(rules.data ?? []).map((r) => (
                <tr key={r.id}>
                  <td className={TD_CLASS}>{r.school_id ? 'This school' : 'Platform baseline'}</td>
                  <td className={TD_CLASS}>{humanise(r.category)}</td>
                  <td className={TD_CLASS}>{r.action === 'block' ? 'Block' : 'Flag for review'}</td>
                  <td className={TD_CLASS}>
                    {r.description ?? '—'}
                    <span className="block font-mono text-xs text-content-tertiary">
                      {r.pattern}
                    </span>
                  </td>
                  <td className={TD_CLASS}>{r.active ? 'Yes' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScrollContainer>
        {canManage && <RuleForm schoolId={schoolId} onSaved={rules.reload} />}
      </section>
    </div>
  );
}

function ReviewForm({ event, onDone }: { event: ContentSafetyEventRow; onDone: () => void }) {
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function review(status: Exclude<ContentSafetyEventStatus, 'open'>) {
    setBusy(true);
    setError(null);
    try {
      await reviewContentSafetyEvent(event.id, status, notes.trim());
      onDone();
    } catch (err) {
      setError(getDbErrorMessage(err, 'The review could not be saved.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-w-[13rem] space-y-2">
      <input
        aria-label="Review notes"
        className={SELECT_CLASS}
        placeholder="Notes"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => void review('reviewed_no_action')}
        >
          No action
        </Button>
        <Button disabled={busy} onClick={() => void review('escalated')}>
          Escalate
        </Button>
        <Button variant="ghost" disabled={busy} onClick={() => void review('resolved')}>
          Resolved
        </Button>
      </div>
      <ErrorAlert message={error} />
    </div>
  );
}

function RuleForm({ schoolId, onSaved }: { schoolId: string; onSaved: () => void }) {
  const { showToast } = useToast();
  const [category, setCategory] = useState<ContentSafetyCategory>('custom');
  const [pattern, setPattern] = useState('');
  const [action, setAction] = useState<'block' | 'flag'>('flag');
  const [description, setDescription] = useState('');
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await saveContentSafetyRule({
        schoolId,
        category,
        pattern: pattern.trim(),
        action,
        description: description.trim(),
        active,
      });
      showToast('Rule saved. It applies to new content immediately.', { variant: 'success' });
      setPattern('');
      setDescription('');
      onSaved();
    } catch (err) {
      setError(
        getDbErrorMessage(
          err,
          'The rule could not be saved. Check the pattern is a valid regular expression.',
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className="mt-4 grid gap-3 rounded-card border border-border bg-surface-raised p-4 md:grid-cols-2"
    >
      <label className="text-sm font-medium text-content-primary">
        Category
        <select
          className={`${SELECT_CLASS} mt-1`}
          value={category}
          onChange={(e) => setCategory(e.target.value as ContentSafetyCategory)}
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {humanise(c)}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm font-medium text-content-primary">
        Action
        <select
          className={`${SELECT_CLASS} mt-1`}
          value={action}
          onChange={(e) => setAction(e.target.value as 'block' | 'flag')}
        >
          <option value="flag">Flag for review</option>
          <option value="block">Block</option>
        </select>
      </label>
      <TextField
        label="Pattern (words separated by |, case-insensitive)"
        hint="Example: \m(badword|otherword)\M — \m and \M match whole words."
        value={pattern}
        onChange={(e) => setPattern(e.target.value)}
        required
      />
      <TextField
        label="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <Checkbox label="Active" checked={active} onChange={(e) => setActive(e.target.checked)} />
      <div className="md:col-span-2">
        <ErrorAlert message={error} />
        <Button type="submit" isLoading={busy} disabled={pattern.trim().length < 2}>
          Add school rule
        </Button>
      </div>
    </form>
  );
}
