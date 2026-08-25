import { useEffect, useState, type ChangeEvent } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { FullScreenSpinner } from '@/components/ui/FullScreenSpinner';
import { NoActiveSchoolNotice } from '@/components/ui/NoActiveSchoolNotice';
import { BuildingIcon } from '@/components/ui/icons';
import { useSchool } from '@/features/school/hooks/useSchool';
import { getDbErrorMessage } from '@/lib/dbErrors';
import { getSchoolStatusLabel } from '@/features/school/utils/schoolStatusLabel';
import { schoolService, SCHOOL_LOGO_FILE_RULE } from '@/features/school/services/schoolService';
import { storage } from '@/lib/storage';
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
  physicalAddress: '',
  postalAddress: '',
  principalName: '',
};

export function SchoolProfileForm() {
  const { school, loading, updateSchool, uploadLogo } = useSchool();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
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
      physicalAddress: school.physicalAddress ?? '',
      postalAddress: school.postalAddress ?? '',
      principalName: school.principalName ?? '',
    });
  }, [school, reset]);

  // Resolves the stored object path to a fresh signed URL whenever the
  // school (or its logo) changes — logoUrl itself is never directly
  // fetchable, so this can't be done with a plain <img src={school.logoUrl}>.
  useEffect(() => {
    if (!school?.logoUrl) {
      setLogoPreviewUrl(null);
      return;
    }
    let cancelled = false;
    schoolService
      .getLogoSignedUrl(school)
      .then((url) => {
        if (!cancelled) setLogoPreviewUrl(url);
      })
      .catch(() => {
        if (!cancelled) setLogoPreviewUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [school]);

  const handleLogoChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const validationError = storage.validateFile(file, SCHOOL_LOGO_FILE_RULE);
    if (validationError) {
      setLogoError(validationError);
      return;
    }

    setLogoError(null);
    setIsUploadingLogo(true);
    try {
      await uploadLogo(file);
    } catch (error) {
      setLogoError(getDbErrorMessage(error, 'Failed to upload logo.'));
    } finally {
      setIsUploadingLogo(false);
    }
  };

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
        physicalAddress: emptyToNull(values.physicalAddress),
        postalAddress: emptyToNull(values.postalAddress),
        principalName: emptyToNull(values.principalName),
      });
      setSubmitSuccess(true);
    } catch (error) {
      setSubmitError(getDbErrorMessage(error, 'Failed to update school profile.'));
    }
  };

  if (loading) {
    return <FullScreenSpinner label="Loading school profile…" />;
  }

  if (!school) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <h1 className="mb-4 text-2xl font-bold text-content-primary">School Profile</h1>
        <NoActiveSchoolNotice resource="a school's profile" />
      </div>
    );
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

      <section className="rounded-card border border-border bg-surface-raised p-5 shadow-card dark:shadow-card-dark sm:p-6">
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
          <TextField
            label="Email"
            type="email"
            error={errors.email?.message}
            {...register('email')}
          />
          <TextField
            label="Phone"
            type="tel"
            error={errors.phone?.message}
            {...register('phone')}
          />
          <TextField
            label="Website"
            type="url"
            placeholder="https://"
            error={errors.website?.message}
            {...register('website')}
          />
        </div>
      </section>

      <section className="rounded-card border border-border bg-surface-raised p-5 shadow-card dark:shadow-card-dark sm:p-6">
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

      <section className="rounded-card border border-border bg-surface-raised p-5 shadow-card dark:shadow-card-dark sm:p-6">
        <h2 className="text-base font-semibold text-content-primary">Branding</h2>
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-card border border-border bg-surface-sunken">
            {logoPreviewUrl ? (
              <img
                src={logoPreviewUrl}
                alt="School logo preview"
                className="h-full w-full object-contain"
              />
            ) : (
              <BuildingIcon className="h-8 w-8 text-content-tertiary" />
            )}
          </div>
          <div className="flex-1">
            <label
              htmlFor="school-logo"
              className="mb-1.5 block text-sm font-medium text-content-primary"
            >
              Logo
            </label>
            <input
              id="school-logo"
              type="file"
              accept={SCHOOL_LOGO_FILE_RULE.allowedMimeTypes.join(',')}
              onChange={(event) => void handleLogoChange(event)}
              disabled={isUploadingLogo}
              className="focus-ring block w-full text-sm text-content-secondary file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3.5 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100 disabled:opacity-60 dark:file:bg-brand-500/15 dark:file:text-brand-300"
            />
            <p className="mt-1.5 text-xs text-content-tertiary">
              {isUploadingLogo ? 'Uploading…' : 'PNG, JPEG, or WebP, up to 2MB.'}
            </p>
            {logoError && <p className="mt-1.5 text-xs font-medium text-danger-600">{logoError}</p>}
          </div>
        </div>
      </section>

      <section className="rounded-card border border-border bg-surface-raised p-5 shadow-card dark:shadow-card-dark sm:p-6">
        <h2 className="text-base font-semibold text-content-primary">Administration</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            label="Principal name"
            error={errors.principalName?.message}
            {...register('principalName')}
          />
          <div>
            <span className="mb-1.5 block text-sm font-medium text-content-primary">
              School status
            </span>
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
