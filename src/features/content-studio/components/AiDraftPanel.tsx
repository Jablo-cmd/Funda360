import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Checkbox';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { useLoad } from '@/features/learning/hooks/useLoad';
import { contentStudioService } from '@/features/content-studio/services/contentStudioService';
import { PROVIDER_REASONS } from '@/features/content-studio/utils/studio';
import type { ContentEntityTable } from '@/lib/database.types';
import type { DraftResponse } from '@/features/content-studio/types';
import {
  ButtonSlot,
  Field,
  selectClass,
  textareaClass,
} from '@/features/content-studio/components/StudioBits';

export interface AiDraftPanelProps {
  onOpenUnit: (unit: { table: ContentEntityTable; id: string; title: string }) => void;
  onChanged: () => void;
}

/** Asks for an AI draft of one lesson pack. The result is only ever a draft that people must review. */
export function AiDraftPanel({ onOpenUnit, onChanged }: AiDraftPanelProps) {
  const versions = useLoad(() => contentStudioService.listVersions(), 'versions');
  const [versionId, setVersionId] = useState('');
  const [topicId, setTopicId] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DraftResponse | null>(null);

  const topics = useLoad(
    () => contentStudioService.listTopicChoices(versionId),
    `topics:${versionId}`,
    Boolean(versionId),
  );
  const topic = topics.data?.find((t) => t.id === topicId) ?? null;
  const usable = (topic?.objectives ?? []).filter(
    (o) => o.status === 'approved' || o.status === 'published',
  );

  function toggle(id: string) {
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  async function submit() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const outcome = await contentStudioService.requestAiDraft({
        versionId,
        topicId,
        objectiveIds: selected,
        instruction: note,
      });
      setResult(outcome);
      if (outcome.status === 'draft_created') onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The AI draft could not be created.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Ask for an AI draft">
      <p className="text-sm text-content-secondary">
        The AI writes a first draft for one topic. It is saved as a draft that only platform
        administrators can see. A different person must check it, compare it with a source and
        approve it before any teacher can use it.
      </p>
      <ErrorAlert message={versions.error ?? topics.error ?? error} />
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Field label="Curriculum version">
          <select
            className={selectClass}
            value={versionId}
            onChange={(e) => {
              setVersionId(e.target.value);
              setTopicId('');
              setSelected([]);
              setResult(null);
            }}
          >
            <option value="">Choose a version…</option>
            {(versions.data ?? []).map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} ({v.status})
              </option>
            ))}
          </select>
        </Field>
        <Field label="Topic">
          <select
            className={selectClass}
            value={topicId}
            disabled={!versionId || topics.isLoading}
            onChange={(e) => {
              setTopicId(e.target.value);
              setSelected([]);
              setResult(null);
            }}
          >
            <option value="">{versionId ? 'Choose a topic…' : 'Choose a version first'}</option>
            {(topics.data ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>
        {topic && (
          <fieldset className="flex min-w-0 flex-col gap-2">
            <legend className="mb-1 text-sm font-medium text-content-primary">
              Objectives to cover
            </legend>
            {topic.objectives.length === 0 && (
              <p className="text-sm text-content-tertiary">This topic has no objectives yet.</p>
            )}
            {topic.objectives.map((o) => {
              const ok = o.status === 'approved' || o.status === 'published';
              return (
                <Checkbox
                  key={o.id}
                  label={`${o.code}: ${o.description}${ok ? '' : ' (not approved yet, so it cannot be drafted)'}`}
                  checked={selected.includes(o.id)}
                  disabled={!ok}
                  onChange={() => toggle(o.id)}
                  className="items-start [&>input]:mt-1"
                />
              );
            })}
            {topic.objectives.length > 0 && usable.length === 0 && (
              <p className="text-sm text-content-secondary">
                None of these objectives is approved yet. Approve the curriculum version first.
              </p>
            )}
          </fieldset>
        )}
        <Field label="Note for the drafter (optional)">
          <textarea
            className={textareaClass}
            value={note}
            maxLength={2000}
            onChange={(e) => setNote(e.target.value)}
            aria-describedby="ai-note-hint"
          />
          <span id="ai-note-hint" className="text-xs font-normal text-content-tertiary">
            Style and focus only, for example “use farm animals”. It cannot change the safety rules.
          </span>
        </Field>
        <ButtonSlot>
          <Button type="submit" isLoading={busy} disabled={!topicId || selected.length === 0}>
            Create AI draft
          </Button>
        </ButtonSlot>
      </form>

      {result?.status === 'draft_created' && (
        <div
          role="status"
          className="flex flex-col gap-3 rounded-card border border-success-500/30 bg-success-500/10 p-3 text-sm text-content-primary"
        >
          <p>
            <strong>Draft created.</strong> It is saved as a draft with {result.resourceIds.length}{' '}
            toolkit {result.resourceIds.length === 1 ? 'resource' : 'resources'}
            {result.assessmentId ? ' and a quick check' : ''}. Nobody else can see it until it has
            been reviewed and published.
          </p>
          <ButtonSlot>
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                onOpenUnit({ table: 'lessons', id: result.lessonId, title: 'New AI draft lesson' })
              }
            >
              Review the new lesson
            </Button>
          </ButtonSlot>
        </div>
      )}
      {result?.status === 'rejected_output' && (
        <div
          role="status"
          className="rounded-card border border-warning-500/40 bg-warning-50 p-3 text-sm text-content-primary dark:bg-warning-500/10"
        >
          <p>
            <strong>The AI’s reply was refused and nothing was saved</strong>, because it did not
            follow the required format:
          </p>
          <ul className="mt-2 list-disc pl-5">
            {result.reasons.map((r) => (
              <li key={r} className="break-words">
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}
      {result?.status === 'failed' && (
        <div
          role="status"
          className="rounded-card border border-warning-500/40 bg-warning-50 p-3 text-sm text-content-primary dark:bg-warning-500/10"
        >
          <strong>The draft could not be created and nothing was saved.</strong>{' '}
          {PROVIDER_REASONS[result.reason] ?? ''}
        </div>
      )}
    </Card>
  );
}
