import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { useTenant } from '@/features/tenant/context/tenantContext';
import { getDbErrorMessage } from '@/lib/dbErrors';
import {
  schoolCreateSchema,
  schoolCreateDefaultValues,
  type SchoolCreateFormValues,
} from '@/features/tenant/schemas/schoolCreateSchema';
import type { School } from '@/types/school.types';

export interface CreateSchoolModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (school: School) => void;
}

/** Onboarding is create-only — full profile details (contact info, address, logo) are edited afterwards on the School Profile page, once the new school is the active tenant. */
export function CreateSchoolModal({ isOpen, onClose, onCreated }: CreateSchoolModalProps) {
  const { createSchool } = useTenant();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SchoolCreateFormValues>({
    resolver: zodResolver(schoolCreateSchema),
    defaultValues: schoolCreateDefaultValues,
  });

  useEffect(() => {
    if (!isOpen) return;
    reset(schoolCreateDefaultValues);
    setSubmitError(null);
  }, [isOpen, reset]);

  const onValid = async (values: SchoolCreateFormValues) => {
    setSubmitError(null);
    try {
      const school = await createSchool({
        name: values.name,
        schoolType: values.schoolType,
        status: values.status,
        province: values.province?.trim() || null,
      });
      onCreated(school);
      onClose();
    } catch (error) {
      setSubmitError(getDbErrorMessage(error, 'Failed to create school.'));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create school"
      footer={
        <Button type="submit" form="create-school-form" isLoading={isSubmitting}>
          {isSubmitting ? 'Creating…' : 'Create school'}
        </Button>
      }
    >
      <form
        noValidate
        id="create-school-form"
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

        <TextField
          label="School name"
          required
          placeholder="Riverside Secondary School"
          error={errors.name?.message}
          {...register('name')}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="create-school-type"
              className="mb-1.5 block text-sm font-medium text-content-primary"
            >
              School type
            </label>
            <select
              id="create-school-type"
              className="focus-ring h-11 w-full rounded-md border border-border-strong bg-surface-raised px-3.5 text-sm text-content-primary"
              {...register('schoolType')}
            >
              <option value="public">Public</option>
              <option value="private">Private</option>
              <option value="independent">Independent</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="create-school-status"
              className="mb-1.5 block text-sm font-medium text-content-primary"
            >
              Status
            </label>
            <select
              id="create-school-status"
              className="focus-ring h-11 w-full rounded-md border border-border-strong bg-surface-raised px-3.5 text-sm text-content-primary"
              {...register('status')}
            >
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
        </div>

        <TextField
          label="Province"
          placeholder="Gauteng"
          error={errors.province?.message}
          {...register('province')}
        />
      </form>
    </Modal>
  );
}
