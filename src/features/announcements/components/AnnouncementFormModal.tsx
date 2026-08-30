import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { announcementService } from '@/features/announcements/services/announcementService';
import { getDbErrorMessage } from '@/lib/dbErrors';
import {
  announcementSchema,
  announcementDefaultValues,
  type AnnouncementFormValues,
} from '@/features/announcements/schemas/announcementSchema';

export interface AnnouncementFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  schoolId: string;
  onSaved: () => void;
}

const AUDIENCE_LABELS: Record<AnnouncementFormValues['audience'], string> = {
  everyone: 'Everyone (staff and guardians)',
  all_staff: 'Staff only',
  all_guardians: 'Guardians only',
};

export function AnnouncementFormModal({ isOpen, onClose, schoolId, onSaved }: AnnouncementFormModalProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AnnouncementFormValues>({ resolver: zodResolver(announcementSchema), defaultValues: announcementDefaultValues });

  useEffect(() => {
    if (!isOpen) return;
    reset(announcementDefaultValues);
    setSubmitError(null);
  }, [isOpen, reset]);

  const onValid = async (values: AnnouncementFormValues) => {
    setSubmitError(null);
    try {
      await announcementService.createAnnouncement(schoolId, values);
      onSaved();
      onClose();
    } catch (error) {
      setSubmitError(getDbErrorMessage(error, 'Failed to post announcement.'));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Post announcement"
      footer={
        <Button type="submit" form="announcement-form" isLoading={isSubmitting}>
          {isSubmitting ? 'Posting…' : 'Post announcement'}
        </Button>
      }
    >
      <form noValidate id="announcement-form" onSubmit={handleSubmit(onValid)} className="flex flex-col gap-4">
        {submitError && (
          <div role="alert" className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-600">
            {submitError}
          </div>
        )}

        <TextField label="Title" required error={errors.title?.message} {...register('title')} />

        <div>
          <label htmlFor="announcement-body" className="mb-1.5 block text-sm font-medium text-content-primary">
            Message <span className="text-danger-600">*</span>
          </label>
          <textarea
            id="announcement-body"
            rows={5}
            aria-invalid={Boolean(errors.body?.message) || undefined}
            className={`focus-ring w-full rounded-md border bg-surface-raised px-3.5 py-2.5 text-sm text-content-primary placeholder:text-content-tertiary transition-colors duration-150 ${
              errors.body?.message ? 'border-danger-500 focus-visible:ring-danger-500' : 'border-border-strong'
            }`}
            {...register('body')}
          />
          {errors.body?.message && <p className="mt-1.5 text-sm text-danger-600">{errors.body.message}</p>}
        </div>

        <div>
          <label htmlFor="announcement-audience" className="mb-1.5 block text-sm font-medium text-content-primary">
            Audience
          </label>
          <select
            id="announcement-audience"
            className="focus-ring h-11 w-full rounded-md border border-border-strong bg-surface-raised px-3.5 text-sm text-content-primary"
            {...register('audience')}
          >
            {Object.entries(AUDIENCE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </form>
    </Modal>
  );
}
