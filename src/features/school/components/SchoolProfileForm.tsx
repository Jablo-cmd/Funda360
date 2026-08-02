import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { FullScreenSpinner } from '@/components/ui/FullScreenSpinner';
import { BuildingIcon } from '@/components/ui/icons';
import { useSchool } from '@/features/school/hooks/useSchool';
import { getSchoolStatusLabel } from '@/features/school/utils/schoolStatusLabel';
import {
  schoolProfileSchema,
  type SchoolProfileFormValues,
} from '@/features/school/schemas/schoolProfileSchema';

function emptyToNull(value: string | undefined): string | null {
  return value && value.trim() !== '' ? value.trim() : null;
}

const EMPTY_VALUES: SchoolProfileFormValues = {
  name: '',
  registrationNumber: '',
  email: '',
  phone: '',
  website: '',
  logoUrl: '',
  physicalAddress: '',
  postalAddress: '',
  principalName: '',
};

export function SchoolProfileForm() {
  const { school, updateSchool } = useSchool();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SchoolProfileFormValues>({
    resolver: zodResolver(schoolProfileSchema),
    defaultValues: EMPTY_VALUES,
  });

  useEffect(() => {
    if (!school) return;
    reset({
      name: school.name,
      registrationNumber: school.registrationNumber ?? '',
      email: school.email ?? '',
      phone: school.phone ?? '',
      website: school.website ?? '',
      logoUrl: school.logoUrl ?? '',
      physicalAddress: school.physicalAddress ?? '',
      postalAddress: school.postalAddress ?? '',
      principalName: school.principalName ?? '',
    });
  }, [school, reset]);

  const logoUrlValue = watch('logoUrl');

  const onValid = async (values: SchoolProfileFormValues) => {
    setSubmitError(null);
    setSubmitSuccess(false);
    try {
      await updateSchool({
        name: values.name.trim(),
        registrationNumber: emptyToNull(values.registrationNumber),
        email: emptyToNull(values.email),
        phone: emptyToNull(values.phone),
        website: emptyToNull(values.website),
        logoUrl: emptyToNull(values.logoUrl),
        physicalAddress: emptyToNull(values.physicalAddress),
        postalAddress: emptyToNull(values.postalAddress),
        principalName: emptyToNull(values.principalName),
      });
      setSubmitSuccess(true);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to update school profile.');
    }
  };

  if (!school) {
    return <FullScreenSpinner label="Loading school profile…" />;
  }

  return (
    <form
      noValidate
      onSubmit={handleSubmit(onValid)}
      className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-8 sm:px-6"
    >
      <div>
        <h1 className="text-2xl font-bold text-content-primary">School Profile</h1>
        <p className="mt-1 text-sm text-content-secondary">
          Manage your school&apos;s identity, contact details and administrative information.
        </p>
      </div>

      {submitError && (
        <div
          role="alert"
          className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-600"
        >
          {submitError}
        </div>
      )}

      {submitSuccess && !submitError && (
        <div
          role="status"
          className="rounded-lg border border-success-500/30 bg-success-500/10 px-3.5 py-2.5 text-sm font-medium text-success-500"
        >
          School profile updated successfully.
        </div>
      )}

      <section className="rounded-card border border-border bg-surface-raised p-5 shadow-card sm:p-6 dark:shadow-card-dark">
        <h2 className="text-base font-semibold text-content-primary">General Information</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            label="School name"
            required
            containerClassName="sm:col-span-2"
            error={errors.name?.message}
            {...register('name')}
          />
          <TextField
            label="Registration number"
            error={errors.registrationNumber?.message}
            {...register('registrationNumber')}
          />
          <TextField label="Email" type="email" error={errors.email?.message} {...register('email')} />
          <TextField label="Phone" type="tel" error={errors.phone?.message} {...register('phone')} />
          <TextField
            label="Website"
            type="url"
            placeholder="https://"
            error={errors.website?.message}
            {...register('website')}
          />
        </div>
      </section>

      <section className="rounded-card border border-border bg-surface-raised p-5 shadow-card sm:p-6 dark:shadow-card-dark">
        <h2 className="text-base font-semibold text-content-primary">Address</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            label="Physical address"
            error={errors.physicalAddress?.message}
            {...register('physicalAddress')}
          />
          <TextField
            label="Postal address"
            error={errors.postalAddress?.message}
            {...register('postalAddress')}
          />
        </div>
      </section>

      <section className="rounded-card border border-border bg-surface-raised p-5 shadow-card sm:p-6 dark:shadow-card-dark">
        <h2 className="text-base font-semibold text-content-primary">Branding</h2>
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-card border border-border bg-surface-sunken">
            {logoUrlValue ? (
              <img src={logoUrlValue} alt="School logo preview" className="h-full w-full object-contain" />
            ) : (
              <BuildingIcon className="h-8 w-8 text-content-tertiary" />
            )}
          </div>
          <TextField
            label="Logo URL"
            type="url"
            placeholder="https://"
            hint="Paste a hosted image URL for now — direct upload is coming in a later release."
            containerClassName="flex-1"
            error={errors.logoUrl?.message}
            {...register('logoUrl')}
          />
        </div>
      </section>

      <section className="rounded-card border border-border bg-surface-raised p-5 shadow-card sm:p-6 dark:shadow-card-dark">
        <h2 className="text-base font-semibold text-content-primary">Administration</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            label="Principal name"
            error={errors.principalName?.message}
            {...register('principalName')}
          />
          <div>
            <span className="mb-1.5 block text-sm font-medium text-content-primary">School status</span>
            <span className="inline-flex h-11 items-center rounded-lg border border-border-strong bg-surface-sunken px-3.5 text-sm text-content-secondary">
              {getSchoolStatusLabel(school.status)}
            </span>
          </div>
        </div>
      </section>

      <div className="flex justify-end">
        <div className="w-full sm:w-56">
          <Button type="submit" isLoading={isSubmitting}>
            {isSubmitting ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </div>
    </form>
  );
}
