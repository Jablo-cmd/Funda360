import { useEffect, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { invoiceService } from '@/features/fees/services/invoiceService';
import { useFeeStructures } from '@/features/fees/hooks/useFeeStructures';
import { getDbErrorMessage } from '@/lib/dbErrors';
import { invoiceSchema, invoiceDefaultValues, type InvoiceFormValues } from '@/features/fees/schemas/invoiceSchema';

export interface InvoiceFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  schoolId: string;
  learnerId: string;
  academicYearId: string;
  onSaved: () => void;
}

const CATEGORY_LABELS: Record<InvoiceFormValues['lines'][number]['category'], string> = {
  tuition: 'Tuition',
  transport: 'Transport',
  boarding: 'Boarding',
  uniform: 'Uniform',
  activity: 'Activity',
  other: 'Other',
};

export function InvoiceFormModal({ isOpen, onClose, schoolId, learnerId, academicYearId, onSaved }: InvoiceFormModalProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { feeStructures } = useFeeStructures(schoolId, academicYearId);

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<InvoiceFormValues>({ resolver: zodResolver(invoiceSchema), defaultValues: invoiceDefaultValues });

  const { fields, append, remove } = useFieldArray({ control, name: 'lines' });
  const lines = watch('lines');
  const total = (lines ?? []).reduce((sum, line) => sum + (Number(line.amount) || 0), 0);

  useEffect(() => {
    if (!isOpen) return;
    reset(invoiceDefaultValues);
    setSubmitError(null);
  }, [isOpen, reset]);

  const addTemplate = (feeStructureId: string) => {
    const template = feeStructures.find((fs) => fs.id === feeStructureId);
    if (!template) return;
    append({ description: template.name, category: template.category, amount: template.amount });
  };

  const onValid = async (values: InvoiceFormValues) => {
    setSubmitError(null);
    try {
      await invoiceService.createInvoice(schoolId, learnerId, {
        academicYearId,
        notes: values.notes?.trim() || null,
        dueDate: values.dueDate || null,
        lines: values.lines.map((line) => ({
          description: line.description,
          category: line.category,
          amount: line.amount,
        })),
      });
      onSaved();
      onClose();
    } catch (error) {
      setSubmitError(getDbErrorMessage(error, 'Failed to create the invoice.'));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="New invoice (draft)"
      footer={
        <Button type="submit" form="invoice-form" isLoading={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Create draft'}
        </Button>
      }
    >
      <form noValidate id="invoice-form" onSubmit={handleSubmit(onValid)} className="flex flex-col gap-4">
        {submitError && (
          <div role="alert" className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-600">
            {submitError}
          </div>
        )}

        {feeStructures.length > 0 && (
          <div>
            <label htmlFor="invoice-template" className="mb-1.5 block text-sm font-medium text-content-primary">
              Add a line from the fee catalogue
            </label>
            <select
              id="invoice-template"
              className="focus-ring h-11 w-full rounded-md border border-border-strong bg-surface-raised px-3.5 text-sm text-content-primary"
              value=""
              onChange={(event) => {
                if (event.target.value) addTemplate(event.target.value);
              }}
            >
              <option value="">Select a fee structure…</option>
              {feeStructures.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name} — {new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(template.amount)}
                </option>
              ))}
            </select>
          </div>
        )}

        <fieldset className="flex flex-col gap-3">
          <legend className="text-sm font-medium text-content-primary">Line items</legend>
          {errors.lines?.message && <p className="text-sm text-danger-600">{errors.lines.message}</p>}
          {fields.map((field, index) => (
            <div key={field.id} className="grid grid-cols-1 gap-2 rounded-lg border border-border p-3 sm:grid-cols-[1fr_9rem_7rem_auto]">
              <TextField
                label="Description"
                required
                error={errors.lines?.[index]?.description?.message}
                {...register(`lines.${index}.description` as const)}
              />
              <div>
                <label
                  htmlFor={`invoice-line-${index}-category`}
                  className="mb-1.5 block text-sm font-medium text-content-primary"
                >
                  Category
                </label>
                <select
                  id={`invoice-line-${index}-category`}
                  className="focus-ring h-11 w-full rounded-md border border-border-strong bg-surface-raised px-2 text-sm text-content-primary"
                  {...register(`lines.${index}.category` as const)}
                >
                  {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <TextField
                label="Amount"
                type="number"
                step="0.01"
                min={0.01}
                required
                error={errors.lines?.[index]?.amount?.message}
                {...register(`lines.${index}.amount` as const)}
              />
              <div className="flex items-end pb-1">
                <button
                  type="button"
                  onClick={() => (fields.length > 1 ? remove(index) : setValue(`lines.${index}`, { description: '', category: 'tuition', amount: 0 }))}
                  className="focus-ring rounded-md px-2 py-1 text-xs font-medium text-danger-600 hover:bg-danger-50"
                  aria-label={`Remove line ${index + 1}`}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
          <div>
            <Button type="button" variant="secondary" onClick={() => append({ description: '', category: 'tuition', amount: 0 })}>
              Add line
            </Button>
          </div>
        </fieldset>

        <div className="flex justify-between rounded-lg bg-surface-sunken px-4 py-3 text-sm">
          <span className="font-medium text-content-secondary">Subtotal</span>
          <span className="font-mono font-semibold text-content-primary">
            {new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(total)}
          </span>
        </div>

        <TextField label="Due date" type="date" error={errors.dueDate?.message} {...register('dueDate')} />
        <TextField label="Notes (appears on the invoice)" error={errors.notes?.message} {...register('notes')} />
      </form>
    </Modal>
  );
}
