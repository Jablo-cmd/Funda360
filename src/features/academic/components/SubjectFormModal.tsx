import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { subjectService } from '@/features/academic/services/subjectService';
import { subjectSchema, subjectDefaultValues, type SubjectFormValues } from '@/features/academic/schemas/subjectSchema';
import type { Subject } from '@/features/academic/types/academic.types';

export interface SubjectFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  schoolId: string;
  subject?: Subject | null;
  onSaved: () => void;
}

export function SubjectFormModal({ isOpen, onClose, schoolId, subject, onSaved }: SubjectFormModalProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const isEditing = Boolean(subject);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SubjectFormValues>({ resolver: zodResolver(subjectSchema), defaultValues: subjectDefaultValues });

  useEffect(() => {
    if (!isOpen) return;
    reset(
      subject
        ? { name: subject.name, code: subject.code ?? '', description: subject.description ?? '' }
        : subjectDefaultValues,
    );
    setSubmitError(null);
  }, [isOpen, subject, reset]);

  const onValid = async (values: SubjectFormValues) => {
    setSubmitError(null);
    try {
      const payload = {
        name: values.name,
        code: values.code?.trim() || null,
        description: values.description?.trim() || null,
      };
      if (subject) {
        await subjectService.updateSubject(subject.id, payload);
      } else {
        await subjectService.createSubject(schoolId, payload);
      }
      onSaved();
      onClose();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to save subject.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit subject' : 'Add subject'}
      footer={
        <Button type="submit" form="subject-form" isLoading={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Save'}
        </Button>
      }
    >
      <form noValidate id="subject-form" onSubmit={handleSubmit(onValid)} className="flex flex-col gap-4">
        {submitError && (
          <div
            role="alert"
            className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-600"
          >
            {submitError}
          </div>
        )}

        <TextField
          label="Name"
          required
          placeholder="Mathematics"
          error={errors.name?.message}
          {...register('name')}
        />
        <TextField label="Code" placeholder="MATH" error={errors.code?.message} {...register('code')} />
        <TextField label="Description" error={errors.description?.message} {...register('description')} />
      </form>
    </Modal>
  );
}
