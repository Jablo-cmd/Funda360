import { useEffect, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { getDbErrorMessage } from '@/lib/dbErrors';
import { gradingScaleService } from '@/features/reportCards/services/gradingScaleService';
import type { GradingScaleWithBands } from '@/features/reportCards/types/reportCard.types';
import {
  gradingScaleSchema,
  gradingScaleDefaultValues,
  type GradingScaleFormValues,
} from '@/features/reportCards/schemas/reportCardSchemas';

export interface GradingScaleFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  schoolId: string;
  /** Present = edit, absent = create. */
  scale?: GradingScaleWithBands;
  onSaved: () => void;
}

export function GradingScaleFormModal({ isOpen, onClose, schoolId, scale, onSaved }: GradingScaleFormModalProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<GradingScaleFormValues>({
    resolver: zodResolver(gradingScaleSchema),
    defaultValues: gradingScaleDefaultValues,
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'bands' });

  useEffect(() => {
    if (!isOpen) return;
    setSubmitError(null);
    reset(
      scale
        ? {
            name: scale.name,
            description: scale.description ?? '',
            isDefault: scale.isDefault,
            bands: scale.bands.map((b) => ({
              code: b.code,
              label: b.label,
              descriptor: b.descriptor ?? '',
              minPercentage: b.minPercentage,
              maxPercentage: b.maxPercentage,
            })),
          }
        : gradingScaleDefaultValues,
    );
  }, [isOpen, scale, reset]);

  const onValid = async (values: GradingScaleFormValues) => {
    setSubmitError(null);
    try {
      const saved = scale
        ? await gradingScaleService.updateScale(scale.id, values)
        : await gradingScaleService.createScale(schoolId, values);
      await gradingScaleService.replaceBands(
        schoolId,
        saved.id,
        values.bands.map((b) => ({ ...b, descriptor: b.descriptor || null })),
      );
      onSaved();
      onClose();
    } catch (error) {
      setSubmitError(getDbErrorMessage(error, 'Failed to save the grading scale.'));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={scale ? 'Edit grading scale' : 'New grading scale'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button type="submit" form="grading-scale-form" isLoading={isSubmitting}>
            {scale ? 'Save scale' : 'Create scale'}
          </Button>
        </>
      }
    >
      <form id="grading-scale-form" className="flex flex-col gap-4" onSubmit={handleSubmit(onValid)}>
        {submitError && (
          <p role="alert" className="rounded-md bg-danger-50 px-3 py-2 text-sm text-danger-600">
            {submitError}
          </p>
        )}
        <TextField label="Name" required placeholder="CAPS 7-point" error={errors.name?.message} {...register('name')} />
        <TextField label="Description" placeholder="Optional" error={errors.description?.message} {...register('description')} />
        <label className="flex items-center gap-2 text-sm text-content-secondary">
          <input type="checkbox" {...register('isDefault')} className="h-4 w-4 rounded border-border-strong" />
          Use as the default scale for new templates
        </label>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-content-primary">Bands</span>
            <Button
              type="button"
              variant="ghost"
              onClick={() => append({ code: '', label: '', descriptor: '', minPercentage: 0, maxPercentage: 0 })}
            >
              Add band
            </Button>
          </div>
          {errors.bands?.root && (
            <p role="alert" className="text-xs font-medium text-danger-600">
              {errors.bands.root.message}
            </p>
          )}
          {errors.bands?.message && (
            <p role="alert" className="text-xs font-medium text-danger-600">
              {errors.bands.message}
            </p>
          )}
          {fields.map((field, index) => (
            <div key={field.id} className="grid grid-cols-[1fr_1.4fr_auto_auto_auto] items-end gap-2 rounded-md border border-border p-2">
              <TextField label="Code" placeholder="7" error={errors.bands?.[index]?.code?.message} {...register(`bands.${index}.code`)} />
              <TextField label="Label" placeholder="Outstanding" error={errors.bands?.[index]?.label?.message} {...register(`bands.${index}.label`)} />
              <TextField
                label="Min %"
                type="number"
                error={errors.bands?.[index]?.minPercentage?.message}
                {...register(`bands.${index}.minPercentage`)}
              />
              <TextField
                label="Max %"
                type="number"
                error={errors.bands?.[index]?.maxPercentage?.message}
                {...register(`bands.${index}.maxPercentage`)}
              />
              <Button type="button" variant="ghost" onClick={() => remove(index)} aria-label={`Remove band ${index + 1}`}>
                ×
              </Button>
            </div>
          ))}
        </div>
      </form>
    </Modal>
  );
}
