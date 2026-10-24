import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { LoadingBlock } from '@/components/ui/LoadingBlock';
import { TableScrollContainer } from '@/components/ui/TableScrollContainer';
import { useToast } from '@/components/ui/toast/useToast';
import { getDbErrorMessage } from '@/lib/dbErrors';
import type { PlatformSupportGrantRow } from '@/lib/database.types';
import { useAsyncData } from '@/features/compliance/hooks/useAsyncData';
import { EmptyRow, SectionTitle } from '@/features/compliance/components/ComplianceUi';
import {
  TABLE_CLASS,
  TD_CLASS,
  TH_CLASS,
  TEXTAREA_CLASS,
  formatDateTime,
} from '@/features/compliance/utils/formatting';
import {
  decideSupportAccess,
  listSupportGrants,
  revokeSupportAccess,
} from '@/features/supportAccess/services/supportAccessService';
import { canRevoke, grantState, scopeLabels } from '@/features/supportAccess/utils/grantState';
import { GrantStateBadge } from '@/features/supportAccess/components/GrantStateBadge';

/**
 * The school's side of support access: Funda360 staff have no standing
 * access to safeguarding, medical, behaviour or messages data. They ask
 * here, the owner or principal decides, and either side can end it. The
 * database enforces all of this (20261024090000); this tab only shows it.
 */
export function SupportAccessTab({
  schoolId,
  canManage,
}: {
  schoolId: string;
  canManage: boolean;
}) {
  const { showToast } = useToast();
  const list = useAsyncData(
    () => listSupportGrants(schoolId),
    [schoolId],
    'Could not load support access requests.',
  );
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function run(grant: PlatformSupportGrantRow, action: 'approve' | 'decline' | 'revoke') {
    setBusyId(grant.id);
    setActionError(null);
    try {
      if (action === 'revoke') {
        await revokeSupportAccess(grant.id);
        showToast('Support access ended.', { variant: 'success' });
      } else {
        await decideSupportAccess(grant.id, action === 'approve', notes[grant.id]);
        showToast(action === 'approve' ? 'Support access approved.' : 'Request declined.', {
          variant: 'success',
        });
      }
      list.reload();
    } catch (err) {
      setActionError(getDbErrorMessage(err, 'That could not be saved.'));
    } finally {
      setBusyId(null);
    }
  }

  const rows = list.data ?? [];

  return (
    <section id="support-access">
      <SectionTitle description="Funda360 staff cannot see your safeguarding, medical, behaviour or message records. If they need them to help you, they ask here. Access is read-only, for the areas and hours you approve, from a login with two-factor authentication, and you can end it at any time. Every request and decision is in your audit log.">
        Support access
      </SectionTitle>
      <ErrorAlert message={list.error ?? actionError} />
      {list.isLoading && !list.data ? (
        <LoadingBlock label="Loading support access requests…" />
      ) : (
        <TableScrollContainer>
          <table className={TABLE_CLASS}>
            <thead>
              <tr>
                <th className={TH_CLASS}>Requested</th>
                <th className={TH_CLASS}>By</th>
                <th className={TH_CLASS}>Areas and reason</th>
                <th className={TH_CLASS}>Status</th>
                <th className={TH_CLASS}>Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.length === 0 && (
                <EmptyRow colSpan={5}>No support access has been requested.</EmptyRow>
              )}
              {rows.map((grant) => {
                const state = grantState(grant);
                return (
                  <tr key={grant.id}>
                    <td className={TD_CLASS}>{formatDateTime(grant.created_at)}</td>
                    <td className={TD_CLASS}>
                      {grant.requested_by_name}
                      {grant.requested_by_email && (
                        <span className="block text-xs text-content-secondary">
                          {grant.requested_by_email}
                        </span>
                      )}
                    </td>
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
                          Note: {grant.decision_note}
                        </span>
                      )}
                    </td>
                    <td className={TD_CLASS}>
                      {canManage && state === 'pending' && (
                        <div className="flex min-w-[14rem] flex-col gap-2">
                          <label className="text-xs font-medium text-content-secondary">
                            Note (optional)
                            <textarea
                              className={`${TEXTAREA_CLASS} mt-1 min-h-[60px]`}
                              value={notes[grant.id] ?? ''}
                              onChange={(e) =>
                                setNotes((prev) => ({ ...prev, [grant.id]: e.target.value }))
                              }
                            />
                          </label>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              isLoading={busyId === grant.id}
                              onClick={() => void run(grant, 'approve')}
                            >
                              Approve
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              disabled={busyId === grant.id}
                              onClick={() => void run(grant, 'decline')}
                            >
                              Decline
                            </Button>
                          </div>
                        </div>
                      )}
                      {canManage && state === 'active' && canRevoke(state) && (
                        <Button
                          type="button"
                          variant="secondary"
                          isLoading={busyId === grant.id}
                          onClick={() => void run(grant, 'revoke')}
                        >
                          End access now
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableScrollContainer>
      )}
    </section>
  );
}
