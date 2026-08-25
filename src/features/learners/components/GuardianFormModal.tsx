import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { guardianService } from '@/features/learners/services/guardianService';
import type { GuardianCandidate } from '@/features/learners/services/guardianService';
import { getDbErrorMessage } from '@/lib/dbErrors';
import {
  guardianSchema,
  guardianDefaultValues,
  newGuardianSchema,
  newGuardianDefaultValues,
  type GuardianFormValues,
  type NewGuardianFormValues,
} from '@/features/learners/schemas/guardianSchema';
import type { LearnerGuardian } from '@/features/learners/types/learner.types';

export interface GuardianFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  schoolId: string;
  learnerId: string;
  guardian?: LearnerGuardian | null;
  onSaved: (guardian: LearnerGuardian, candidate?: GuardianCandidate) => void;
}

export function GuardianFormModal({ isOpen, onClose, schoolId, learnerId, guardian, onSaved }: GuardianFormModalProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [candidates, setCandidates] = useState<GuardianCandidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<GuardianCandidate | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const isEditing = Boolean(guardian);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<GuardianFormValues>({ resolver: zodResolver(guardianSchema), defaultValues: guardianDefaultValues });

  const {
    register: registerNew,
    handleSubmit: handleSubmitNew,
    reset: resetNew,
    formState: { errors: newErrors, isSubmitting: isCreatingGuardian },
  } = useForm<NewGuardianFormValues>({ resolver: zodResolver(newGuardianSchema), defaultValues: newGuardianDefaultValues });

  const guardianProfileId = watch('guardianProfileId');

  useEffect(() => {
    if (!isOpen) return;
    reset(
      guardian
        ? {
            guardianProfileId: guardian.guardianProfileId,
            relationshipType: guardian.relationshipType,
            isPrimary: guardian.isPrimary,
            isEmergencyContact: guardian.isEmergencyContact,
            isAuthorizedPickup: guardian.isAuthorizedPickup,
            custodyNotes: guardian.custodyNotes ?? '',
          }
        : guardianDefaultValues,
    );
    resetNew(newGuardianDefaultValues);
    setSelectedCandidate(null);
    setSearch('');
    setIsCreatingNew(false);
    setSubmitError(null);
  }, [isOpen, guardian, reset, resetNew]);

  useEffect(() => {
    if (!isOpen || isEditing || isCreatingNew) return;
    let cancelled = false;
    void guardianService.searchGuardianCandidates(schoolId, search).then((results) => {
      if (!cancelled) setCandidates(results);
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen, isEditing, isCreatingNew, schoolId, search]);

  const onCreateGuardian = async (values: NewGuardianFormValues) => {
    setSubmitError(null);
    try {
      const created = await guardianService.createGuardianProfile({
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        email: values.email.trim(),
        phone: values.phone?.trim() || null,
        address: values.address?.trim() || null,
        idNumber: values.idNumber?.trim() || null,
      });
      setValue('guardianProfileId', created.id, { shouldValidate: true });
      setSelectedCandidate(created);
      setIsCreatingNew(false);
    } catch (error) {
      setSubmitError(getDbErrorMessage(error, 'Failed to create guardian.'));
    }
  };

  const onValid = async (values: GuardianFormValues) => {
    setSubmitError(null);
    try {
      if (guardian) {
        const saved = await guardianService.updateGuardian(guardian.id, {
          relationshipType: values.relationshipType,
          isPrimary: values.isPrimary,
          isEmergencyContact: values.isEmergencyContact,
          isAuthorizedPickup: values.isAuthorizedPickup,
          custodyNotes: values.custodyNotes?.trim() || null,
        });
        onSaved(saved);
      } else {
        const saved = await guardianService.createGuardian(schoolId, learnerId, {
          guardianProfileId: values.guardianProfileId,
          relationshipType: values.relationshipType,
          isPrimary: values.isPrimary,
          isEmergencyContact: values.isEmergencyContact,
          isAuthorizedPickup: values.isAuthorizedPickup,
          custodyNotes: values.custodyNotes?.trim() || null,
        });
        onSaved(saved, selectedCandidate ?? undefined);
      }
      onClose();
    } catch (error) {
      setSubmitError(getDbErrorMessage(error, 'Failed to save guardian.'));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit guardian' : isCreatingNew ? 'Create new guardian' : 'Add guardian'}
      footer={
        isCreatingNew ? (
          <Button type="submit" form="new-guardian-form" isLoading={isCreatingGuardian}>
            {isCreatingGuardian ? 'Creating…' : 'Create guardian'}
          </Button>
        ) : (
          <Button type="submit" form="guardian-form" isLoading={isSubmitting} disabled={!isEditing && !guardianProfileId}>
            {isSubmitting ? 'Saving…' : 'Save'}
          </Button>
        )
      }
    >
      {submitError && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-600"
        >
          {submitError}
        </div>
      )}

      {isCreatingNew ? (
        <form noValidate id="new-guardian-form" onSubmit={handleSubmitNew(onCreateGuardian)} className="flex flex-col gap-4">
          <p className="text-sm text-content-tertiary">
            This creates a new guardian account not yet on file, then links them to this learner.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField label="First name" required error={newErrors.firstName?.message} {...registerNew('firstName')} />
            <TextField label="Last name" required error={newErrors.lastName?.message} {...registerNew('lastName')} />
          </div>
          <TextField label="Email" type="email" required error={newErrors.email?.message} {...registerNew('email')} />
          <TextField label="Phone" error={newErrors.phone?.message} {...registerNew('phone')} />
          <TextField label="Address" error={newErrors.address?.message} {...registerNew('address')} />
          <TextField label="ID / reference number" error={newErrors.idNumber?.message} {...registerNew('idNumber')} />
          <button
            type="button"
            onClick={() => setIsCreatingNew(false)}
            className="focus-ring self-start text-sm font-medium text-content-secondary hover:text-content-primary"
          >
            ← Back to search
          </button>
        </form>
      ) : (
        <form noValidate id="guardian-form" onSubmit={handleSubmit(onValid)} className="flex flex-col gap-4">
          {!isEditing && (
            <div>
              <TextField
                label="Search guardian"
                placeholder="Search by name or email…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <div className="mt-2 flex flex-col gap-1">
                {candidates.map((candidate) => (
                  <button
                    key={candidate.id}
                    type="button"
                    onClick={() => {
                      setValue('guardianProfileId', candidate.id, { shouldValidate: true });
                      setSelectedCandidate(candidate);
                    }}
                    className={`focus-ring rounded-lg border px-3 py-2 text-left text-sm ${
                      guardianProfileId === candidate.id
                        ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10'
                        : 'border-border-strong bg-surface-raised hover:bg-surface-sunken'
                    }`}
                  >
                    <span className="font-medium text-content-primary">
                      {candidate.firstName} {candidate.lastName}
                    </span>{' '}
                    <span className="text-content-tertiary">{candidate.email}</span>
                  </button>
                ))}
              </div>
              {errors.guardianProfileId && (
                <p role="alert" className="mt-1.5 text-xs font-medium text-danger-600">
                  {errors.guardianProfileId.message}
                </p>
              )}
              <button
                type="button"
                onClick={() => setIsCreatingNew(true)}
                className="focus-ring mt-2 text-sm font-medium text-brand-600 hover:underline dark:text-brand-300"
              >
                Can't find them? Create new guardian
              </button>
            </div>
          )}

          <div>
            <label htmlFor="guardian-relationship" className="mb-1.5 block text-sm font-medium text-content-primary">
              Relationship
            </label>
            <select
              id="guardian-relationship"
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
            <input
              type="checkbox"
              className="focus-ring h-4 w-4 rounded border-border-strong"
              {...register('isEmergencyContact')}
            />
            Emergency contact
          </label>

          <label className="flex items-center gap-2 text-sm text-content-secondary">
            <input
              type="checkbox"
              className="focus-ring h-4 w-4 rounded border-border-strong"
              {...register('isAuthorizedPickup')}
            />
            Authorised for pickup
          </label>

          <TextField label="Custody notes" error={errors.custodyNotes?.message} {...register('custodyNotes')} />
        </form>
      )}
    </Modal>
  );
}
