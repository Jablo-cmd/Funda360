import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { userService } from '@/features/users/services/userService';
import { editUserSchema, type EditUserFormValues } from '@/features/users/schemas/editUserSchema';
import type { Profile } from '@/types/profile.types';

export interface EditUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: Profile;
  onUpdated: () => void;
}

export function EditUserModal({ isOpen, onClose, user, onUpdated }: EditUserModalProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EditUserFormValues>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone ?? '',
    },
  });

  useEffect(() => {
    if (isOpen) {
      reset({ firstName: user.firstName, lastName: user.lastName, phone: user.phone ?? '' });
      setSubmitError(null);
    }
  }, [isOpen, user, reset]);

  const onValid = async (values: EditUserFormValues) => {
    setSubmitError(null);
    try {
      await userService.updateUser(user.id, {
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        phone: values.phone?.trim() || null,
      });
      onUpdated();
      onClose();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to update user.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit user"
      footer={
        <Button type="submit" form="edit-user-form" isLoading={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Save changes'}
        </Button>
      }
    >
      <form noValidate id="edit-user-form" onSubmit={handleSubmit(onValid)} className="flex flex-col gap-4">
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
        <TextField label="Email" defaultValue={user.email} disabled hint="Email changes aren't supported yet." />
        <TextField label="Phone" type="tel" error={errors.phone?.message} {...register('phone')} />
      </form>
    </Modal>
  );
}
