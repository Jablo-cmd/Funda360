import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { guardianDirectoryService } from '@/features/guardians/services/guardianDirectoryService';
import { getDbErrorMessage } from '@/lib/dbErrors';
import {
  newGuardianSchema,
  newGuardianDefaultValues,
  type NewGuardianFormValues,
} from '@/features/learners/schemas/guardianSchema';

export interface CreateGuardianModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function CreateGuardianModal({ isOpen, onClose, onSaved }: CreateGuardianModalProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<NewGuardianFormValues>({ resolver: zodResolver(newGuardianSchema), defaultValues: newGuardianDefaultValues });

  useEffect(() => {
    if (!isOpen) return;
    reset(newGuardianDefaultValues);
    setSubmitError(null);
  }, [isOpen, reset]);

  const onValid = async (values: NewGuardianFormValues) => {
    setSubmitError(null);
    try {
      await guardianDirectoryService.createGuardian({
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        email: values.email.trim(),
        phone: values.phone?.trim() || null,
        address: values.address?.trim() || null,
        idNumber: values.idNumber?.trim() || null,
      });
      onSaved();
      onClose();
    } catch (error) {
      setSubmitError(getDbErrorMessage(error, 'Failed to create guardian.'));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add guardian"
      footer={
        <Button type="submit" form="create-guardian-form" isLoading={isSubmitting}>
          {isSubmitting ? 'Creating…' : 'Create guardian'}
        </Button>
      }
    >
      <form noValidate id="create-guardian-form" onSubmit={handleSubmit(onValid)} className="flex flex-col gap-4">
        {submitError && (
          <div role="alert" className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-600">
            {submitError}
          </div>
        )}
        <p className="text-sm text-content-tertiary">
          Creates a guardian account not yet linked to a learner. Link them to a learner from their profile, or from the
          learner's own Guardians tab.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label="First name" required error={errors.firstName?.message} {...register('firstName')} />
          <TextField label="Last name" required error={errors.lastName?.message} {...register('lastName')} />
        </div>
        <TextField label="Email" type="email" required error={errors.email?.message} {...register('email')} />
        <TextField label="Phone" error={errors.phone?.message} {...register('phone')} />
        <TextField label="Address" error={errors.address?.message} {...register('address')} />
        <TextField label="ID / reference number" error={errors.idNumber?.message} {...register('idNumber')} />
      </form>
    </Modal>
  );
}
