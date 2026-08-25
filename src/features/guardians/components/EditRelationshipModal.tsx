import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { guardianService } from '@/features/learners/services/guardianService';
import { getDbErrorMessage } from '@/lib/dbErrors';
import { guardianSchema, type GuardianFormValues } from '@/features/learners/schemas/guardianSchema';
import type { GuardianLearnerLink } from '@/features/guardians/types/guardian.types';

export interface EditRelationshipModalProps {
  isOpen: boolean;
  onClose: () => void;
  link: GuardianLearnerLink | null;
  onSaved: () => void;
}

/**
 * Edits an existing learner_guardians relationship's metadata from the
 * Guardian Profile page (not tied to a specific learner's own page, unlike
 * GuardianFormModal, which requires a learnerId even in its edit path) —
 * still calls the same guardianService.updateGuardian() this whole
 * relationship-metadata concern already lives in.
 */
export function EditRelationshipModal({ isOpen, onClose, link, onSaved }: EditRelationshipModalProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<Omit<GuardianFormValues, 'guardianProfileId'>>({
    resolver: zodResolver(guardianSchema.omit({ guardianProfileId: true })),
  });

  useEffect(() => {
    if (!isOpen || !link) return;
    reset({
      relationshipType: link.relationshipType,
      isPrimary: link.isPrimary,
      isEmergencyContact: link.isEmergencyContact,
      isAuthorizedPickup: link.isAuthorizedPickup,
      custodyNotes: link.custodyNotes ?? '',
    });
    setSubmitError(null);
  }, [isOpen, link, reset]);

  if (!link) return null;

  const onValid = async (values: Omit<GuardianFormValues, 'guardianProfileId'>) => {
    setSubmitError(null);
    try {
      await guardianService.updateGuardian(link.relationshipId, {
        relationshipType: values.relationshipType,
        isPrimary: values.isPrimary,
        isEmergencyContact: values.isEmergencyContact,
        isAuthorizedPickup: values.isAuthorizedPickup,
        custodyNotes: values.custodyNotes?.trim() || null,
      });
      onSaved();
      onClose();
    } catch (error) {
      setSubmitError(getDbErrorMessage(error, 'Failed to update relationship.'));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Edit relationship — ${link.learnerFirstName} ${link.learnerLastName}`}
      footer={
        <Button type="submit" form="edit-relationship-form" isLoading={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Save'}
        </Button>
      }
    >
      <form noValidate id="edit-relationship-form" onSubmit={handleSubmit(onValid)} className="flex flex-col gap-4">
        {submitError && (
          <div role="alert" className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-600">
            {submitError}
          </div>
        )}

        <div>
          <label htmlFor="edit-relationship-type" className="mb-1.5 block text-sm font-medium text-content-primary">
            Relationship
          </label>
          <select
            id="edit-relationship-type"
            className="focus-ring h-11 w-full rounded-lg border border-border-strong bg-surface-raised px-3.5 text-sm text-content-primary"
            {...register('relationshipType')}
          >
            <option value="mother">Mother</option>
            <option value="father">Father</option>
            <option value="legal_guardian">Legal guardian</option>
            <option value="grandparent">Grandparent</option>
            <option value="sibling">Sibling</option>
            <option value="other">Other</option>
          </select>
        </div>

        <label className="flex items-center gap-2 text-sm text-content-secondary">
          <input type="checkbox" className="focus-ring h-4 w-4 rounded border-border-strong" {...register('isPrimary')} />
          Primary guardian
        </label>
        <label className="flex items-center gap-2 text-sm text-content-secondary">
          <input type="checkbox" className="focus-ring h-4 w-4 rounded border-border-strong" {...register('isEmergencyContact')} />
          Emergency contact
        </label>
        <label className="flex items-center gap-2 text-sm text-content-secondary">
          <input type="checkbox" className="focus-ring h-4 w-4 rounded border-border-strong" {...register('isAuthorizedPickup')} />
          Authorised for pickup
        </label>

        <TextField label="Custody notes" {...register('custodyNotes')} />
      </form>
    </Modal>
  );
}
