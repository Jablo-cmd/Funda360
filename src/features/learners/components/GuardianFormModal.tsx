import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { guardianService } from '@/features/learners/services/guardianService';
import type { GuardianCandidate } from '@/features/learners/services/guardianService';
import { getDbErrorMessage } from '@/lib/dbErrors';
import { guardianSchema, guardianDefaultValues, type GuardianFormValues } from '@/features/learners/schemas/guardianSchema';
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
  const isEditing = Boolean(guardian);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<GuardianFormValues>({ resolver: zodResolver(guardianSchema), defaultValues: guardianDefaultValues });

  const guardianProfileId = watch('guardianProfileId');

  useEffect(() => {
    if (!isOpen) return;
    reset(
      guardian
        ? {
            guardianProfileId: guardian.guardianProfileId,
            relationshipType: guardian.relationshipType,
            isPrimary: guardian.isPrimary,
            custodyNotes: guardian.custodyNotes ?? '',
          }
        : guardianDefaultValues,
    );
    setSelectedCandidate(null);
    setSearch('');
    setSubmitError(null);
  }, [isOpen, guardian, reset]);

  useEffect(() => {
    if (!isOpen || isEditing) return;
    let cancelled = false;
    void guardianService.searchGuardianCandidates(schoolId, search).then((results) => {
      if (!cancelled) setCandidates(results);
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen, isEditing, schoolId, search]);

  const onValid = async (values: GuardianFormValues) => {
    setSubmitError(null);
    try {
      if (guardian) {
        const saved = await guardianService.updateGuardian(guardian.id, {
          relationshipType: values.relationshipType,
          isPrimary: values.isPrimary,
          custodyNotes: values.custodyNotes?.trim() || null,
        });
        onSaved(saved);
      } else {
        const saved = await guardianService.createGuardian(schoolId, learnerId, {
          guardianProfileId: values.guardianProfileId,
          relationshipType: values.relationshipType,
          isPrimary: values.isPrimary,
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
      title={isEditing ? 'Edit guardian' : 'Add guardian'}
      footer={
        <Button type="submit" form="guardian-form" isLoading={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Save'}
        </Button>
      }
    >
      <form noValidate id="guardian-form" onSubmit={handleSubmit(onValid)} className="flex flex-col gap-4">
        {submitError && (
          <div
            role="alert"
            className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-600"
          >
            {submitError}
          </div>
        )}

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
          <input
            type="checkbox"
            className="focus-ring h-4 w-4 rounded border-border-strong"
            {...register('isPrimary')}
          />
          Primary guardian
        </label>

        <TextField label="Custody notes" error={errors.custodyNotes?.message} {...register('custodyNotes')} />
      </form>
    </Modal>
  );
}
