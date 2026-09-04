import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageContainer } from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { LoadingBlock } from '@/components/ui/LoadingBlock';
import { NoActiveSchoolNotice } from '@/components/ui/NoActiveSchoolNotice';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import { usePermissions } from '@/hooks/usePermissions';
import { useSchool } from '@/features/school/hooks/useSchool';
import { useAcademic } from '@/features/academic/hooks/useAcademic';
import { useTerms } from '@/features/academic/hooks/useTerms';
import { useClasses } from '@/features/academic/hooks/useClasses';
import { useGrades } from '@/features/academic/hooks/useGrades';
import { useReportCardTemplates } from '@/features/reportCards/hooks/useReportCardTemplates';
import { useReportCards } from '@/features/reportCards/hooks/useReportCards';
import { reportCardService } from '@/features/reportCards/services/reportCardService';
import { ReportCardStatusBadge } from '@/features/reportCards/components/ReportCardStatusBadge';
import { generateReportCardBundle } from '@/features/reportCards/utils/generateReportCardDocument';
import type { ReportCard } from '@/features/reportCards/types/reportCard.types';
import { getDbErrorMessage } from '@/lib/dbErrors';
import { useToast } from '@/components/ui/toast/useToast';

const SELECT_CLASS = 'focus-ring h-11 rounded-md border border-border-strong bg-surface-raised px-3 text-sm text-content-primary';

export function ReportCardsPage() {
  const { can } = usePermissions();
  const canManage = can('reportcard.manage');
  const canApprove = can('reportcard.approve');
  const { school } = useSchool();
  const { currentAcademicYear } = useAcademic();
  const { showToast } = useToast();

  const { terms } = useTerms(currentAcademicYear?.id);
  const { classes } = useClasses(school?.id);
  const { grades } = useGrades(school?.id);
  const { templates } = useReportCardTemplates(school?.id);

  const [termId, setTermId] = useState('');
  const [classId, setClassId] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { cards, isLoading, error, refetch } = useReportCards(school?.id, {
    termId: termId || undefined,
    classId: classId || undefined,
  });

  const gradeName = (id: string) => grades.find((g) => g.id === id)?.name ?? '';
  const className = (id: string) => classes.find((c) => c.id === id)?.name ?? '';
  const termName = (id: string) => terms.find((t) => t.id === id)?.name ?? '';

  const approvedInView = useMemo(() => cards.filter((c) => c.status === 'approved'), [cards]);

  const generateForClass = async () => {
    if (!classId || !termId || !templateId) return;
    setBusy('generate');
    setActionError(null);
    try {
      const batch = await reportCardService.generateForClass(classId, termId, templateId);
      showToast(`Generated ${batch.generatedCount} draft report card${batch.generatedCount === 1 ? '' : 's'} (${batch.skippedCount} skipped).`, {
        variant: 'success',
      });
      await refetch();
    } catch (err) {
      setActionError(getDbErrorMessage(err, 'Failed to generate report cards.'));
    } finally {
      setBusy(null);
    }
  };

  const publishApproved = async () => {
    setBusy('publish');
    setActionError(null);
    try {
      let count = 0;
      for (const card of approvedInView) {
        await reportCardService.publish(card.id);
        count += 1;
      }
      showToast(`Published ${count} report card${count === 1 ? '' : 's'}.`, { variant: 'success' });
      await refetch();
    } catch (err) {
      setActionError(getDbErrorMessage(err, 'Failed to publish report cards.'));
    } finally {
      setBusy(null);
    }
  };

  const downloadBundle = async () => {
    if (cards.length === 0 || !school) return;
    setBusy('pdf');
    setActionError(null);
    try {
      const [fullCards, subjects] = await Promise.all([
        Promise.all(cards.map((c) => reportCardService.getCard(c.id))),
        reportCardService.getSubjectsForCards(cards.map((c) => c.id)),
      ]);
      const bundle = fullCards
        .filter((c): c is NonNullable<typeof c> => c !== null)
        .map((full) => {
          const template = templates.find((t) => t.id === full.templateId);
          return {
            card: { ...full, subjects: subjects.filter((s) => s.reportCardId === full.id) },
            ctx: {
              schoolName: school.name,
              schoolAddress: school.physicalAddress,
              gradeName: gradeName(full.gradeId),
              className: className(full.classId),
              termName: termName(full.termId),
              academicYearName: currentAcademicYear?.name,
              template: template!,
            },
          };
        })
        .filter((entry) => entry.ctx.template);
      const doc = await generateReportCardBundle(bundle);
      doc.save(`report-cards-${className(classId) || 'all'}-${termName(termId) || 'term'}.pdf`);
    } catch (err) {
      setActionError(getDbErrorMessage(err, 'Failed to build the PDF.'));
    } finally {
      setBusy(null);
    }
  };

  const canGenerate = canManage && classId && termId && templateId;

  return (
    <PageContainer>
      <PageHeader title="Report Cards" description="Generate, review, approve and publish learner report cards." />

      <ErrorAlert message={error ?? actionError} />

      {!school ? (
        <NoActiveSchoolNotice resource="report cards" />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-xs font-medium text-content-tertiary">
              Term
              <select aria-label="Filter by term" className={SELECT_CLASS} value={termId} onChange={(e) => setTermId(e.target.value)}>
                <option value="">All terms</option>
                {terms.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-content-tertiary">
              Class
              <select aria-label="Filter by class" className={SELECT_CLASS} value={classId} onChange={(e) => setClassId(e.target.value)}>
                <option value="">All classes</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            {canManage && (
              <label className="flex flex-col gap-1 text-xs font-medium text-content-tertiary">
                Template
                <select aria-label="Report card template" className={SELECT_CLASS} value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                  <option value="">Select…</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {canManage && (
              <Button onClick={generateForClass} disabled={!canGenerate} isLoading={busy === 'generate'}>
                Generate for class
              </Button>
            )}
          </div>

          {cards.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={downloadBundle} isLoading={busy === 'pdf'}>
                Download {cards.length} as PDF
              </Button>
              {canApprove && approvedInView.length > 0 && (
                <Button variant="secondary" onClick={publishApproved} isLoading={busy === 'publish'}>
                  Publish {approvedInView.length} approved
                </Button>
              )}
            </div>
          )}

          {isLoading ? (
            <LoadingBlock label="Loading report cards…" />
          ) : (
            <DataTable<ReportCard>
              columns={[
                {
                  key: 'learner',
                  header: 'Learner',
                  render: (row) => (
                    <Link to={`/report-cards/${row.id}`} className="font-medium text-brand-600 hover:underline dark:text-brand-400">
                      {row.learnerName}
                    </Link>
                  ),
                },
                { key: 'number', header: 'Learner #', render: (row) => row.learnerNumber },
                { key: 'term', header: 'Term', render: (row) => termName(row.termId) },
                { key: 'class', header: 'Class', render: (row) => className(row.classId) },
                {
                  key: 'overall',
                  header: 'Overall',
                  align: 'right',
                  render: (row) =>
                    row.overallAveragePercentage === null ? '—' : `${row.overallAveragePercentage}%${row.overallAchievementCode ? ` (${row.overallAchievementCode})` : ''}`,
                },
                { key: 'version', header: 'Ver.', align: 'right', render: (row) => (row.version > 1 ? `v${row.version}` : '—') },
                { key: 'status', header: 'Status', render: (row) => <ReportCardStatusBadge status={row.status} /> },
              ]}
              rows={cards}
              getRowKey={(row) => row.id}
              emptyMessage="No report cards for this filter yet."
            />
          )}
        </div>
      )}
    </PageContainer>
  );
}
