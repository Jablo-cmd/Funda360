import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { FullScreenSpinner } from '@/components/ui/FullScreenSpinner';
import { FullScreenNotice } from '@/components/ui/FullScreenNotice';
import { PageContainer } from '@/components/ui/PageContainer';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { LoadingBlock } from '@/components/ui/LoadingBlock';
import { usePermissions } from '@/hooks/usePermissions';
import { useSchool } from '@/features/school/hooks/useSchool';
import { useClasses } from '@/features/academic/hooks/useClasses';
import { useSubjects } from '@/features/academic/hooks/useSubjects';
import { useTerms } from '@/features/academic/hooks/useTerms';
import { useMyTeachingAssignments } from '@/features/teaching/hooks/useMyTeachingAssignments';
import { useAssessment } from '@/features/assessments/hooks/useAssessment';
import { useAssessmentRoster } from '@/features/assessments/hooks/useAssessmentRoster';
import { assessmentService } from '@/features/assessments/services/assessmentService';
import { MarkEntryGrid } from '@/features/assessments/components/MarkEntryGrid';
import { AssessmentSummaryPanel } from '@/features/assessments/components/AssessmentSummaryPanel';
import { ASSESSMENT_TYPE_LABELS } from '@/features/assessments/types/assessment.types';
import { calculateMarkStats, isValidMark } from '@/features/assessments/utils/calculations';
import { getDbErrorMessage } from '@/lib/dbErrors';

function formatDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-ZA', { day: '2-digit', month: 'long', year: 'numeric' });
}

export function AssessmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { can } = usePermissions();
  const canManageAny = can('academic.manage');
  const { school } = useSchool();
  const { classes } = useClasses(school?.id);
  const { subjects } = useSubjects(school?.id);
  const myAssignments = useMyTeachingAssignments();

  const {
    assessment,
    isLoading: isAssessmentLoading,
    error: assessmentError,
    refetch: refetchAssessment,
  } = useAssessment(id);
  const { terms } = useTerms(assessment?.academicYearId);

  const canManageThisClass =
    canManageAny || myAssignments.data.some((a) => a.classId === assessment?.classId && a.active);

  const { roster, results, isLoading: isRosterLoading, error: rosterError } = useAssessmentRoster(
    assessment?.classId,
    assessment?.academicYearId,
    assessment?.id,
  );

  const [marks, setMarks] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const result of results) {
      next[result.learnerId] = String(result.mark);
    }
    setMarks(next);
    setSaved(false);
  }, [results]);

  const handleMarkChange = (learnerId: string, value: string) => {
    setMarks((prev) => ({ ...prev, [learnerId]: value }));
    setSaved(false);
  };

  const stats = useMemo(() => {
    if (!assessment) return null;
    const entered = roster
      .map((learner) => marks[learner.id])
      .filter((value): value is string => value !== undefined && value !== '')
      .map(Number)
      .filter((value) => !Number.isNaN(value));
    return calculateMarkStats(entered, assessment.maxMark, roster.length);
  }, [roster, marks, assessment]);

  const handleSave = async () => {
    if (!school || !assessment) return;
    setSaveError(null);

    const entries: { learnerId: string; mark: number }[] = [];
    for (const learner of roster) {
      const raw = marks[learner.id];
      if (raw === undefined || raw === '') continue;
      const mark = Number(raw);
      if (!isValidMark(mark, assessment.maxMark)) {
        setSaveError(
          `${learner.firstName} ${learner.lastName}'s mark must be a whole number between 0 and ${assessment.maxMark}.`,
        );
        return;
      }
      entries.push({ learnerId: learner.id, mark });
    }

    setIsSaving(true);
    try {
      await assessmentService.saveResults(school.id, assessment.id, entries);
      // Deliberately not refetching here — `marks` already reflects exactly
      // what was just submitted, and refetching would re-sync from
      // `results`, which resets `saved` to false as a side effect (see the
      // effect above) and would silently clobber this success message
      // before it ever painted. Same fix Sprint 6 needed for Attendance.
      setSaved(true);
    } catch (err) {
      setSaveError(getDbErrorMessage(err, 'Failed to save marks.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleArchiveToggle = async () => {
    if (!assessment) return;
    try {
      if (assessment.active) await assessmentService.archiveAssessment(assessment.id);
      else await assessmentService.restoreAssessment(assessment.id);
      await refetchAssessment();
    } catch (err) {
      setSaveError(getDbErrorMessage(err, 'Failed to update the assessment.'));
    }
  };

  if (isAssessmentLoading) {
    return <FullScreenSpinner label="Loading assessment…" />;
  }

  if (assessmentError) {
    return <FullScreenNotice title="Something went wrong" message={assessmentError} />;
  }

  if (!assessment || !school) {
    return (
      <FullScreenNotice
        title="Assessment not found"
        message="This assessment doesn't exist, or you don't have access to view it."
        action={
          <Link to="/academic/assessments" className="focus-ring rounded text-sm font-medium text-brand-600 hover:underline">
            Back to Assessments
          </Link>
        }
      />
    );
  }

  const cls = classes.find((c) => c.id === assessment.classId);
  const subject = subjects.find((s) => s.id === assessment.subjectId);
  const term = terms.find((t) => t.id === assessment.termId);

  return (
    <PageContainer>
      <button
        type="button"
        onClick={() => navigate('/academic/assessments')}
        className="focus-ring self-start rounded text-sm font-medium text-content-secondary hover:text-content-primary"
      >
        ← Back to Assessments
      </button>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-content-primary">{assessment.title}</h1>
          <p className="mt-0.5 text-sm text-content-secondary">
            {cls?.name ?? 'Class'} · {subject?.name ?? 'Subject'} · {term?.name ?? 'Term'}
          </p>
          <p className="mt-0.5 font-mono text-xs text-content-tertiary">
            {ASSESSMENT_TYPE_LABELS[assessment.assessmentType]} · {formatDate(assessment.assessmentDate)} · Maximum{' '}
            {assessment.maxMark}
            {!assessment.active && ' · Archived'}
          </p>
        </div>
        {canManageThisClass && (
          <div className="w-full sm:w-auto sm:min-w-[8rem]">
            <Button type="button" variant="secondary" onClick={() => void handleArchiveToggle()}>
              {assessment.active ? 'Archive' : 'Restore'}
            </Button>
          </div>
        )}
      </div>

      <ErrorAlert message={rosterError ?? saveError} />

      {isRosterLoading ? (
        <LoadingBlock label="Loading roster…" />
      ) : (
        <>
          {stats && <AssessmentSummaryPanel stats={stats} maxMark={assessment.maxMark} />}

          <MarkEntryGrid
            roster={roster}
            marks={marks}
            onChange={handleMarkChange}
            maxMark={assessment.maxMark}
            readOnly={!canManageThisClass || !assessment.active}
          />

          {canManageThisClass && assessment.active && roster.length > 0 && (
            <div className="flex items-center justify-end gap-3">
              {saved && <span className="text-sm text-success-500">Marks saved.</span>}
              <div className="w-full sm:w-auto sm:min-w-[9rem]">
                <Button type="button" onClick={() => void handleSave()} isLoading={isSaving}>
                  Save marks
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </PageContainer>
  );
}
