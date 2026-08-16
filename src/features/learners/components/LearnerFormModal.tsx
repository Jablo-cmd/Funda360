import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { learnerService } from '@/features/learners/services/learnerService';
import { getDbErrorMessage } from '@/lib/dbErrors';
import { learnerSchema, learnerDefaultValues, type LearnerFormValues } from '@/features/learners/schemas/learnerSchema';
import type { Learner } from '@/features/learners/types/learner.types';

export interface LearnerFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  schoolId: string;
  learner?: Learner | null;
  onSaved: (learner: Learner) => void;
}

export function LearnerFormModal({ isOpen, onClose, schoolId, learner, onSaved }: LearnerFormModalProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const isEditing = Boolean(learner);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<LearnerFormValues>({ resolver: zodResolver(learnerSchema), defaultValues: learnerDefaultValues });

  useEffect(() => {
    if (!isOpen) return;
    reset(
      learner
        ? {
            learnerNumber: learner.learnerNumber,
            admissionNumber: learner.admissionNumber,
            firstName: learner.firstName,
            lastName: learner.lastName,
            preferredName: learner.preferredName ?? '',
            gender: learner.gender ?? '',
            dateOfBirth: learner.dateOfBirth,
            idNumber: learner.idNumber ?? '',
            passportNumber: learner.passportNumber ?? '',
            passportCountry: learner.passportCountry ?? '',
            nationality: learner.nationality ?? '',
            homeLanguage: learner.homeLanguage ?? '',
            transportMode: learner.transportMode ?? '',
            transportNotes: learner.transportNotes ?? '',
            boardingType: learner.boardingType ?? '',
            admissionDate: learner.admissionDate,
          }
        : learnerDefaultValues,
    );
    setSubmitError(null);
  }, [isOpen, learner, reset]);

  const onValid = async (values: LearnerFormValues) => {
    setSubmitError(null);
    try {
      const payload = {
        learnerNumber: values.learnerNumber,
        admissionNumber: values.admissionNumber,
        firstName: values.firstName,
        lastName: values.lastName,
        preferredName: values.preferredName?.trim() || null,
        gender: values.gender?.trim() || null,
        dateOfBirth: values.dateOfBirth,
        idNumber: values.idNumber?.trim() || null,
        passportNumber: values.passportNumber?.trim() || null,
        passportCountry: values.passportCountry?.trim() || null,
        nationality: values.nationality?.trim() || null,
        homeLanguage: values.homeLanguage?.trim() || null,
        transportMode: values.transportMode?.trim() || null,
        transportNotes: values.transportNotes?.trim() || null,
        boardingType: values.boardingType || null,
        admissionDate: values.admissionDate,
      };
      const saved = learner
        ? await learnerService.updateLearner(learner.id, payload)
        : await learnerService.createLearner(schoolId, payload);
      onSaved(saved);
      onClose();
    } catch (error) {
      setSubmitError(getDbErrorMessage(error, 'Failed to save learner.'));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit learner' : 'Add learner'}
      footer={
        <Button type="submit" form="learner-form" isLoading={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Save'}
        </Button>
      }
    >
      <form noValidate id="learner-form" onSubmit={handleSubmit(onValid)} className="flex flex-col gap-4">
        {submitError && (
          <div
            role="alert"
            className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-600"
          >
            {submitError}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label="First name" required error={errors.firstName?.message} {...register('firstName')} />
          <TextField label="Last name" required error={errors.lastName?.message} {...register('lastName')} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label="Preferred name" error={errors.preferredName?.message} {...register('preferredName')} />
          <TextField label="Gender" error={errors.gender?.message} {...register('gender')} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            label="Learner number"
            required
            error={errors.learnerNumber?.message}
            {...register('learnerNumber')}
          />
          <TextField
            label="Admission number"
            required
            error={errors.admissionNumber?.message}
            {...register('admissionNumber')}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            label="Date of birth"
            type="date"
            required
            error={errors.dateOfBirth?.message}
            {...register('dateOfBirth')}
          />
          <TextField
            label="Admission date"
            type="date"
            required
            error={errors.admissionDate?.message}
            {...register('admissionDate')}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label="ID number" error={errors.idNumber?.message} {...register('idNumber')} />
          <TextField label="Nationality" error={errors.nationality?.message} {...register('nationality')} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            label="Passport number"
            error={errors.passportNumber?.message}
            {...register('passportNumber')}
          />
          <TextField
            label="Passport country"
            error={errors.passportCountry?.message}
            {...register('passportCountry')}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label="Home language" error={errors.homeLanguage?.message} {...register('homeLanguage')} />
          <div>
            <label htmlFor="learner-boarding-type" className="mb-1.5 block text-sm font-medium text-content-primary">
              Boarding type
            </label>
            <select
              id="learner-boarding-type"
              className="focus-ring h-11 w-full rounded-lg border border-border-strong bg-surface-raised px-3.5 text-sm text-content-primary"
              {...register('boardingType')}
            >
              <option value="">Not specified</option>
              <option value="day_scholar">Day scholar</option>
              <option value="boarder">Boarder</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label="Transport mode" error={errors.transportMode?.message} {...register('transportMode')} />
          <TextField label="Transport notes" error={errors.transportNotes?.message} {...register('transportNotes')} />
        </div>
      </form>
    </Modal>
  );
}
