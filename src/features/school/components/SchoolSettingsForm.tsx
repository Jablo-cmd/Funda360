import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/Button';
import { useSchool } from '@/features/school/hooks/useSchool';
import { getDbErrorMessage } from '@/lib/dbErrors';
import {
  schoolSettingsSchema,
  TIMEZONE_OPTIONS,
  CURRENCY_OPTIONS,
  LANGUAGE_OPTIONS,
  type SchoolSettingsFormValues,
} from '@/features/school/schemas/schoolSettingsSchema';

const DEFAULT_VALUES: SchoolSettingsFormValues = { timezone: 'Africa/Johannesburg', currency: 'ZAR', language: 'en' };

/**
 * Separate form (own submit button) rather than folded into
 * SchoolProfileForm's single big submit — matches
 * SchoolSettingsUpdateInput's own documented reasoning ("kept distinct
 * from profile fields since they're rarely edited together"). Surfaces
 * timezone/currency/language: columns that existed on `schools` with a
 * fully wired service/context layer (updateSchoolSettings) but no UI at
 * all until now (FND-ARCH-004) — every read path (tenantService.toSchool)
 * already returned them; this was purely a missing write surface.
 */
export function SchoolSettingsForm() {
  const { school, updateSchoolSettings } = useSchool();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SchoolSettingsFormValues>({ resolver: zodResolver(schoolSettingsSchema), defaultValues: DEFAULT_VALUES });

  useEffect(() => {
    if (!school) return;
    reset({ timezone: school.timezone, currency: school.currency, language: school.language });
  }, [school, reset]);

  if (!school) return null;

  const onValid = async (values: SchoolSettingsFormValues) => {
    setSubmitError(null);
    setSubmitSuccess(false);
    try {
      await updateSchoolSettings(values);
      setSubmitSuccess(true);
    } catch (error) {
      setSubmitError(getDbErrorMessage(error, 'Failed to update regional settings.'));
    }
  };

  return (
    <form noValidate onSubmit={handleSubmit(onValid)} className="mx-auto max-w-3xl px-4 pb-8 sm:px-6">
      <section className="rounded-card border border-border bg-surface-raised p-5 shadow-card dark:shadow-card-dark sm:p-6">
        <h2 className="text-base font-semibold text-content-primary">Regional Settings</h2>
        <p className="mt-1 text-sm text-content-secondary">
          Your school&apos;s timezone, currency, and language, recorded for reference and future reports.
        </p>

        {submitError && (
          <div role="alert" className="mt-4 rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-600">
            {submitError}
          </div>
        )}
        {submitSuccess && !submitError && (
          <div role="status" className="mt-4 rounded-lg border border-success-500/30 bg-success-500/10 px-3.5 py-2.5 text-sm font-medium text-success-500">
            Regional settings updated successfully.
          </div>
        )}

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="school-timezone" className="mb-1.5 block text-sm font-medium text-content-primary">
              Timezone
            </label>
            <select
              id="school-timezone"
              className="focus-ring h-11 w-full rounded-lg border border-border-strong bg-surface-raised px-3.5 text-sm text-content-primary"
              {...register('timezone')}
            >
              {TIMEZONE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {errors.timezone?.message && <p className="mt-1.5 text-xs font-medium text-danger-600">{errors.timezone.message}</p>}
          </div>

          <div>
            <label htmlFor="school-currency" className="mb-1.5 block text-sm font-medium text-content-primary">
              Currency
            </label>
            <select
              id="school-currency"
              className="focus-ring h-11 w-full rounded-lg border border-border-strong bg-surface-raised px-3.5 text-sm text-content-primary"
              {...register('currency')}
            >
              {CURRENCY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {errors.currency?.message && <p className="mt-1.5 text-xs font-medium text-danger-600">{errors.currency.message}</p>}
          </div>

          <div>
            <label htmlFor="school-language" className="mb-1.5 block text-sm font-medium text-content-primary">
              Language
            </label>
            <select
              id="school-language"
              className="focus-ring h-11 w-full rounded-lg border border-border-strong bg-surface-raised px-3.5 text-sm text-content-primary"
              {...register('language')}
            >
              {LANGUAGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {errors.language?.message && <p className="mt-1.5 text-xs font-medium text-danger-600">{errors.language.message}</p>}
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <div className="w-full sm:w-56">
            <Button type="submit" isLoading={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Save regional settings'}
            </Button>
          </div>
        </div>
      </section>
    </form>
  );
}
