import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { PageContainer } from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { FullScreenSpinner } from '@/components/ui/FullScreenSpinner';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { useMyGuardianProfile } from '@/features/parentPortal/hooks/useMyGuardianProfile';
import { guardianSelfService } from '@/features/parentPortal/services/guardianSelfService';
import { getDbErrorMessage } from '@/lib/dbErrors';

interface FormValues {
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  idNumber: string;
}

/**
 * Self-service only: name/phone/address/ID-reference number. No role,
 * tenant, status, or learner-relationship field appears anywhere on this
 * form — those are staff-only concerns (can_manage_profiles /
 * can_manage_learners), not something profiles_update_own or
 * guardian_profile_details_update_own grant a guardian write access to,
 * and this page doesn't attempt to offer them.
 */
export function ParentProfilePage() {
  const { profile, isLoading, error, refetch } = useMyGuardianProfile();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<FormValues>({ defaultValues: { firstName: '', lastName: '', phone: '', address: '', idNumber: '' } });

  useEffect(() => {
    if (profile) {
      reset({
        firstName: profile.firstName,
        lastName: profile.lastName,
        phone: profile.phone ?? '',
        address: profile.address ?? '',
        idNumber: profile.idNumber ?? '',
      });
    }
  }, [profile, reset]);

  if (isLoading) {
    return <FullScreenSpinner label="Loading your profile…" />;
  }

  const onValid = async (values: FormValues) => {
    if (!profile) return;
    setSubmitError(null);
    setSaved(false);
    try {
      await guardianSelfService.updateMyProfile({
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        phone: values.phone.trim() || null,
        ...(profile.hasDetailsRecord
          ? { address: values.address.trim() || null, idNumber: values.idNumber.trim() || null }
          : {}),
      });
      setSaved(true);
      await refetch();
    } catch (err) {
      setSubmitError(getDbErrorMessage(err, 'Failed to save your profile.'));
    }
  };

  return (
    <PageContainer>
      <PageHeader title="My Profile" description="Your own contact details." />

      <ErrorAlert message={error ?? submitError} />

      {profile && (
        <form onSubmit={handleSubmit(onValid)} className="flex max-w-lg flex-col gap-4">
          {saved && (
            <div role="status" className="rounded-lg border border-success-500/30 bg-success-500/10 px-3.5 py-2.5 text-sm font-medium text-success-500">
              Saved.
            </div>
          )}

          <TextField label="Email" value={profile.email} disabled />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField label="First name" required {...register('firstName')} />
            <TextField label="Last name" required {...register('lastName')} />
          </div>
          <TextField label="Phone" {...register('phone')} />

          {profile.hasDetailsRecord ? (
            <>
              <TextField label="Address" {...register('address')} />
              <TextField label="ID / reference number" {...register('idNumber')} />
            </>
          ) : (
            <p className="text-sm text-content-tertiary">
              Address and ID details aren't set up for your account yet — contact your school to add them.
            </p>
          )}

          <div className="w-full sm:w-auto sm:min-w-[9rem]">
            <Button type="submit" isLoading={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </form>
      )}
    </PageContainer>
  );
}
