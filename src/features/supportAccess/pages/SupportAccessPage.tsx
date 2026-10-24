import { useState, type FormEvent } from 'react';
import { PageContainer } from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { LoadingBlock } from '@/components/ui/LoadingBlock';
import { TableScrollContainer } from '@/components/ui/TableScrollContainer';
import { useToast } from '@/components/ui/toast/useToast';
import { getDbErrorMessage } from '@/lib/dbErrors';
import type { PlatformSupportScope } from '@/lib/database.types';
import { useAuth } from '@/features/auth/context/authContext';
import { tenantService } from '@/features/tenant/services/tenantService';
import { useAsyncData } from '@/features/compliance/hooks/useAsyncData';
import { EmptyRow, SectionTitle } from '@/features/compliance/components/ComplianceUi';
import {
  SELECT_CLASS,
  TABLE_CLASS,
  TD_CLASS,
  TEXTAREA_CLASS,
  TH_CLASS,
  formatDateTime,
} from '@/features/compliance/utils/formatting';
import {
  listSupportGrants,
  requestSupportAccess,
  revokeSupportAccess,
} from '@/features/supportAccess/services/supportAccessService';
import {
  MAX_SUPPORT_HOURS,
  SUPPORT_SCOPES,
  canRevoke,
  grantState,
  scopeLabels,
} from '@/features/supportAccess/utils/grantState';
import { GrantStateBadge } from '@/features/supportAccess/components/GrantStateBadge';

/**
 * Platform side of support access (20261024090000). Platform roles have no
 * standing access to a school's safeguarding, medical, behaviour or
 * messages data; they ask the school here. An approved grant opens only
 * the named areas of that school, read-only, for the approved hours, and
 * only from a two-factor (aal2) session. The database enforces all of it.
 */
export function SupportAccessPage() {
  const { user } = useAuth();
  const data = useAsyncData(
    async () => {
      const [grants, schools] = await Promise.all([
        listSupportGrants(),
        tenantService.listAvailableSchools(),
      ]);
      return { grants, schools };
    },
    [],
    'Could not load support access.',
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const { showToast } = useToast();

  async function withdraw(id: string) {
    setBusyId(id);
    setActionError(null);
    try {
      await revokeSupportAccess(id);
      showToast('Support access ended.', { variant: 'success' });
      data.reload();
    } catch (err) {
      setActionError(getDbErrorMessage(err, 'That could not be withdrawn.'));
    } finally {
      setBusyId(null);
    }
  }

  const schoolName = (id: string) => data.data?.schools.find((s) => s.id === id)?.name ?? 'School';

  return (
    <PageContainer>
      <PageHeader
        title="Support access"
        description="Funda360 staff have no standing access to a school's safeguarding, medical, behaviour or message records. Ask the school for time-limited, read-only access here; its owner or principal decides."
      />
      <ErrorAlert message={data.error ?? actionError} />
      {data.isLoading && !data.data ? (
        <LoadingBlock label="Loading support access…" />
      ) : data.data ? (
        <div className="space-y-8">
          <RequestForm schools={data.data.schools} onSaved={data.reload} />
          <section>
            <SectionTitle description="An approved request works only from a login with two-factor authentication, and only until it expires or the school ends it.">
              Requests
            </SectionTitle>
            <TableScrollContainer>
              <table className={TABLE_CLASS}>
                <thead>
                  <tr>
                    <th className={TH_CLASS}>School</th>
                    <th className={TH_CLASS}>Requested by</th>
                    <th className={TH_CLASS}>Areas and reason</th>
                    <th className={TH_CLASS}>Status</th>
                    <th className={TH_CLASS}>Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.data.grants.length === 0 && (
                    <EmptyRow colSpan={5}>No support access requested yet.</EmptyRow>
                  )}
                  {data.data.grants.map((grant) => {
                    const state = grantState(grant);
                    return (
                      <tr key={grant.id}>
                        <td className={TD_CLASS}>
                          {schoolName(grant.school_id)}
                          <span className="block text-xs text-content-secondary">
                            {formatDateTime(grant.created_at)}
                          </span>
                        </td>
                        <td className={TD_CLASS}>{grant.requested_by_name}</td>
                        <td className={TD_CLASS}>
                          <span className="font-medium">{scopeLabels(grant.scopes)}</span>
                          <span className="block text-xs text-content-secondary">
                            {grant.duration_hours} hours · {grant.reason}
                          </span>
                        </td>
                        <td className={TD_CLASS}>
                          <GrantStateBadge state={state} />
                          {state === 'active' && (
                            <span className="mt-1 block text-xs text-content-secondary">
                              Until {formatDateTime(grant.expires_at)}
                            </span>
                          )}
                          {grant.decision_note && (
                            <span className="mt-1 block text-xs text-content-secondary">
                              School note: {grant.decision_note}
                            </span>
                          )}
                        </td>
                        <td className={TD_CLASS}>
                          {grant.requested_by === user?.id && canRevoke(state) && (
                            <Button
                              type="button"
                              variant="secondary"
                              isLoading={busyId === grant.id}
                              onClick={() => void withdraw(grant.id)}
                            >
                              {state === 'pending' ? 'Withdraw request' : 'End access now'}
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableScrollContainer>
          </section>
        </div>
      ) : null}
    </PageContainer>
  );
}

function RequestForm({
  schools,
  onSaved,
}: {
  schools: Array<{ id: string; name: string }>;
  onSaved: () => void;
}) {
  const { showToast } = useToast();
  const [schoolId, setSchoolId] = useState('');
  const [scopes, setScopes] = useState<PlatformSupportScope[]>([]);
  const [reason, setReason] = useState('');
  const [hours, setHours] = useState(4);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validHours = Number.isInteger(hours) && hours >= 1 && hours <= MAX_SUPPORT_HOURS;
  const canSubmit =
    schoolId !== '' && scopes.length > 0 && reason.trim().length >= 10 && validHours;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await requestSupportAccess({ schoolId, scopes, reason: reason.trim(), durationHours: hours });
      showToast('Request sent. The school’s owner and principal have been notified.', {
        variant: 'success',
      });
      setScopes([]);
      setReason('');
      onSaved();
    } catch (err) {
      setError(getDbErrorMessage(err, 'The request could not be sent.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-card border border-border bg-surface-raised p-4">
      <SectionTitle description="Ask only for the areas you need. The school sees your name, the areas, the reason and the hours.">
        Request support access
      </SectionTitle>
      <form onSubmit={(e) => void handleSubmit(e)} className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm font-medium text-content-primary">
          School
          <select
            className={`${SELECT_CLASS} mt-1`}
            value={schoolId}
            onChange={(e) => setSchoolId(e.target.value)}
            required
          >
            <option value="">Choose a school</option>
            {schools.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium text-content-primary">
          Hours (1 to {MAX_SUPPORT_HOURS})
          <input
            type="number"
            min={1}
            max={MAX_SUPPORT_HOURS}
            className={`${SELECT_CLASS} mt-1`}
            value={Number.isNaN(hours) ? '' : hours}
            onChange={(e) => setHours(e.target.valueAsNumber)}
            required
          />
        </label>
        <fieldset className="md:col-span-2">
          <legend className="text-sm font-medium text-content-primary">Areas</legend>
          <div className="mt-2 flex flex-wrap gap-4">
            {SUPPORT_SCOPES.map((scope) => (
              <label
                key={scope.value}
                className="flex items-center gap-2 text-sm text-content-secondary"
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-brand-600"
                  checked={scopes.includes(scope.value)}
                  onChange={(e) =>
                    setScopes((prev) =>
                      e.target.checked
                        ? [...prev, scope.value]
                        : prev.filter((x) => x !== scope.value),
                    )
                  }
                />
                {scope.label}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="block text-sm font-medium text-content-primary md:col-span-2">
          Reason (at least 10 characters)
          <textarea
            className={`${TEXTAREA_CLASS} mt-1`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
          />
        </label>
        <div className="md:col-span-2">
          <ErrorAlert message={error} />
          <Button type="submit" isLoading={busy} disabled={!canSubmit}>
            Send request
          </Button>
        </div>
      </form>
    </section>
  );
}
