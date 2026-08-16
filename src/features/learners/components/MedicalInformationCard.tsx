import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { medicalInformationService } from '@/features/learners/services/medicalInformationService';
import { getDbErrorMessage } from '@/lib/dbErrors';
import {
  medicalInformationSchema,
  medicalInformationDefaultValues,
  type MedicalInformationFormValues,
} from '@/features/learners/schemas/medicalInformationSchema';
import type { LearnerMedicalInformation } from '@/features/learners/types/learner.types';

export interface MedicalInformationCardProps {
  schoolId: string;
  learnerId: string;
  medicalInformation: LearnerMedicalInformation | null;
  canView: boolean;
  canManage: boolean;
  onSaved: (record: LearnerMedicalInformation) => void;
}

export function MedicalInformationCard({
  schoolId,
  learnerId,
  medicalInformation,
  canView,
  canManage,
  onSaved,
}: MedicalInformationCardProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<MedicalInformationFormValues>({
    resolver: zodResolver(medicalInformationSchema),
    defaultValues: medicalInformationDefaultValues,
  });

  useEffect(() => {
    reset(
      medicalInformation
        ? {
            allergies: medicalInformation.allergies ?? '',
            medication: medicalInformation.medication ?? '',
            medicalConditions: medicalInformation.medicalConditions ?? '',
            doctorName: medicalInformation.doctorName ?? '',
            doctorPhone: medicalInformation.doctorPhone ?? '',
            medicalAidProvider: medicalInformation.medicalAidProvider ?? '',
            medicalAidNumber: medicalInformation.medicalAidNumber ?? '',
            emergencyMedicalNotes: medicalInformation.emergencyMedicalNotes ?? '',
          }
        : medicalInformationDefaultValues,
    );
  }, [medicalInformation, reset]);

  if (!canView) {
    return (
      <div className="rounded-card border border-border bg-surface-raised px-4 py-10 text-center text-sm text-content-tertiary">
        You don't have permission to view medical information for this learner.
      </div>
    );
  }

  const onValid = async (values: MedicalInformationFormValues) => {
    setSubmitError(null);
    try {
      const payload = {
        allergies: values.allergies?.trim() || null,
        medication: values.medication?.trim() || null,
        medicalConditions: values.medicalConditions?.trim() || null,
        doctorName: values.doctorName?.trim() || null,
        doctorPhone: values.doctorPhone?.trim() || null,
        medicalAidProvider: values.medicalAidProvider?.trim() || null,
        medicalAidNumber: values.medicalAidNumber?.trim() || null,
        emergencyMedicalNotes: values.emergencyMedicalNotes?.trim() || null,
      };
      const saved = medicalInformation
        ? await medicalInformationService.updateMedicalInformation(medicalInformation.id, payload)
        : await medicalInformationService.createMedicalInformation(schoolId, learnerId, payload);
      onSaved(saved);
    } catch (error) {
      setSubmitError(getDbErrorMessage(error, 'Failed to save medical information.'));
    }
  };

  return (
    <form
      noValidate
      onSubmit={handleSubmit(onValid)}
      className="flex flex-col gap-4 rounded-card border border-border bg-surface-raised p-5"
    >
      {submitError && (
        <div
          role="alert"
          className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-600"
        >
          {submitError}
        </div>
      )}

      <fieldset disabled={!canManage} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label="Allergies" error={errors.allergies?.message} {...register('allergies')} />
          <TextField label="Medication" error={errors.medication?.message} {...register('medication')} />
        </div>
        <TextField
          label="Medical conditions"
          error={errors.medicalConditions?.message}
          {...register('medicalConditions')}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label="Doctor name" error={errors.doctorName?.message} {...register('doctorName')} />
          <TextField label="Doctor phone" error={errors.doctorPhone?.message} {...register('doctorPhone')} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            label="Medical aid provider"
            error={errors.medicalAidProvider?.message}
            {...register('medicalAidProvider')}
          />
          <TextField
            label="Medical aid number"
            error={errors.medicalAidNumber?.message}
            {...register('medicalAidNumber')}
          />
        </div>
        <TextField
          label="Emergency medical notes"
          error={errors.emergencyMedicalNotes?.message}
          {...register('emergencyMedicalNotes')}
        />

        {canManage && (
          <div className="w-full sm:w-auto sm:min-w-[8rem] sm:self-end">
            <Button type="submit" isLoading={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Save'}
            </Button>
          </div>
        )}
      </fieldset>
    </form>
  );
}
