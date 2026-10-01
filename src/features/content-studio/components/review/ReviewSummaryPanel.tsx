import { Card } from '@/components/ui/Card';
import { LICENCE_LABEL, countLine, type CountBlock, type ReviewSummary } from '@/features/content-studio/utils/review';
import { LadderExplainer } from '@/features/content-studio/components/review/LadderExplainer';
import { SOURCE_LEVEL_LABEL, type SourceEvidenceLevel } from '@/features/content-studio/utils/studio';
import type { CurriculumSourceRow } from '@/lib/database.types';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:gap-3">
      <dt className="w-40 shrink-0 text-xs font-semibold uppercase tracking-wider text-content-tertiary">{label}</dt>
      <dd className="min-w-0 break-words text-sm text-content-primary">{value}</dd>
    </div>
  );
}

function block(b: CountBlock, word: string) {
  return countLine(b, word);
}

/** The review dashboard. Every number comes from the database (curriculum_review_summary). */
export function ReviewSummaryPanel({ summary }: { summary: ReviewSummary }) {
  const q = summary.open_questions;
  return (
    <Card title="Review summary">
      <p className="text-lg font-semibold text-content-primary" role="status" aria-label="Overall status">
        {summary.overall}
      </p>
      <dl className="flex flex-col gap-2">
        <Row label="Version" value={`${summary.version_name} (${summary.version_code}) · lifecycle: ${summary.version_status}`} />
        <Row label="Objectives" value={block(summary.objective, 'verified')} />
        <Row label="Lessons" value={block(summary.lesson, 'accepted')} />
        <Row label="Resources" value={block(summary.resource, 'accepted')} />
        <Row label="Practice checks" value={block(summary.assessment, 'accepted')} />
        <Row label="Questions" value={block(summary.question, 'accepted')} />
        <Row label="Open questions" value={`${q.total} total · ${q.open} open · ${q.resolved} resolved · ${q.deferred} deferred (${q.deferred_material} affect scope)`} />
        <Row
          label="Formal assessment"
          value={
            summary.formal_assessment.verified === summary.formal_assessment.total && summary.formal_assessment.total > 0
              ? 'Verified'
              : `Pending · details recorded ${summary.formal_assessment.details_recorded} of ${summary.formal_assessment.total}`
          }
        />
        <Row label="Open findings" value={String(summary.open_findings)} />
      </dl>
      <div>
        <h3 className="mb-1 text-sm font-semibold text-content-primary">Sources</h3>
        <ul className="flex flex-col gap-1 text-sm text-content-secondary" aria-label="Source status">
          {summary.sources.map((s) => (
            <li key={s.id} className="break-words">
              <strong className="text-content-primary">{s.title}</strong>:{' '}
              {SOURCE_LEVEL_LABEL[s.evidence_level as SourceEvidenceLevel] ?? s.evidence_level} ·{' '}
              {LICENCE_LABEL[s.licence_status as CurriculumSourceRow['licence_status']] ?? s.licence_status}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="mb-1 text-sm font-semibold text-content-primary">
          {summary.ready ? 'Nothing blocks approval' : 'Why it cannot be approved yet'}
        </h3>
        {summary.blockers.length === 0 ? (
          <p className="text-sm text-content-secondary">
            Review is complete. Approval is a separate step by a different person; publication is
            another.
          </p>
        ) : (
          <ul className="list-disc pl-5 text-sm text-content-secondary" aria-label="Blockers">
            {summary.blockers.map((b) => (
              <li key={b} className="break-words">
                {b}
              </li>
            ))}
          </ul>
        )}
      </div>
      <LadderExplainer />
    </Card>
  );
}
