import { useEffect, useState, type ChangeEvent } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { documentService, LEARNER_DOCUMENT_FILE_RULE } from '@/features/learners/services/documentService';
import { storage } from '@/lib/storage';
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
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<DocumentFormValues>({ resolver: zodResolver(documentSchema), defaultValues: documentDefaultValues });

  useEffect(() => {
    if (!isOpen) return;
    reset(documentDefaultValues);
    setSubmitError(null);
    setFile(null);
    setFileError(null);
  }, [isOpen, reset]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null;
    if (!selected) {
      setFile(null);
      setFileError(null);
      return;
    }
    const validationError = storage.validateFile(selected, LEARNER_DOCUMENT_FILE_RULE);
    setFileError(validationError);
    setFile(validationError ? null : selected);
  };

  const onValid = async (values: DocumentFormValues) => {
    if (!file) {
      setFileError('Choose a file to upload.');
      return;
    }
    setSubmitError(null);
    setIsUploading(true);
    try {
      const saved = await documentService.createDocument(schoolId, learnerId, {
        documentType: values.documentType,
        file,
        notes: values.notes?.trim() || null,
      });
      onSaved(saved);
      onClose();
    } catch (error) {
      setSubmitError(getDbErrorMessage(error, 'Failed to upload document.'));
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add document"
      footer={
        <Button type="submit" form="document-form" isLoading={isUploading}>
          {isUploading ? 'Uploading…' : 'Save'}
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

        <div>
          <label htmlFor="document-file" className="mb-1.5 block text-sm font-medium text-content-primary">
            File
          </label>
          <input
            id="document-file"
            type="file"
            accept={LEARNER_DOCUMENT_FILE_RULE.allowedMimeTypes.join(',')}
            onChange={handleFileChange}
            className="focus-ring block w-full text-sm text-content-secondary file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3.5 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100 dark:file:bg-brand-500/15 dark:file:text-brand-300"
          />
          <p className="mt-1.5 text-xs text-content-tertiary">PDF, JPEG, or PNG, up to 15MB.</p>
          {fileError && <p className="mt-1.5 text-xs font-medium text-danger-600">{fileError}</p>}
        </div>

        <TextField label="Notes" error={errors.notes?.message} {...register('notes')} />
      </form>
    </Modal>
  );
}
