import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { useLoad } from '@/features/learning/hooks/useLoad';
import { curriculumReviewService } from '@/features/content-studio/services/curriculumReviewService';

/** Entry point to the curriculum specialist review for every version that uses the review workflow. */
export function CurriculumReviewLinks() {
  const versions = useLoad(() => curriculumReviewService.listReviewVersions(), 'review-versions');
  const list = versions.data ?? [];
  if (!versions.error && list.length === 0) return null;
  return (
    <Card title="Curriculum review">
      <p className="text-sm text-content-secondary">
        A curriculum version in review cannot be approved, published or drafted against by AI until
        a specialist has reviewed its sources, objectives, lessons, resources, questions and open
        questions.
      </p>
      <ErrorAlert message={versions.error} />
      <ul className="flex flex-col gap-2" aria-label="Curriculum versions in review">
        {list.map((v) => (
          <li key={v.id} className="break-words text-sm">
            <Link to={`/content-studio/curriculum-review/${encodeURIComponent(v.code)}`}>
              Review {v.name} ({v.code})
            </Link>{' '}
            <span className="text-content-tertiary">Lifecycle: {v.status}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
