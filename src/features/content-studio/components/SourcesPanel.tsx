import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { LoadingBlock } from '@/components/ui/LoadingBlock';
import { TextField } from '@/components/ui/TextField';
import { useToast } from '@/components/ui/toast/useToast';
import { useLoad } from '@/features/learning/hooks/useLoad';
import { curriculumErrorMessage } from '@/features/learning/utils/errors';
import { contentStudioService } from '@/features/content-studio/services/contentStudioService';
import type { CurriculumSourceRow } from '@/lib/database.types';
import {
  SOURCE_LEVEL_LABEL,
  sourceEvidenceLevel,
  sourceEvidenceSteps,
} from '@/features/content-studio/utils/studio';
import { ButtonSlot, Field, selectClass } from '@/features/content-studio/components/StudioBits';

const DOC_TYPES: Array<{ value: CurriculumSourceRow['doc_type']; label: string }> = [
  { value: 'caps_policy', label: 'Curriculum policy statement' },
  { value: 'annual_teaching_plan', label: 'Annual teaching plan' },
  { value: 'assessment_guideline', label: 'Assessment guideline' },
  { value: 'textbook', label: 'Textbook' },
  { value: 'other', label: 'Other' },
];

type Run = (label: string, action: () => Promise<void>, ok: string) => Promise<void>;

/** One source, its four evidence steps, and the single next action that is allowed. */
function SourceCard({
  source: s,
  busy,
  run,
}: {
  source: CurriculumSourceRow;
  busy: string | null;
  run: Run;
}) {
  const [seen, setSeen] = useState('');
  const [sha, setSha] = useState('');
  const [downloaded, setDownloaded] = useState('');
  const [reviewNote, setReviewNote] = useState('');
  const level = sourceEvidenceLevel(s);
  const steps = sourceEvidenceSteps(s);
  const retrieved =
    level === 'retrieved' || level === 'identity_verified' || level === 'content_reviewed';

  return (
    <li className="flex min-w-0 flex-col gap-3 rounded-card border border-border p-3">
      <div className="min-w-0">
        <p className="break-words text-sm font-semibold text-content-primary">{s.title}</p>
        <p className="break-words text-xs text-content-tertiary">
          {s.publisher} · Licence: {s.licence}
        </p>
        <p className="mt-1 text-xs font-medium text-content-secondary">
          {s.status === 'retired' ? 'Retired' : SOURCE_LEVEL_LABEL[level]}
        </p>
      </div>
      <ol
        className="flex flex-col gap-1 text-xs text-content-secondary"
        aria-label={`Evidence for ${s.title}`}
      >
        {steps.map((step) => (
          <li key={step.key} className="break-words">
            <span aria-hidden="true">{step.done ? '✓ ' : '○ '}</span>
            <span className="font-medium text-content-primary">{step.label}</span>
            <span className="sr-only">{step.done ? ': done' : ': not done'}</span>
            {step.done ? (step.detail ? ` (${step.detail})` : '') : ` · ${step.meaning}`}
          </li>
        ))}
      </ol>
      {s.status !== 'retired' && (
        <div className="flex flex-col gap-3">
          {!s.indexed_on && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <TextField
                containerClassName="min-w-0 flex-1"
                label="Date it was seen at the publisher’s site"
                type="date"
                value={seen}
                onChange={(e) => setSeen(e.target.value)}
              />
              <ButtonSlot>
                <Button
                  type="button"
                  variant="secondary"
                  isLoading={busy === `indexed:${s.id}`}
                  onClick={() =>
                    void run(
                      `indexed:${s.id}`,
                      () =>
                        contentStudioService.recordSourceEvidence({
                          sourceId: s.id,
                          level: 'indexed',
                          on: seen,
                        }),
                      'Recorded as indexed.',
                    )
                  }
                  aria-label={`Record ${s.title} as indexed`}
                >
                  Record as indexed
                </Button>
              </ButtonSlot>
            </div>
          )}
          {!retrieved && (
            <div className="flex flex-col gap-2">
              <TextField
                label="SHA-256 of the downloaded file (64 lowercase hexadecimal characters)"
                value={sha}
                onChange={(e) => setSha(e.target.value.trim())}
              />
              <TextField
                label="Date it was downloaded"
                type="date"
                value={downloaded}
                onChange={(e) => setDownloaded(e.target.value)}
              />
              <ButtonSlot>
                <Button
                  type="button"
                  variant="secondary"
                  isLoading={busy === `retrieved:${s.id}`}
                  onClick={() =>
                    void run(
                      `retrieved:${s.id}`,
                      () =>
                        contentStudioService.recordSourceEvidence({
                          sourceId: s.id,
                          level: 'retrieved',
                          sha256: sha,
                          on: downloaded,
                        }),
                      'Download recorded.',
                    )
                  }
                  aria-label={`Record the download of ${s.title}`}
                >
                  Record the download
                </Button>
              </ButtonSlot>
            </div>
          )}
          {s.status === 'registered' && (
            <ButtonSlot>
              <Button
                type="button"
                variant="secondary"
                disabled={!retrieved}
                isLoading={busy === `verify:${s.id}`}
                onClick={() =>
                  void run(
                    `verify:${s.id}`,
                    () => contentStudioService.verifySource(s.id, ''),
                    'Identity confirmed.',
                  )
                }
                aria-label={`Confirm the identity of ${s.title}`}
              >
                Confirm identity
              </Button>
              {!retrieved && (
                <p className="mt-1 text-xs text-content-tertiary">
                  Identity can only be confirmed once the download is recorded.
                </p>
              )}
            </ButtonSlot>
          )}
          {s.status === 'verified' && !s.content_reviewed_at && (
            <div className="flex flex-col gap-2">
              <TextField
                label="What did you review? (sections and edition)"
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
              />
              <ButtonSlot>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!reviewNote.trim()}
                  isLoading={busy === `content:${s.id}`}
                  onClick={() =>
                    void run(
                      `content:${s.id}`,
                      () =>
                        contentStudioService.recordSourceEvidence({
                          sourceId: s.id,
                          level: 'content_reviewed',
                          note: reviewNote,
                        }),
                      'Document review recorded.',
                    )
                  }
                  aria-label={`Record that you reviewed ${s.title}`}
                >
                  Record document review
                </Button>
              </ButtonSlot>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

/** The register of documents content can be checked against. Only details are stored, never the document itself. */
export function SourcesPanel() {
  const { showToast } = useToast();
  const [rev, setRev] = useState(0);
  const sources = useLoad(() => contentStudioService.listSources(), `sources:${rev}`);
  const [title, setTitle] = useState('');
  const [publisher, setPublisher] = useState('');
  const [docType, setDocType] = useState<CurriculumSourceRow['doc_type']>('caps_policy');
  const [licence, setLicence] = useState('');
  const [url, setUrl] = useState('');
  const [edition, setEdition] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(label: string, action: () => Promise<void>, ok: string) {
    setBusy(label);
    setError(null);
    try {
      await action();
      showToast(ok, { variant: 'success' });
      setRev((r) => r + 1);
    } catch (err) {
      setError(curriculumErrorMessage(err, 'That did not save. Please try again.'));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card title="Sources">
      <p className="text-sm text-content-secondary">
        Register the official documents that content is checked against. Funda360 stores the title,
        publisher and licence only: documents are never copied into the app. A source climbs four
        separate steps, and each needs its own evidence: <strong>indexed</strong> (found at a
        location), <strong>retrieved</strong> (the file was downloaded and hashed),{' '}
        <strong>identity verified</strong> (a person confirmed it is the authoritative file) and{' '}
        <strong>content reviewed</strong> (a person read it). None of them makes any lesson
        verified: that is decided separately, on each lesson.
      </p>
      <ErrorAlert message={sources.error ?? error} />
      {sources.isLoading && !sources.data ? (
        <LoadingBlock label="Loading sources…" />
      ) : (sources.data ?? []).length === 0 ? (
        <p className="text-sm text-content-secondary">No sources registered yet.</p>
      ) : (
        <ul className="flex flex-col gap-2" aria-label="Registered sources">
          {(sources.data ?? []).map((s) => (
            <SourceCard key={s.id} source={s} busy={busy} run={run} />
          ))}
        </ul>
      )}
      <form
        className="flex flex-col gap-3 border-t border-border pt-4"
        onSubmit={(e) => {
          e.preventDefault();
          void run(
            'register',
            async () => {
              await contentStudioService.registerSource({
                title,
                publisher,
                docType,
                licence,
                url,
                edition,
              });
              setTitle('');
              setPublisher('');
              setLicence('');
              setUrl('');
              setEdition('');
            },
            'Source registered.',
          );
        }}
      >
        <h3 className="text-sm font-semibold text-content-primary">Register a source</h3>
        <TextField
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          minLength={3}
          maxLength={300}
        />
        <TextField
          label="Publisher"
          value={publisher}
          onChange={(e) => setPublisher(e.target.value)}
          required
          minLength={2}
          maxLength={200}
        />
        <Field label="Kind of document">
          <select
            className={selectClass}
            value={docType}
            onChange={(e) => setDocType(e.target.value as CurriculumSourceRow['doc_type'])}
          >
            {DOC_TYPES.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </Field>
        <TextField
          label="Licence or permission to use it"
          value={licence}
          onChange={(e) => setLicence(e.target.value)}
          required
        />
        <TextField
          label="Web address (optional, https only)"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <TextField
          label="Edition or year (optional)"
          value={edition}
          onChange={(e) => setEdition(e.target.value)}
        />
        <ButtonSlot>
          <Button type="submit" isLoading={busy === 'register'}>
            Register source
          </Button>
        </ButtonSlot>
      </form>
    </Card>
  );
}
