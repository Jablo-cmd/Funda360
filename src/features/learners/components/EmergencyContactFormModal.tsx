import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { emergencyContactService } from '@/features/learners/services/emergencyContactService';
import {
  emergencyContactSchema,
  emergencyContactDefaultValues,
  type EmergencyContactFormValues,
} from '@/features/learners/schemas/emergencyContactSchema';
import type { LearnerEmergencyContact } from '@/features/learners/types/learner.types';

export interface EmergencyContactFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  schoolId: string;
  learnerId: string;
  contact?: LearnerEmergencyContact | null;
  onSaved: (contact: LearnerEmergencyContact) => void;
}

export function EmergencyContactFormModal({
  isOpen,
  onClose,
  schoolId,
  learnerId,
  contact,
  onSaved,
}: EmergencyContactFormModalProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const isEditing = Boolean(contact);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EmergencyContactFormValues>({
    resolver: zodResolver(emergencyContactSchema),
    defaultValues: emergencyContactDefaultValues,
  });

  useEffect(() => {
    if (!isOpen) return;
    reset(
      contact
        ? {
            name: contact.name,
            relationship: contact.relationship ?? '',
            phone: contact.phone,
            alternatePhone: contact.alternatePhone ?? '',
          }
        : emergencyContactDefaultValues,
    );
    setSubmitError(null);
  }, [isOpen, contact, reset]);

  const onValid = async (values: EmergencyContactFormValues) => {
    setSubmitError(null);
    try {
      const payload = {
        name: values.name,
        relationship: values.relationship?.trim() || null,
        phone: values.phone,
        alternatePhone: values.alternatePhone?.trim() || null,
      };
      const saved = contact
        ? await emergencyContactService.updateEmergencyContact(contact.id, payload)
        : await emergencyContactService.createEmergencyContact(schoolId, learnerId, payload);
      onSaved(saved);
      onClose();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to save emergency contact.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit emergency contact' : 'Add emergency contact'}
      footer={
        <Button type="submit" form="emergency-contact-form" isLoading={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Save'}
        </Button>
      }
    >
      <form noValidate id="emergency-contact-form" onSubmit={handleSubmit(onValid)} className="flex flex-col gap-4">
        {submitError && (
          <div
            role="alert"
            className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-600"
          >
            {submitError}
          </div>
        )}

        <TextField label="Name" required error={errors.name?.message} {...register('name')} />
        <TextField label="Relationship" error={errors.relationship?.message} {...register('relationship')} />
        <TextField label="Phone" required error={errors.phone?.message} {...register('phone')} />
        <TextField label="Alternate phone" error={errors.alternatePhone?.message} {...register('alternatePhone')} />
      </form>
    </Modal>
  );
}
