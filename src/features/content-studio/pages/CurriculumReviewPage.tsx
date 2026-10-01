import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { LoadingBlock } from '@/components/ui/LoadingBlock';
import { PageContainer } from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { useLoad } from '@/features/learning/hooks/useLoad';
import { curriculumReviewService } from '@/features/content-studio/services/curriculumReviewService';
import { FindingsPanel } from '@/features/content-studio/components/review/FindingsPanel';
import { FormalAssessmentPanel } from '@/features/content-studio/components/review/FormalAssessmentPanel';
import { OpenQuestionsPanel } from '@/features/content-studio/components/review/OpenQuestionsPanel';
import { ReviewItemsPanel } from '@/features/content-studio/components/review/ReviewItemsPanel';
import { ReviewSummaryPanel } from '@/features/content-studio/components/review/ReviewSummaryPanel';

const TABS = [
  { key: 'summary', label: 'Summary' },
  { key: 'objective', label: 'Objectives' },
  { key: 'questions', label: 'Open questions' },
  { key: 'formal', label: 'Formal assessment' },
  { key: 'lesson', label: 'Lessons' },
  { key: 'resource', label: 'Resources' },
  { key: 'assessment', label: 'Practice checks' },
  { key: 'question', label: 'Questions' },
  { key: 'findings', label: 'Findings' },
] as const;
type TabKey = (typeof TABS)[number]['key'];

/** The curriculum specialist's workspace for one curriculum version. Review is not approval: approval stays a separate step. */
export function CurriculumReviewPage() {
  const { versionCode = '' } = useParams();
  const [tab, setTab] = useState<TabKey>('summary');
  const [refresh, setRefresh] = useState(0);
  const changed = () => setRefresh((n) => n + 1);

  const version = useLoad(() => curriculumReviewService.versionByCode(versionCode), `version:${versionCode}`);
  const versionId = version.data?.id ?? '';
  const summary = useLoad(() => curriculumReviewService.summary(versionId), `summary:${versionId}:${refresh}`, Boolean(versionId));
  const sources = useLoad(() => curriculumReviewService.listSources(), `sources:${refresh}`, Boolean(versionId));

  if (version.isLoading && !version.data) {
    return (
      <PageContainer>
        <LoadingBlock label="Loading the curriculum version…" />
      </PageContainer>
    );
  }
  if (!version.data) {
    return (
      <PageContainer>
        <PageHeader title="Curriculum review" description="This curriculum version was not found." />
        <ErrorAlert message={version.error} />
        <Link to="/content-studio">Back to Content Studio</Link>
      </PageContainer>
    );
  }

  const v = version.data;
  const locked = v.status === 'approved' || v.status === 'published' || v.status === 'retired';
  const allSources = sources.data ?? [];

  return (
    <PageContainer>
      <PageHeader
        title="Curriculum review"
        description={`${v.name} (${v.code}). Lifecycle: ${v.status}. Reviewing is not approving: approval is a separate step by a different person.`}
      />
      <p>
        <Link to="/content-studio">Back to Content Studio</Link>
      </p>
      <ErrorAlert message={summary.error ?? sources.error} />
      <nav aria-label="Review sections">
        <ul className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <li key={t.key}>
              <button
                type="button"
                onClick={() => setTab(t.key)}
                aria-current={tab === t.key ? 'page' : undefined}
                className={`focus-ring min-h-11 rounded-md border px-3 text-sm font-medium lg:min-h-9 ${
                  tab === t.key
                    ? 'border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300'
                    : 'border-border-strong bg-surface-raised text-content-primary'
                }`}
              >
                {t.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      {tab === 'summary' &&
        (summary.data ? <ReviewSummaryPanel summary={summary.data} /> : <LoadingBlock label="Loading the summary…" />)}
      {(tab === 'objective' || tab === 'lesson' || tab === 'resource' || tab === 'assessment' || tab === 'question') && (
        <ReviewItemsPanel
          key={tab}
          versionId={v.id}
          type={tab}
          sources={allSources}
          locked={locked}
          onChanged={changed}
          refreshKey={refresh}
        />
      )}
      {tab === 'questions' && <OpenQuestionsPanel versionId={v.id} sources={allSources} locked={locked} onChanged={changed} refreshKey={refresh} />}
      {tab === 'formal' && <FormalAssessmentPanel versionId={v.id} sources={allSources} locked={locked} onChanged={changed} refreshKey={refresh} />}
      {tab === 'findings' && <FindingsPanel versionId={v.id} locked={false} onChanged={changed} refreshKey={refresh} />}
    </PageContainer>
  );
}
