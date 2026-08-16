import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { documentService } from '@/features/learners/services/documentService';
import { getDbErrorMessage } from '@/lib/dbErrors';
import { documentSchema, documentDefaultValues, type DocumentFormValues } from '@/features/learners/schemas/documentSchema';
import type { LearnerDocument } from '@/features/learners/types/learner.types';

export interface DocumentFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  schoolId: string;
  learnerId: string;
  onSaved: (document: LearnerDocument) => void;
}

export function DocumentFormModal({ isOpen, onClose, schoolId, learnerId, onSaved }: DocumentFormModalProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<DocumentFormValues>({ resolver: zodResolver(documentSchema), defaultValues: documentDefaultValues });

  useEffect(() => {
    if (!isOpen) return;
    reset(documentDefaultValues);
    setSubmitError(null);
  }, [isOpen, reset]);

  const onValid = async (values: DocumentFormValues) => {
    setSubmitError(null);
    try {
      const saved = await documentService.createDocument(schoolId, learnerId, {
        documentType: values.documentType,
        fileUrl: values.fileUrl,
        fileName: values.fileName?.trim() || null,
        notes: values.notes?.trim() || null,
      });
      onSaved(saved);
      onClose();
    } catch (error) {
      setSubmitError(getDbErrorMessage(error, 'Failed to save document.'));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add document"
      footer={
        <Button type="submit" form="document-form" isLoading={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Save'}
        </Button>
      }
    >
      <form noValidate id="document-form" onSubmit={handleSubmit(onValid)} className="flex flex-col gap-4">
        {submitError && (
          <div
            role="alert"
            className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-600"
          >
            {submitError}
          </div>
        )}

        <div>
          <label htmlFor="document-type" className="mb-1.5 block text-sm font-medium text-content-primary">
            Document type
          </label>
          <select
            id="document-type"
            className="focus-ring h-11 w-full rounded-lg border border-border-strong bg-surface-raised px-3.5 text-sm text-content-primary"
            {...register('documentType')}
          >
            <option value="birth_certificate">Birth certificate</option>
            <option value="id_copy">ID copy</option>
            <option value="passport">Passport</option>
            <option value="permit">Permit</option>
            <option value="transfer_letter">Transfer letter</option>
            <option value="medical_certificate">Medical certificate</option>
            <option value="report_card">Report card</option>
            <option value="other">Other</option>
          </select>
        </div>

        <TextField label="File URL" required error={errors.fileUrl?.message} {...register('fileUrl')} />
        <TextField label="File name" error={errors.fileName?.message} {...register('fileName')} />
        <TextField label="Notes" error={errors.notes?.message} {...register('notes')} />
      </form>
    </Modal>
  );
}
