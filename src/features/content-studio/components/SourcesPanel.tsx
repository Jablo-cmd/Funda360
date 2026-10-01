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
import { ButtonSlot, Field, selectClass } from '@/features/content-studio/components/StudioBits';

const DOC_TYPES: Array<{ value: CurriculumSourceRow['doc_type']; label: string }> = [
  { value: 'caps_policy', label: 'Curriculum policy statement' },
  { value: 'annual_teaching_plan', label: 'Annual teaching plan' },
  { value: 'assessment_guideline', label: 'Assessment guideline' },
  { value: 'textbook', label: 'Textbook' },
  { value: 'other', label: 'Other' },
];

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
        publisher and licence only: documents are never copied into the app. Marking a source
        “verified” says the document is the authoritative edition. It does not make any lesson
        verified.
      </p>
      <ErrorAlert message={sources.error ?? error} />
      {sources.isLoading && !sources.data ? (
        <LoadingBlock label="Loading sources…" />
      ) : (sources.data ?? []).length === 0 ? (
        <p className="text-sm text-content-secondary">No sources registered yet.</p>
      ) : (
        <ul className="flex flex-col gap-2" aria-label="Registered sources">
          {(sources.data ?? []).map((s) => (
            <li
              key={s.id}
              className="flex flex-col gap-2 rounded-card border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="break-words text-sm font-semibold text-content-primary">{s.title}</p>
                <p className="break-words text-xs text-content-tertiary">
                  {s.publisher} · Licence: {s.licence}
                </p>
                <p className="mt-1 text-xs font-medium text-content-secondary">
                  {s.status === 'verified'
                    ? '✓ Verified as the authoritative edition'
                    : s.status === 'retired'
                      ? 'Retired'
                      : 'Registered, not yet verified'}
                </p>
              </div>
              {s.status === 'registered' && (
                <ButtonSlot>
                  <Button
                    type="button"
                    variant="secondary"
                    isLoading={busy === `verify:${s.id}`}
                    onClick={() =>
                      void run(
                        `verify:${s.id}`,
                        () => contentStudioService.verifySource(s.id, ''),
                        'Source verified.',
                      )
                    }
                    aria-label={`Mark ${s.title} as verified`}
                  >
                    Mark as verified
                  </Button>
                </ButtonSlot>
              )}
            </li>
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
