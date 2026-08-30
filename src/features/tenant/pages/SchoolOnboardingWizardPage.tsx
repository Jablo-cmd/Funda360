import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/Button';
import { PageContainer } from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { TextField } from '@/components/ui/TextField';
import { useTenant } from '@/features/tenant/context/tenantContext';
import { userService } from '@/features/users/services/userService';
import { ASSIGNABLE_ROLE_LABELS } from '@/features/users/types/user.types';
import type { CreateUserResult } from '@/features/users/types/user.types';
import { academicYearService } from '@/features/academic/services/academicYearService';
import { getDbErrorMessage } from '@/lib/dbErrors';
import {
  schoolCreateSchema,
  schoolCreateDefaultValues,
  type SchoolCreateFormValues,
} from '@/features/tenant/schemas/schoolCreateSchema';
import {
  onboardingOwnerSchema,
  onboardingOwnerDefaultValues,
  type OnboardingOwnerFormValues,
} from '@/features/tenant/schemas/onboardingOwnerSchema';
import {
  academicYearSchema,
  academicYearDefaultValues,
  type AcademicYearFormValues,
} from '@/features/academic/schemas/academicYearSchema';
import type { School } from '@/types/school.types';

type WizardStep = 1 | 2 | 3 | 4;

const STEP_LABELS: Record<WizardStep, string> = {
  1: 'School details',
  2: 'First admin account',
  3: 'First academic year',
  4: 'Done',
};

/**
 * FND-BIZ-001 — guides a platform admin through the full sequence that
 * onboarding a school actually requires, instead of the three or four
 * separate, easy-to-forget page visits it took before this existed
 * (Schools → Create school, then Users → Add user while remembering to
 * pick the right school, then Academic → Years → New year). Each of the
 * three data-creating steps calls the exact same service function the
 * existing standalone pages already use and are already tested against —
 * this wizard only sequences them, it does not duplicate their logic.
 *
 * Steps 2 and 3 are skippable — the school itself (step 1) is the only
 * genuinely required part; a platform admin who wants to hand the rest to
 * someone else, or do it later via the existing pages, is not blocked.
 */
export function SchoolOnboardingWizardPage() {
  const navigate = useNavigate();
  const { createSchool, switchTenant } = useTenant();

  const [step, setStep] = useState<WizardStep>(1);
  const [school, setSchool] = useState<School | null>(null);
  const [ownerResult, setOwnerResult] = useState<CreateUserResult | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);
  const [isSwitching, setIsSwitching] = useState(false);

  const schoolForm = useForm<SchoolCreateFormValues>({
    resolver: zodResolver(schoolCreateSchema),
    defaultValues: schoolCreateDefaultValues,
  });
  const ownerForm = useForm<OnboardingOwnerFormValues>({
    resolver: zodResolver(onboardingOwnerSchema),
    defaultValues: onboardingOwnerDefaultValues,
  });
  const yearForm = useForm<AcademicYearFormValues>({
    resolver: zodResolver(academicYearSchema),
    defaultValues: academicYearDefaultValues,
  });

  const handleSchoolSubmit = schoolForm.handleSubmit(async (values) => {
    setStepError(null);
    try {
      // createSchool() does NOT switch the active tenant (see
      // TenantContextValue's doc comment) — deliberately: switching mid-
      // wizard would flash TenantGate's loading spinner and remount this
      // page, wiping every later step's state. The active tenant is only
      // switched once, right when the wizard is actually finishing (see
      // handleFinish below).
      const created = await createSchool({
        name: values.name,
        schoolType: values.schoolType,
        status: values.status,
        province: values.province?.trim() || null,
      });
      setSchool(created);
      setStep(2);
    } catch (err) {
      setStepError(getDbErrorMessage(err, 'Failed to create school.'));
    }
  });

  const handleOwnerSubmit = ownerForm.handleSubmit(async (values) => {
    if (!school) return;
    setStepError(null);
    try {
      const result = await userService.createUser({
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        email: values.email.trim(),
        phone: values.phone?.trim() || null,
        role: values.role,
        tenantId: school.id,
      });
      setOwnerResult(result);
      setStep(3);
    } catch (err) {
      setStepError(getDbErrorMessage(err, 'Failed to create the first admin account.'));
    }
  });

  const handleYearSubmit = yearForm.handleSubmit(async (values) => {
    if (!school) return;
    setStepError(null);
    try {
      await academicYearService.createAcademicYear(school.id, values);
      setStep(4);
    } catch (err) {
      setStepError(getDbErrorMessage(err, 'Failed to create the academic year.'));
    }
  });

  /**
   * Switches the active tenant to the newly onboarded school, then
   * navigates — done together, right at the point of actually leaving
   * this page, so TenantGate's brief loading-spinner remount (see
   * handleSchoolSubmit's comment) never has a chance to disrupt anything:
   * there's nothing left on this page to lose once we're navigating away.
   */
  const handleFinish = async (path: string) => {
    if (!school) return;
    setStepError(null);
    setIsSwitching(true);
    try {
      await switchTenant(school.id);
      navigate(path);
    } catch (err) {
      setStepError(getDbErrorMessage(err, 'Failed to switch to the new school.'));
      setIsSwitching(false);
    }
  };

  return (
    <PageContainer>
      <PageHeader title="Onboard a new school" description="Set up a school, its first admin account, and its first academic year." />

      <nav aria-label="Onboarding progress" className="flex flex-wrap items-center gap-2 text-xs font-medium text-content-tertiary">
        {([1, 2, 3, 4] as WizardStep[]).map((s, i) => (
          <span key={s} className="flex items-center gap-2">
            {i > 0 && <span aria-hidden="true">→</span>}
            <span className={s === step ? 'text-brand-600' : s < step ? 'text-content-secondary' : undefined}>
              {s}. {STEP_LABELS[s]}
            </span>
          </span>
        ))}
      </nav>

      {stepError && (
        <div role="alert" className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-600">
          {stepError}
        </div>
      )}

      {step === 1 && (
        <form noValidate onSubmit={handleSchoolSubmit} className="flex max-w-lg flex-col gap-4">
          <TextField label="School name" required placeholder="Riverside Secondary School" error={schoolForm.formState.errors.name?.message} {...schoolForm.register('name')} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="wizard-school-type" className="mb-1.5 block text-sm font-medium text-content-primary">
                School type
              </label>
              <select
                id="wizard-school-type"
                className="focus-ring h-11 w-full rounded-md border border-border-strong bg-surface-raised px-3.5 text-sm text-content-primary"
                {...schoolForm.register('schoolType')}
              >
                <option value="public">Public</option>
                <option value="private">Private</option>
                <option value="independent">Independent</option>
              </select>
            </div>
            <div>
              <label htmlFor="wizard-school-status" className="mb-1.5 block text-sm font-medium text-content-primary">
                Status
              </label>
              <select
                id="wizard-school-status"
                className="focus-ring h-11 w-full rounded-md border border-border-strong bg-surface-raised px-3.5 text-sm text-content-primary"
                {...schoolForm.register('status')}
              >
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="inactive">Inactive</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
          </div>
          <TextField label="Province" placeholder="Gauteng" error={schoolForm.formState.errors.province?.message} {...schoolForm.register('province')} />
          <div className="w-full sm:w-auto sm:min-w-[9rem]">
            <Button type="submit" isLoading={schoolForm.formState.isSubmitting}>
              {schoolForm.formState.isSubmitting ? 'Creating…' : 'Create school and continue'}
            </Button>
          </div>
        </form>
      )}

      {step === 2 && school && (
        <form noValidate onSubmit={handleOwnerSubmit} className="flex max-w-lg flex-col gap-4">
          <p className="text-sm text-content-tertiary">
            {school.name} has been created. Add its first admin account — they can invite and provision everyone else at the school from here.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField label="First name" required error={ownerForm.formState.errors.firstName?.message} {...ownerForm.register('firstName')} />
            <TextField label="Last name" required error={ownerForm.formState.errors.lastName?.message} {...ownerForm.register('lastName')} />
          </div>
          <TextField label="Email" type="email" required error={ownerForm.formState.errors.email?.message} {...ownerForm.register('email')} />
          <TextField label="Phone" type="tel" error={ownerForm.formState.errors.phone?.message} {...ownerForm.register('phone')} />
          <div>
            <label htmlFor="wizard-owner-role" className="mb-1.5 block text-sm font-medium text-content-primary">
              Role
            </label>
            <select
              id="wizard-owner-role"
              className="focus-ring h-11 w-full rounded-md border border-border-strong bg-surface-raised px-3.5 text-sm text-content-primary"
              {...ownerForm.register('role')}
            >
              <option value="school_owner">{ASSIGNABLE_ROLE_LABELS.school_owner}</option>
              <option value="principal">{ASSIGNABLE_ROLE_LABELS.principal}</option>
            </select>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="w-full sm:w-auto sm:min-w-[9rem]">
              <Button type="submit" isLoading={ownerForm.formState.isSubmitting}>
                {ownerForm.formState.isSubmitting ? 'Creating…' : 'Create account and continue'}
              </Button>
            </div>
            <Button type="button" variant="secondary" onClick={() => setStep(3)}>
              Skip this step
            </Button>
          </div>
        </form>
      )}

      {step === 3 && school && (
        <div className="flex max-w-lg flex-col gap-4">
          {ownerResult && (
            <div className="rounded-lg border border-success-500/30 bg-success-500/10 px-3.5 py-3 text-sm">
              <p className="font-medium text-success-500">Admin account created.</p>
              <p className="mt-1.5 text-content-secondary">Temporary password — share this with them, it won&apos;t be shown again:</p>
              <p className="mt-1 select-all break-all font-mono text-content-primary">{ownerResult.temporaryPassword}</p>
            </div>
          )}
          <form noValidate onSubmit={handleYearSubmit} className="flex flex-col gap-4">
            <p className="text-sm text-content-tertiary">Optionally set up {school.name}&apos;s first academic year now.</p>
            <TextField label="Name" required placeholder="2026" error={yearForm.formState.errors.name?.message} {...yearForm.register('name')} />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField label="Start date" type="date" required error={yearForm.formState.errors.startDate?.message} {...yearForm.register('startDate')} />
              <TextField label="End date" type="date" required error={yearForm.formState.errors.endDate?.message} {...yearForm.register('endDate')} />
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="w-full sm:w-auto sm:min-w-[9rem]">
                <Button type="submit" isLoading={yearForm.formState.isSubmitting}>
                  {yearForm.formState.isSubmitting ? 'Creating…' : 'Create year and finish'}
                </Button>
              </div>
              <Button type="button" variant="secondary" onClick={() => setStep(4)}>
                Skip this step
              </Button>
            </div>
          </form>
        </div>
      )}

      {step === 4 && school && (
        <div className="flex max-w-lg flex-col gap-4">
          <div role="status" className="rounded-lg border border-success-500/30 bg-success-500/10 px-3.5 py-3 text-sm font-medium text-success-500">
            {school.name} is set up. Continuing will make it your active school.
          </div>
          <div className="flex flex-wrap gap-3">
            <Button type="button" isLoading={isSwitching} onClick={() => void handleFinish('/school/profile')}>
              Go to school profile
            </Button>
            <Button type="button" variant="secondary" disabled={isSwitching} onClick={() => void handleFinish('/users')}>
              View users
            </Button>
            <Button type="button" variant="secondary" disabled={isSwitching} onClick={() => navigate('/schools')}>
              Back to Schools
            </Button>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
