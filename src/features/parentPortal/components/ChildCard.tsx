import { Link } from 'react-router-dom';
import { useSchool } from '@/features/school/hooks/useSchool';
import { useChildContext } from '@/features/parentPortal/hooks/useChildContext';
import type { Learner } from '@/features/learners/types/learner.types';

export interface ChildCardProps {
  learner: Learner;
}

export function ChildCard({ learner }: ChildCardProps) {
  const { school } = useSchool();
  const { gradeName, className, isLoading } = useChildContext(learner.id, school?.id);

  return (
    <Link
      to={`/parent/children/${learner.id}`}
      className="focus-ring flex items-center gap-4 rounded-card border border-border bg-surface-raised p-5 shadow-card transition-colors hover:bg-surface-sunken dark:shadow-card-dark"
    >
      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-600 text-lg font-semibold text-white">
        {learner.firstName[0]}
        {learner.lastName[0]}
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-lg font-bold text-content-primary">
          {learner.firstName} {learner.lastName}
        </h3>
        <p className="mt-0.5 text-sm text-content-secondary">
          {isLoading ? 'Loading…' : [gradeName, className].filter(Boolean).join(' · ') || 'No current class on file'}
        </p>
      </div>
    </Link>
  );
}
