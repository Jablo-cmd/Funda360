import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { userService } from '@/features/users/services/userService';
import { canAssignRole } from '@/features/users/utils/userPermissions';
import { ASSIGNABLE_ROLES, ASSIGNABLE_ROLE_LABELS } from '@/features/users/types/user.types';
import type { CreateUserResult } from '@/features/users/types/user.types';
import {
  createUserSchema,
  createUserDefaultValues,
  type CreateUserFormValues,
} from '@/features/users/schemas/createUserSchema';
import type { UserRole } from '@/features/auth/types/auth.types';

export interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  actorRole: UserRole | null;
  onCreated: () => void;
}

export function CreateUserModal({ isOpen, onClose, actorRole, onCreated }: CreateUserModalProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateUserResult | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: createUserDefaultValues,
  });

  const assignableRoles = ASSIGNABLE_ROLES.filter((role) => canAssignRole(actorRole, role, null));

  const handleClose = () => {
    setSubmitError(null);
    setResult(null);
    reset(createUserDefaultValues);
    onClose();
  };

  const onValid = async (values: CreateUserFormValues) => {
    setSubmitError(null);
    try {
      const created = await userService.createUser({
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        email: values.email.trim(),
        phone: values.phone?.trim() || null,
        role: values.role,
      });
      setResult(created);
      onCreated();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to create user.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={result ? 'User created' : 'Add user'}
      footer={
        result ? (
          <Button type="button" onClick={handleClose}>
            Done
          </Button>
        ) : (
          <Button type="submit" form="create-user-form" isLoading={isSubmitting}>
            {isSubmitting ? 'Creating…' : 'Create user'}
          </Button>
        )
      }
    >
      {result ? (
        <div className="flex flex-col gap-4">
          <div
            role="status"
            className="rounded-lg border border-success-500/30 bg-success-500/10 px-3.5 py-2.5 text-sm font-medium text-success-500"
          >
            The account was created successfully.
          </div>
          <div className="rounded-lg border border-border bg-surface-sunken px-3.5 py-3 text-sm">
            <p className="text-content-secondary">
              Temporary password — share this with the new user, it won&apos;t be shown again:
            </p>
            <p className="mt-1.5 select-all break-all font-mono text-content-primary">
              {result.temporaryPassword}
            </p>
          </div>
        </div>
      ) : (
        <form
          noValidate
          id="create-user-form"
          onSubmit={handleSubmit(onValid)}
          className="flex flex-col gap-4"
        >
          {submitError && (
            <div
              role="alert"
              className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-600"
            >
              {submitError}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField label="First name" required error={errors.firstName?.message} {...register('firstName')} />
            <TextField label="Last name" required error={errors.lastName?.message} {...register('lastName')} />
          </div>
          <TextField label="Email" type="email" required error={errors.email?.message} {...register('email')} />
          <TextField label="Phone" type="tel" error={errors.phone?.message} {...register('phone')} />

          <div>
            <label htmlFor="create-user-role" className="mb-1.5 block text-sm font-medium text-content-primary">
              Role{' '}
              <span className="text-danger-600" aria-hidden="true">
                *
              </span>
            </label>
            <select
              id="create-user-role"
              className="focus-ring h-11 w-full rounded-lg border border-border-strong bg-surface-raised px-3.5 text-sm text-content-primary"
              {...register('role')}
            >
              {assignableRoles.map((role) => (
                <option key={role} value={role}>
                  {ASSIGNABLE_ROLE_LABELS[role]}
                </option>
              ))}
            </select>
            {errors.role && (
              <p role="alert" className="mt-1.5 text-xs font-medium text-danger-600">
                {errors.role.message}
              </p>
            )}
          </div>
        </form>
      )}
    </Modal>
  );
}