import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { PageContainer } from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { LoadingBlock } from '@/components/ui/LoadingBlock';
import { useTenant } from '@/features/tenant/context/tenantContext';
import { SchoolsTable } from '@/features/tenant/components/SchoolsTable';
import { CreateSchoolModal } from '@/features/tenant/components/CreateSchoolModal';
import { getDbErrorMessage } from '@/lib/dbErrors';
import type { School } from '@/types/school.types';

/**
 * The platform-admin onboarding + tenant-switching hub. Reachable only by
 * roles with the `tenant.switch` permission (see RequirePermission on the
 * /schools route) — tenant-scoped roles already belong to a single school
 * and never need this page.
 */
export function SchoolsPage() {
  const navigate = useNavigate();
  const { tenant, availableSchools, availableSchoolsLoading, switchTenant } = useTenant();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleSwitch = async (school: School) => {
    setActionError(null);
    setSwitchingId(school.id);
    try {
      await switchTenant(school.id);
      navigate('/dashboard');
    } catch (err) {
      setActionError(getDbErrorMessage(err, 'Failed to switch school.'));
    } finally {
      setSwitchingId(null);
    }
  };

  const handleCreated = () => {
    // createSchool() already switched the active tenant to the new school.
    navigate('/dashboard');
  };

  return (
    <PageContainer>
      <PageHeader
        title="Schools"
        description="Onboard a new school, or switch which school you're currently managing."
        action={
          <div className="w-full sm:w-auto sm:min-w-[9rem]">
            <Button type="button" onClick={() => setIsCreateOpen(true)}>
              Create school
            </Button>
          </div>
        }
      />

      <ErrorAlert message={actionError} />

      {availableSchoolsLoading ? (
        <LoadingBlock label="Loading schools…" />
      ) : (
        <SchoolsTable
          schools={availableSchools}
          activeSchoolId={tenant?.id ?? null}
          onSwitch={(school) => void handleSwitch(school)}
          switchingId={switchingId}
        />
      )}

      <CreateSchoolModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreated={handleCreated}
      />
    </PageContainer>
  );
}
