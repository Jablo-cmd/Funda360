import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { getDbErrorMessage } from '@/lib/dbErrors';
import { reportCardService } from '@/features/reportCards/services/reportCardService';
import type { ReportCardTemplate, GradingScaleWithBands } from '@/features/reportCards/types/reportCard.types';
import {
  reportCardTemplateSchema,
  reportCardTemplateDefaultValues,
  type ReportCardTemplateFormValues,
} from '@/features/reportCards/schemas/reportCardSchemas';

const SECTION_TOGGLES: { name: keyof ReportCardTemplateFormValues; label: string }[] = [
  { name: 'showAttendance', label: 'Attendance summary' },
  { name: 'showConduct', label: 'Conduct summary' },
  { name: 'showSubjectComments', label: 'Per-subject teacher comments' },
  { name: 'showClassTeacherComment', label: 'Class-teacher comment' },
  { name: 'showPrincipalComment', label: 'Principal comment' },
  { name: 'showPromotion', label: 'Promotion status' },
];

export interface ReportCardTemplateFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  schoolId: string;
  scales: GradingScaleWithBands[];
  template?: ReportCardTemplate;
  onSaved: () => void;
}

export function ReportCardTemplateFormModal({
  isOpen,
  onClose,
  schoolId,
  scales,
  template,
  onSaved,
}: ReportCardTemplateFormModalProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ReportCardTemplateFormValues>({
    resolver: zodResolver(reportCardTemplateSchema),
    defaultValues: reportCardTemplateDefaultValues,
  });

  useEffect(() => {
    if (!isOpen) return;
    setSubmitError(null);
    reset(
      template
        ? {
            name: template.name,
            gradingScaleId: template.gradingScaleId,
            isDefault: template.isDefault,
            requiresHodReview: template.requiresHodReview,
            showAttendance: template.showAttendance,
            showConduct: template.showConduct,
            showClassTeacherComment: template.showClassTeacherComment,
            showPrincipalComment: template.showPrincipalComment,
            showSubjectComments: template.showSubjectComments,
            showPromotion: template.showPromotion,
            headerNote: template.headerNote ?? '',
            footerNote: template.footerNote ?? '',
          }
        : { ...reportCardTemplateDefaultValues, gradingScaleId: scales.find((s) => s.isDefault)?.id ?? scales[0]?.id ?? '' },
    );
  }, [isOpen, template, scales, reset]);

  const onValid = async (values: ReportCardTemplateFormValues) => {
    setSubmitError(null);
    const payload = {
      name: values.name,
      grading_scale_id: values.gradingScaleId,
      is_default: values.isDefault,
      requires_hod_review: values.requiresHodReview,
      show_attendance: values.showAttendance,
      show_conduct: values.showConduct,
      show_class_teacher_comment: values.showClassTeacherComment,
      show_principal_comment: values.showPrincipalComment,
      show_subject_comments: values.showSubjectComments,
      show_promotion: values.showPromotion,
      header_note: values.headerNote || null,
      footer_note: values.footerNote || null,
    };
    try {
      if (template) await reportCardService.updateTemplate(template.id, payload);
      else await reportCardService.createTemplate(schoolId, payload);
      onSaved();
      onClose();
    } catch (error) {
      setSubmitError(getDbErrorMessage(error, 'Failed to save the template.'));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={template ? 'Edit report-card template' : 'New report-card template'}
      footer={
        <>
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="rc-template-form" isLoading={isSubmitting}>
            {template ? 'Save template' : 'Create template'}
          </Button>
        </>
      }
    >
      <form id="rc-template-form" className="flex flex-col gap-4" onSubmit={handleSubmit(onValid)}>
        {submitError && (
          <p role="alert" className="rounded-md bg-danger-50 px-3 py-2 text-sm text-danger-600">
            {submitError}
          </p>
        )}
        <TextField label="Name" required placeholder="Standard Term Report" error={errors.name?.message} {...register('name')} />

        <div>
          <label htmlFor="rc-template-scale" className="mb-1.5 block text-sm font-medium text-content-primary">
            Grading scale <span className="text-danger-600">*</span>
          </label>
          <select
            id="rc-template-scale"
            className="focus-ring h-11 w-full rounded-md border border-border-strong bg-surface-raised px-3.5 text-sm text-content-primary"
            {...register('gradingScaleId')}
          >
            <option value="">Select a grading scale…</option>
            {scales.map((scale) => (
              <option key={scale.id} value={scale.id}>
                {scale.name}
              </option>
            ))}
          </select>
          {errors.gradingScaleId && (
            <p role="alert" className="mt-1.5 text-xs font-medium text-danger-600">
              {errors.gradingScaleId.message}
            </p>
          )}
        </div>

        <fieldset className="flex flex-col gap-2 rounded-md border border-border p-3">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-content-tertiary">Sections shown</legend>
          {SECTION_TOGGLES.map((toggle) => (
            <label key={toggle.name} className="flex items-center gap-2 text-sm text-content-secondary">
              <input type="checkbox" {...register(toggle.name)} className="h-4 w-4 rounded border-border-strong" />
              {toggle.label}
            </label>
          ))}
        </fieldset>

        <label className="flex items-center gap-2 text-sm text-content-secondary">
          <input type="checkbox" {...register('requiresHodReview')} className="h-4 w-4 rounded border-border-strong" />
          Require an HOD review step before approval
        </label>
        <label className="flex items-center gap-2 text-sm text-content-secondary">
          <input type="checkbox" {...register('isDefault')} className="h-4 w-4 rounded border-border-strong" />
          Use as the default template
        </label>

        <TextField label="Header note (optional)" placeholder="Printed under the school name" error={errors.headerNote?.message} {...register('headerNote')} />
        <TextField label="Footer note (optional)" placeholder="Printed at the bottom of each card" error={errors.footerNote?.message} {...register('footerNote')} />
      </form>
    </Modal>
  );
}
