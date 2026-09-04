import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { getDbErrorMessage } from '@/lib/dbErrors';
import { admissionService } from '@/features/admissions/services/admissionService';
import type { AcademicYear } from '@/features/academic/types/academic.types';
import type { Grade } from '@/features/academic/types/academic.types';

const schema = z.object({
  applicantFirstName: z.string().trim().min(1, 'Required'),
  applicantLastName: z.string().trim().min(1, 'Required'),
  applicantEmail: z.string().trim().email('A valid email is required'),
  applicantPhone: z.string().trim().optional().or(z.literal('')),
  applicantRelationship: z.string().trim().optional().or(z.literal('')),
  learnerFirstName: z.string().trim().min(1, 'Required'),
  learnerLastName: z.string().trim().min(1, 'Required'),
  learnerDateOfBirth: z.string().optional().or(z.literal('')),
  academicYearId: z.string().optional().or(z.literal('')),
  requestedGradeId: z.string().optional().or(z.literal('')),
});
type FormValues = z.infer<typeof schema>;

export interface CreateApplicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  schoolId: string;
  academicYears: AcademicYear[];
  grades: Grade[];
  onCreated: (id: string) => void;
}

export function CreateApplicationModal({ isOpen, onClose, schoolId, academicYears, grades, onCreated }: CreateApplicationModalProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (isOpen) {
      reset({});
      setSubmitError(null);
    }
  }, [isOpen, reset]);

  const onValid = async (v: FormValues) => {
    setSubmitError(null);
    try {
      const app = await admissionService.createApplication(schoolId, {
        applicantEmail: v.applicantEmail,
        applicantFirstName: v.applicantFirstName,
        applicantLastName: v.applicantLastName,
        learnerFirstName: v.learnerFirstName,
        learnerLastName: v.learnerLastName,
        applicantPhone: v.applicantPhone || null,
        applicantRelationship: v.applicantRelationship || null,
        learnerDateOfBirth: v.learnerDateOfBirth || null,
        academicYearId: v.academicYearId || null,
        requestedGradeId: v.requestedGradeId || null,
      });
      onCreated(app.id);
      onClose();
    } catch (error) {
      setSubmitError(getDbErrorMessage(error, 'Failed to create the application.'));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="New application"
      footer={
        <>
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="create-application-form" isLoading={isSubmitting}>
            Create draft
          </Button>
        </>
      }
    >
      <form id="create-application-form" className="flex flex-col gap-3" onSubmit={handleSubmit(onValid)}>
        {submitError && (
          <p role="alert" className="rounded-md bg-danger-50 px-3 py-2 text-sm text-danger-600">
            {submitError}
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Parent first name" required error={errors.applicantFirstName?.message} {...register('applicantFirstName')} />
          <TextField label="Parent last name" required error={errors.applicantLastName?.message} {...register('applicantLastName')} />
        </div>
        <TextField label="Parent email" required type="email" error={errors.applicantEmail?.message} {...register('applicantEmail')} />
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Parent phone" error={errors.applicantPhone?.message} {...register('applicantPhone')} />
          <TextField label="Relationship" placeholder="mother / father / legal_guardian" error={errors.applicantRelationship?.message} {...register('applicantRelationship')} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Learner first name" required error={errors.learnerFirstName?.message} {...register('learnerFirstName')} />
          <TextField label="Learner last name" required error={errors.learnerLastName?.message} {...register('learnerLastName')} />
        </div>
        <TextField label="Learner date of birth" type="date" error={errors.learnerDateOfBirth?.message} {...register('learnerDateOfBirth')} />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="ca-year" className="mb-1.5 block text-sm font-medium text-content-primary">
              Academic year
            </label>
            <select id="ca-year" className="focus-ring h-11 w-full rounded-md border border-border-strong bg-surface-raised px-3 text-sm" {...register('academicYearId')}>
              <option value="">Undecided</option>
              {academicYears.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="ca-grade" className="mb-1.5 block text-sm font-medium text-content-primary">
              Requested grade
            </label>
            <select id="ca-grade" className="focus-ring h-11 w-full rounded-md border border-border-strong bg-surface-raised px-3 text-sm" {...register('requestedGradeId')}>
              <option value="">Undecided</option>
              {grades.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </form>
    </Modal>
  );
}
