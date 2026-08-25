import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { GuardianInvitationStatusBadge } from '@/features/guardians/components/GuardianInvitationStatusBadge';
import { RevokeInvitationDialog } from '@/features/guardians/components/RevokeInvitationDialog';
import { guardianInvitationService } from '@/features/guardians/services/guardianInvitationService';
import { getDbErrorMessage } from '@/lib/dbErrors';
import type { GuardianInvitation } from '@/features/guardians/types/guardian.types';

export interface GuardianInvitationCardProps {
  guardianProfileId: string;
  guardianEmail: string;
  invitation: GuardianInvitation | null;
  canManage: boolean;
  onChanged: () => void;
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function GuardianInvitationCard({
  guardianProfileId,
  guardianEmail,
  invitation,
  canManage,
  onChanged,
}: GuardianInvitationCardProps) {
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [isRevokeOpen, setIsRevokeOpen] = useState(false);

  const displayStatus = invitation?.displayStatus ?? 'not_invited';

  const handleSend = async () => {
    setSendError(null);
    setIsSending(true);
    try {
      await guardianInvitationService.sendInvitation(guardianProfileId, guardianEmail);
      onChanged();
    } catch (error) {
      setSendError(getDbErrorMessage(error, 'Failed to send invitation.'));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="rounded-card border border-border bg-surface-raised p-6 shadow-card dark:shadow-card-dark">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-content-primary">Account activation</h2>
        <GuardianInvitationStatusBadge status={displayStatus} />
      </div>

      {sendError && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-600"
        >
          {sendError}
        </div>
      )}

      <p className="mb-4 text-sm text-content-secondary">
        {displayStatus === 'not_invited' &&
          'This guardian has not been invited yet. Sending an invitation emails them a secure link to set their own password and log in to the Parent Portal.'}
        {displayStatus === 'pending' &&
          invitation &&
          `Invitation sent ${formatDateTime(invitation.invitedAt)}, expires ${formatDateTime(invitation.expiresAt)}. Not yet activated.`}
        {displayStatus === 'expired' &&
          invitation &&
          `The invitation sent ${formatDateTime(invitation.invitedAt)} expired on ${formatDateTime(invitation.expiresAt)}. Send a new one to let this guardian activate their account.`}
        {displayStatus === 'revoked' && 'The last invitation was revoked. Send a new one when this guardian is ready to activate their account.'}
        {displayStatus === 'accepted' &&
          invitation?.acceptedAt &&
          `This guardian activated their account on ${formatDateTime(invitation.acceptedAt)} and can log in normally.`}
      </p>

      {canManage && displayStatus !== 'accepted' && (
        <div className="flex flex-wrap gap-3">
          <div className="w-full sm:w-auto sm:min-w-[10rem]">
            <Button type="button" onClick={() => void handleSend()} isLoading={isSending}>
              {isSending ? 'Sending…' : displayStatus === 'not_invited' ? 'Send invitation' : 'Resend invitation'}
            </Button>
          </div>
          {displayStatus === 'pending' && (
            <div className="w-full sm:w-auto sm:min-w-[10rem]">
              <Button type="button" variant="secondary" onClick={() => setIsRevokeOpen(true)}>
                Revoke invitation
              </Button>
            </div>
          )}
        </div>
      )}

      <RevokeInvitationDialog
        isOpen={isRevokeOpen}
        onClose={() => setIsRevokeOpen(false)}
        invitation={invitation}
        guardianName={guardianEmail}
        onRevoked={() => onChanged()}
      />
    </div>
  );
}
