import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { PageContainer } from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { LoadingBlock } from '@/components/ui/LoadingBlock';
import { NoActiveSchoolNotice } from '@/components/ui/NoActiveSchoolNotice';
import { TableScrollContainer } from '@/components/ui/TableScrollContainer';
import { usePermissions } from '@/hooks/usePermissions';
import { useSchool } from '@/features/school/hooks/useSchool';
import { useAcademic } from '@/features/academic/hooks/useAcademic';
import { useGrades } from '@/features/academic/hooks/useGrades';
import { useFeeStructures } from '@/features/fees/hooks/useFeeStructures';
import { feeService } from '@/features/fees/services/feeService';
import { FeeStructureFormModal } from '@/features/fees/components/FeeStructureFormModal';
import { getDbErrorMessage } from '@/lib/dbErrors';

const CATEGORY_LABELS: Record<string, string> = {
  tuition: 'Tuition',
  transport: 'Transport',
  boarding: 'Boarding',
  uniform: 'Uniform',
  activity: 'Activity',
  other: 'Other',
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(amount);
}

export function FeeStructuresPage() {
  const { can } = usePermissions();
  const canManage = can('learner.manage_financial');
  const { school } = useSchool();
  const { currentAcademicYear } = useAcademic();
  const { grades } = useGrades(school?.id);
  const { feeStructures, isLoading, error, refetch } = useFeeStructures(school?.id, currentAcademicYear?.id);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleArchive = async (id: string) => {
    setActionError(null);
    try {
      await feeService.archiveFeeStructure(id);
      await refetch();
    } catch (err) {
      setActionError(getDbErrorMessage(err, 'Failed to archive fee structure.'));
    }
  };

  const gradeName = (gradeId: string | null) => (gradeId ? grades.find((g) => g.id === gradeId)?.name ?? '—' : 'Any grade');

  return (
    <PageContainer>
      <PageHeader
        title="Fee Structures"
        description="The reusable fee catalogue staff can pick from when charging a learner — e.g. Term 1 Tuition for Grade 8."
        action={
          canManage &&
          school &&
          currentAcademicYear && (
            <div className="w-full sm:w-auto sm:min-w-[9rem]">
              <Button type="button" onClick={() => setIsFormOpen(true)}>
                Add fee structure
              </Button>
            </div>
          )
        }
      />

      <ErrorAlert message={error ?? actionError} />

      {!school ? (
        <NoActiveSchoolNotice resource="fee structures" />
      ) : !currentAcademicYear ? (
        <div className="rounded-card border border-border bg-surface-raised px-4 py-10 text-center text-sm text-content-tertiary">
          No active academic year — set one up under Academic Structure first.
        </div>
      ) : isLoading ? (
        <LoadingBlock label="Loading fee structures…" />
      ) : feeStructures.length === 0 ? (
        <div className="rounded-card border border-border bg-surface-raised px-4 py-10 text-center text-sm text-content-tertiary">
          No fee structures yet for {currentAcademicYear.name}.
        </div>
      ) : (
        <TableScrollContainer>
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-content-tertiary">
                <th scope="col" className="px-4 py-3 font-medium">Name</th>
                <th scope="col" className="px-4 py-3 font-medium">Category</th>
                <th scope="col" className="px-4 py-3 font-medium">Grade</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Amount</th>
                {canManage && <th scope="col" className="px-4 py-3 text-right font-medium">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {feeStructures.map((fs) => (
                <tr key={fs.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium text-content-primary">{fs.name}</td>
                  <td className="px-4 py-3 text-content-secondary">{CATEGORY_LABELS[fs.category]}</td>
                  <td className="px-4 py-3 text-content-secondary">{gradeName(fs.gradeId)}</td>
                  <td className="px-4 py-3 text-right font-mono text-content-primary">{formatCurrency(fs.amount)}</td>
                  {canManage && (
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => void handleArchive(fs.id)}
                        className="focus-ring rounded-md px-2 py-1 text-xs font-medium text-danger-600 hover:bg-danger-50"
                      >
                        Archive
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </TableScrollContainer>
      )}

      {school && currentAcademicYear && (
        <FeeStructureFormModal
          isOpen={isFormOpen}
          onClose={() => setIsFormOpen(false)}
          schoolId={school.id}
          academicYearId={currentAcademicYear.id}
          grades={grades}
          onSaved={() => void refetch()}
        />
      )}
    </PageContainer>
  );
}
