import { Link } from 'react-router-dom';
import { TableScrollContainer } from '@/components/ui/TableScrollContainer';
import { GuardianInvitationStatusBadge } from '@/features/guardians/components/GuardianInvitationStatusBadge';
import type { GuardianDirectoryEntry } from '@/features/guardians/types/guardian.types';

export interface GuardiansTableProps {
  guardians: GuardianDirectoryEntry[];
}

export function GuardiansTable({ guardians }: GuardiansTableProps) {
  if (guardians.length === 0) {
    return (
      <div className="rounded-card border border-border bg-surface-raised px-4 py-10 text-center text-sm text-content-tertiary">
        No guardians found.
      </div>
    );
  }

  return (
    <TableScrollContainer>
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wide text-content-tertiary">
            <th scope="col" className="px-4 py-3 font-medium">Name</th>
            <th scope="col" className="px-4 py-3 font-medium">Contact</th>
            <th scope="col" className="px-4 py-3 font-medium">Linked learners</th>
            <th scope="col" className="px-4 py-3 font-medium">Status</th>
            <th scope="col" className="px-4 py-3 font-medium">Invitation</th>
          </tr>
        </thead>
        <tbody>
          {guardians.map((guardian) => {
            const activeLinks = guardian.links.filter((link) => link.active);
            return (
              <tr key={guardian.guardianProfileId} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <Link
                    to={`/guardians/${guardian.guardianProfileId}`}
                    className="focus-ring rounded font-medium text-brand-600 hover:underline dark:text-brand-300"
                  >
                    {guardian.firstName} {guardian.lastName}
                  </Link>
                </td>
                <td className="px-4 py-3 text-content-secondary">
                  {[guardian.phone, guardian.email].filter(Boolean).join(' · ') || '—'}
                </td>
                <td className="px-4 py-3 text-content-secondary">
                  {activeLinks.length === 0
                    ? '—'
                    : activeLinks.map((link) => `${link.learnerFirstName} ${link.learnerLastName}`).join(', ')}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={
                      guardian.status === 'active'
                        ? 'inline-flex items-center rounded-full bg-success-500/10 px-2.5 py-1 text-xs font-medium text-success-500'
                        : 'inline-flex items-center rounded-full bg-surface-sunken px-2.5 py-1 text-xs font-medium text-content-tertiary'
                    }
                  >
                    {guardian.status === 'active' ? 'Active' : guardian.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <GuardianInvitationStatusBadge status={guardian.invitation?.displayStatus ?? 'not_invited'} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </TableScrollContainer>
  );
}
