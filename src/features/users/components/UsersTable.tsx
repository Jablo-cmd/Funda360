import { Link } from 'react-router-dom';
import { canManageUser } from '@/features/users/utils/userPermissions';
import type { UserRole } from '@/features/auth/types/auth.types';
import type { Profile, ProfileStatus } from '@/types/profile.types';

export interface UsersTableProps {
  users: Profile[];
  actorRole: UserRole | null;
  onEdit: (user: Profile) => void;
  onChangeRole: (user: Profile) => void;
  onDeactivate: (user: Profile) => void;
}

const STATUS_BADGE_CLASSES: Record<ProfileStatus, string> = {
  active: 'bg-success-500/10 text-success-500',
  inactive: 'bg-surface-sunken text-content-tertiary',
  suspended: 'bg-danger-50 text-danger-600',
};

export function UsersTable({ users, actorRole, onEdit, onChangeRole, onDeactivate }: UsersTableProps) {
  if (users.length === 0) {
    return (
      <div className="rounded-card border border-border bg-surface-raised px-4 py-10 text-center text-sm text-content-tertiary">
        No users match your filters.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-card border border-border bg-surface-raised">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wide text-content-tertiary">
            <th scope="col" className="px-4 py-3 font-medium">
              Name
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Role
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Status
            </th>
            <th scope="col" className="px-4 py-3 text-right font-medium">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => {
            const canManage = canManageUser(actorRole, user.role);
            return (
              <tr key={user.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <Link
                    to={`/users/${user.id}`}
                    className="focus-ring rounded font-medium text-content-primary hover:text-brand-600"
                  >
                    {user.firstName} {user.lastName}
                  </Link>
                  <p className="text-content-tertiary">{user.email}</p>
                </td>
                <td className="px-4 py-3 capitalize text-content-secondary">
                  {user.role ? user.role.replace(/_/g, ' ') : '—'}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium capitalize ${STATUS_BADGE_CLASSES[user.status]}`}
                  >
                    {user.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1.5">
                    <Link
                      to={`/users/${user.id}`}
                      className="focus-ring rounded-md px-2 py-1 text-xs font-medium text-content-secondary hover:bg-surface-sunken hover:text-content-primary"
                    >
                      View
                    </Link>
                    {canManage && (
                      <>
                        <button
                          type="button"
                          onClick={() => onEdit(user)}
                          className="focus-ring rounded-md px-2 py-1 text-xs font-medium text-content-secondary hover:bg-surface-sunken hover:text-content-primary"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => onChangeRole(user)}
                          className="focus-ring rounded-md px-2 py-1 text-xs font-medium text-content-secondary hover:bg-surface-sunken hover:text-content-primary"
                        >
                          Change role
                        </button>
                        {user.status === 'active' && (
                          <button
                            type="button"
                            onClick={() => onDeactivate(user)}
                            className="focus-ring rounded-md px-2 py-1 text-xs font-medium text-danger-600 hover:bg-danger-50"
                          >
                            Deactivate
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
