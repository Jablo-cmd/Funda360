import { useState } from 'react';
import { PageContainer } from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { AiDraftPanel } from '@/features/content-studio/components/AiDraftPanel';
import { ReviewQueue } from '@/features/content-studio/components/ReviewQueue';
import { ReviewModal, type ReviewTarget } from '@/features/content-studio/components/ReviewModal';
import { SourcesPanel } from '@/features/content-studio/components/SourcesPanel';
import { CurriculumReviewLinks } from '@/features/content-studio/components/review/CurriculumReviewLinks';

/** Internal workspace for platform administrators: draft, review, verify and publish curriculum content. */
export function ContentStudioPage() {
  const [target, setTarget] = useState<ReviewTarget | null>(null);
  const [refresh, setRefresh] = useState(0);
  const changed = () => setRefresh((n) => n + 1);

  return (
    <PageContainer>
      <PageHeader
        title="Content Studio"
        description="Draft, check and publish teaching content. Nothing reaches teachers until a person has reviewed it and a different person has approved it."
      />
      <CurriculumReviewLinks />
      <AiDraftPanel onOpenUnit={setTarget} onChanged={changed} />
      <ReviewQueue refreshKey={refresh} onOpenUnit={setTarget} />
      <SourcesPanel />
      <ReviewModal target={target} onClose={() => setTarget(null)} onChanged={changed} />
    </PageContainer>
  );
}
