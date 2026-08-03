import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { FullScreenSpinner } from '@/components/ui/FullScreenSpinner';
import { usePermissions } from '@/hooks/usePermissions';
import { useSchool } from '@/features/school/hooks/useSchool';
import { useAcademic } from '@/features/academic/hooks/useAcademic';
import { useTerms } from '@/features/academic/hooks/useTerms';
import { termService } from '@/features/academic/services/termService';
import { TermsTable } from '@/features/academic/components/TermsTable';
import { TermFormModal } from '@/features/academic/components/TermFormModal';
import type { Term } from '@/features/academic/types/academic.types';

export function TermsPage() {
  const { can } = usePermissions();
  const canManage = can('academic.manage');
  const { school } = useSchool();
  const { academicYears, currentAcademicYear, loading: academicLoading } = useAcademic();

  const [selectedYearId, setSelectedYearId] = useState<string>('');

  useEffect(() => {
    if (selectedYearId) return;
    const defaultYearId = currentAcademicYear?.id ?? academicYears[0]?.id;
    if (defaultYearId) setSelectedYearId(defaultYearId);
  }, [selectedYearId, currentAcademicYear, academicYears]);

  const { terms, isLoading, error, refetch } = useTerms(selectedYearId || undefined);

  const [showArchived, setShowArchived] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTerm, setEditingTerm] = useState<Term | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  if (academicLoading || !school) {
    return <FullScreenSpinner label="Loading terms…" />;
  }

  const visibleTerms = showArchived ? terms : terms.filter((term) => term.active);

  const openCreate = () => {
    setEditingTerm(null);
    setIsFormOpen(true);
  };

  const openEdit = (term: Term) => {
    setEditingTerm(term);
    setIsFormOpen(true);
  };

  const handleToggleActive = async (term: Term) => {
    setActionError(null);
    try {
      if (term.active) {
        await termService.archiveTerm(term.id);
      } else {
        await termService.restoreTerm(term.id);
      }
      await refetch();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update term.');
    }
  };

  if (academicYears.length === 0) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-bold text-content-primary">Terms</h1>
        <p className="mt-2 text-sm text-content-secondary">
          Add an academic year first — terms belong to a specific academic year.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-content-primary">Terms</h1>
          <p className="mt-1 text-sm text-content-secondary">Manage the terms within an academic year.</p>
        </div>
        {canManage && selectedYearId && (
          <div className="w-full sm:w-auto sm:min-w-[9rem]">
            <Button type="button" onClick={openCreate}>
              Add term
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="sm:w-64">
          <label htmlFor="terms-year-select" className="mb-1.5 block text-sm font-medium text-content-primary">
            Academic year
          </label>
          <select
            id="terms-year-select"
            value={selectedYearId}
            onChange={(event) => setSelectedYearId(event.target.value)}
            className="focus-ring h-11 w-full rounded-lg border border-border-strong bg-surface-raised px-3.5 text-sm text-content-primary"
          >
            {academicYears.map((year) => (
              <option key={year.id} value={year.id}>
                {year.name} {year.isActive ? '(active)' : ''}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 self-end text-sm text-content-secondary sm:pb-2.5">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(event) => setShowArchived(event.target.checked)}
            className="focus-ring h-4 w-4 rounded border-border-strong"
          />
          Show archived terms
        </label>
      </div>

      {(error ?? actionError) && (
        <div
          role="alert"
          className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-600"
        >
          {error ?? actionError}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <span
            aria-hidden="true"
            className="h-8 w-8 animate-spin-smooth rounded-full border-2 border-brand-600 border-t-transparent"
          />
          <span className="sr-only">Loading terms…</span>
        </div>
      ) : (
        <TermsTable
          terms={visibleTerms}
          canManage={canManage}
          onEdit={openEdit}
          onToggleActive={(term) => void handleToggleActive(term)}
        />
      )}

      {selectedYearId && (
        <TermFormModal
          isOpen={isFormOpen}
          onClose={() => setIsFormOpen(false)}
          schoolId={school.id}
          academicYearId={selectedYearId}
          term={editingTerm}
          onSaved={() => void refetch()}
        />
      )}
    </div>
  );
}
