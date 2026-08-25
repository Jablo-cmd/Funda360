import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { learnerService } from '@/features/learners/services/learnerService';
import { guardianService } from '@/features/learners/services/guardianService';
import { getDbErrorMessage } from '@/lib/dbErrors';
import type { Learner } from '@/features/learners/types/learner.types';

const linkLearnerSchema = z.object({
  learnerId: z.string().trim().min(1, 'Select a learner'),
  relationshipType: z.union([
    z.literal('mother'),
    z.literal('father'),
    z.literal('legal_guardian'),
    z.literal('grandparent'),
    z.literal('sibling'),
    z.literal('other'),
  ]),
  isPrimary: z.boolean().optional(),
  isEmergencyContact: z.boolean().optional(),
  isAuthorizedPickup: z.boolean().optional(),
});

type LinkLearnerFormValues = z.infer<typeof linkLearnerSchema>;

const defaultValues: LinkLearnerFormValues = {
  learnerId: '',
  relationshipType: 'mother',
  isPrimary: false,
  isEmergencyContact: false,
  isAuthorizedPickup: false,
};

export interface LinkLearnerModalProps {
  isOpen: boolean;
  onClose: () => void;
  schoolId: string;
  guardianProfileId: string;
  onSaved: () => void;
}

export function LinkLearnerModal({ isOpen, onClose, schoolId, guardianProfileId, onSaved }: LinkLearnerModalProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Learner[]>([]);
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<LinkLearnerFormValues>({ resolver: zodResolver(linkLearnerSchema), defaultValues });

  const learnerId = watch('learnerId');

  useEffect(() => {
    if (!isOpen) return;
    reset(defaultValues);
    setSearch('');
    setSubmitError(null);
  }, [isOpen, reset]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    void learnerService.getLearners(schoolId, { search }, 1, 10).then((page) => {
      if (!cancelled) setResults(page.learners);
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen, schoolId, search]);

  const onValid = async (values: LinkLearnerFormValues) => {
    setSubmitError(null);
    try {
      await guardianService.createGuardian(schoolId, values.learnerId, {
        guardianProfileId,
        relationshipType: values.relationshipType,
        isPrimary: values.isPrimary,
        isEmergencyContact: values.isEmergencyContact,
        isAuthorizedPickup: values.isAuthorizedPickup,
      });
      onSaved();
      onClose();
    } catch (error) {
      setSubmitError(getDbErrorMessage(error, 'Failed to link learner.'));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Link to another learner"
      footer={
        <Button type="submit" form="link-learner-form" isLoading={isSubmitting} disabled={!learnerId}>
          {isSubmitting ? 'Linking…' : 'Link learner'}
        </Button>
      }
    >
      <form noValidate id="link-learner-form" onSubmit={handleSubmit(onValid)} className="flex flex-col gap-4">
        {submitError && (
          <div role="alert" className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-600">
            {submitError}
          </div>
        )}

        <div>
          <TextField
            label="Search learner"
            placeholder="Search by name, learner number, or admission number…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <div className="mt-2 flex flex-col gap-1">
            {results.map((learner) => (
              <button
                key={learner.id}
                type="button"
                onClick={() => setValue('learnerId', learner.id, { shouldValidate: true })}
                className={`focus-ring rounded-lg border px-3 py-2 text-left text-sm ${
                  learnerId === learner.id
                    ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10'
                    : 'border-border-strong bg-surface-raised hover:bg-surface-sunken'
                }`}
              >
                <span className="font-medium text-content-primary">
                  {learner.firstName} {learner.lastName}
                </span>{' '}
                <span className="text-content-tertiary">{learner.learnerNumber}</span>
              </button>
            ))}
          </div>
          {errors.learnerId && (
            <p role="alert" className="mt-1.5 text-xs font-medium text-danger-600">
              {errors.learnerId.message}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="link-relationship-type" className="mb-1.5 block text-sm font-medium text-content-primary">
            Relationship
          </label>
          <select
            id="link-relationship-type"
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
      </form>
    </Modal>
  );
}
