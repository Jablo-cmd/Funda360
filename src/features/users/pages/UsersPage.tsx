import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/features/auth/context/authContext';
import { useUsersList } from '@/features/users/hooks/useUsersList';
import { UsersFiltersBar } from '@/features/users/components/UsersFiltersBar';
import { UsersTable } from '@/features/users/components/UsersTable';
import { UsersPagination } from '@/features/users/components/UsersPagination';
import { CreateUserModal } from '@/features/users/components/CreateUserModal';
import { EditUserModal } from '@/features/users/components/EditUserModal';
import { ChangeRoleModal } from '@/features/users/components/ChangeRoleModal';
import { DeactivateUserDialog } from '@/features/users/components/DeactivateUserDialog';
import { canManageUsers } from '@/features/users/utils/userPermissions';
import type { Profile } from '@/types/profile.types';

export function UsersPage() {
  const { user } = useAuth();
  const actorRole = user?.role ?? null;
  const { users, totalCount, page, pageSize, isLoading, error, filters, setFilters, setPage, refetch } =
    useUsersList();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [roleChangeUser, setRoleChangeUser] = useState<Profile | null>(null);
  const [deactivatingUser, setDeactivatingUser] = useState<Profile | null>(null);

  const canManage = canManageUsers(actorRole);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-content-primary">Users</h1>
          <p className="mt-1 text-sm text-content-secondary">Manage the staff accounts at your school.</p>
        </div>
        {canManage && (
          <div className="w-full sm:w-auto sm:min-w-[9rem]">
            <Button type="button" onClick={() => setIsCreateOpen(true)}>
              Add user
            </Button>
          </div>
        )}
      </div>

      <UsersFiltersBar filters={filters} onChange={setFilters} />

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-600"
        >
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <span
            aria-hidden="true"
            className="h-8 w-8 animate-spin-smooth rounded-full border-2 border-brand-600 border-t-transparent"
          />
          <span className="sr-only">Loading users…</span>
        </div>
      ) : (
        <>
          <UsersTable
            users={users}
            actorRole={actorRole}
            onEdit={setEditingUser}
            onChangeRole={setRoleChangeUser}
            onDeactivate={setDeactivatingUser}
          />
          <UsersPagination page={page} pageSize={pageSize} totalCount={totalCount} onPageChange={setPage} />
        </>
      )}

      <CreateUserModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        actorRole={actorRole}
        onCreated={refetch}
      />

      {editingUser && (
        <EditUserModal
          isOpen={Boolean(editingUser)}
          onClose={() => setEditingUser(null)}
          user={editingUser}
          onUpdated={refetch}
        />
      )}
      {roleChangeUser && (
        <ChangeRoleModal
          isOpen={Boolean(roleChangeUser)}
          onClose={() => setRoleChangeUser(null)}
          user={roleChangeUser}
          actorRole={actorRole}
          onRoleChanged={refetch}
        />
      )}
      {deactivatingUser && (
        <DeactivateUserDialog
          isOpen={Boolean(deactivatingUser)}
          onClose={() => setDeactivatingUser(null)}
          user={deactivatingUser}
          onDeactivated={refetch}
        />
      )}
    </div>
  );
}
