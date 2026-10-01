import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { LoadingBlock } from '@/components/ui/LoadingBlock';
import { Tabs } from '@/components/ui/Tabs';
import { useLoad } from '@/features/learning/hooks/useLoad';
import { contentStudioService } from '@/features/content-studio/services/contentStudioService';
import type { ContentEntityTable, ContentStatus } from '@/lib/database.types';
import { formatDate, UNIT_LABEL } from '@/features/content-studio/utils/studio';
import {
  Field,
  OriginBadge,
  selectClass,
  StatusBadge,
} from '@/features/content-studio/components/StudioBits';

type Filter = 'open' | 'all' | ContentStatus;

const TABS: Array<{ key: ContentEntityTable; label: string }> = [
  { key: 'lessons', label: 'Lessons' },
  { key: 'teaching_resources', label: 'Resources' },
  { key: 'learning_assessments', label: 'Assessments' },
];

export interface ReviewQueueProps {
  refreshKey: number;
  onOpenUnit: (unit: { table: ContentEntityTable; id: string; title: string }) => void;
}

export function ReviewQueue({ refreshKey, onOpenUnit }: ReviewQueueProps) {
  const [tab, setTab] = useState<ContentEntityTable>('lessons');
  const [filter, setFilter] = useState<Filter>('open');
  const units = useLoad(() => contentStudioService.listUnits(tab), `units:${tab}:${refreshKey}`);
  const shown = (units.data ?? []).filter((u) =>
    filter === 'all'
      ? true
      : filter === 'open'
        ? ['draft', 'review', 'approved'].includes(u.status)
        : u.status === filter,
  );

  return (
    <Card title="Review queue">
      <Tabs tabs={TABS} activeTab={tab} onChange={setTab} />
      <div className="sm:max-w-xs">
        <Field label="Show">
          <select
            className={selectClass}
            value={filter}
            onChange={(e) => setFilter(e.target.value as Filter)}
          >
            <option value="open">Needs attention (draft, in review, approved)</option>
            <option value="all">Everything</option>
            <option value="published">Published</option>
            <option value="retired">Retired</option>
          </select>
        </Field>
      </div>
      <ErrorAlert message={units.error} />
      {units.isLoading && !units.data ? (
        <LoadingBlock label="Loading content…" />
      ) : shown.length === 0 ? (
        <p className="text-sm text-content-secondary">Nothing to show here.</p>
      ) : (
        <ul className="flex flex-col gap-2" aria-label={`${UNIT_LABEL[tab]} list`}>
          {shown.map((u) => (
            <li
              key={u.id}
              className="flex flex-col gap-2 rounded-card border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="break-words text-sm font-semibold text-content-primary">{u.title}</p>
                <p className="break-words text-xs text-content-tertiary">
                  {u.topicLabel} · Updated {formatDate(u.updatedAt)}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <StatusBadge status={u.status} />
                  <OriginBadge origin={u.origin} />
                </div>
              </div>
              <button
                type="button"
                onClick={() => onOpenUnit({ table: u.table, id: u.id, title: u.title })}
                aria-label={`Review ${u.title}`}
                className="focus-ring inline-flex min-h-11 w-full shrink-0 items-center justify-center rounded-md border border-border-strong px-4 text-sm font-semibold text-content-primary hover:bg-surface-sunken sm:w-auto"
              >
                Review
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
