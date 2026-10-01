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
import { curriculumReviewService } from '@/features/content-studio/services/curriculumReviewService';
import { LadderExplainer } from '@/features/content-studio/components/review/LadderExplainer';
import type { CurriculumSourceRow } from '@/lib/database.types';
import {
  SOURCE_LEVEL_LABEL,
  sourceEvidenceLevel,
  sourceEvidenceSteps,
} from '@/features/content-studio/utils/studio';
import { LICENCE_LABEL, looksLikeRecordLine, parseAlternateUrls } from '@/features/content-studio/utils/review';
import { ButtonSlot, Field, selectClass, textareaClass } from '@/features/content-studio/components/StudioBits';

const DOC_TYPES: Array<{ value: CurriculumSourceRow['doc_type']; label: string }> = [
  { value: 'caps_policy', label: 'Curriculum policy statement' },
  { value: 'annual_teaching_plan', label: 'Annual teaching plan' },
  { value: 'assessment_guideline', label: 'Assessment guideline' },
  { value: 'textbook', label: 'Textbook' },
  { value: 'other', label: 'Other' },
];

type Run = (label: string, action: () => Promise<void>, ok: string) => Promise<void>;

function Fact({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-content-tertiary">{label}</dt>
      <dd className="break-all text-sm text-content-primary">{value || 'Not recorded'}</dd>
    </div>
  );
}

/** One source, its evidence steps, what has been recorded, and the actions that are allowed next. */
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
  const [record, setRecord] = useState('');
  const [identityDecision, setIdentityDecision] = useState('verified');
  const [identityNotes, setIdentityNotes] = useState('');
  const [docDecision, setDocDecision] = useState('reviewed');
  const [docNotes, setDocNotes] = useState('');
  const [docFindings, setDocFindings] = useState('');
  const [licDecision, setLicDecision] = useState('permitted');
  const [licNotes, setLicNotes] = useState('');
  const [reason, setReason] = useState('');
  const level = sourceEvidenceLevel(s);
  const steps = sourceEvidenceSteps(s);
  const retrieved = Boolean(s.checksum_sha256);

  return (
    <li className="flex min-w-0 flex-col gap-3 rounded-card border border-border p-3">
      <div className="min-w-0">
        <p className="break-words text-sm font-semibold text-content-primary">{s.title}</p>
        <p className="break-words text-xs text-content-tertiary">
          {s.publisher}
          {s.jurisdiction ? ` · ${s.jurisdiction}` : ''}
          {s.subject ? ` · ${s.subject}` : ''}
          {s.grade_phase ? ` · ${s.grade_phase}` : ''} · Licence: {s.licence}
        </p>
        <p className="mt-1 text-xs font-medium text-content-secondary">
          {s.status === 'retired' ? 'Retired' : SOURCE_LEVEL_LABEL[level]} · {LICENCE_LABEL[s.licence_status]}
        </p>
      </div>
      <ol className="flex flex-col gap-1 text-xs text-content-secondary" aria-label={`Evidence for ${s.title}`}>
        {steps.map((step) => (
          <li key={step.key} className="break-words">
            <span aria-hidden="true">{step.done ? '✓ ' : '○ '}</span>
            <span className="font-medium text-content-primary">{step.label}</span>
            <span className="sr-only">{step.done ? ': done' : ': not done'}</span>
            {step.done ? (step.detail ? ` (${step.detail})` : '') : ` · ${step.meaning}`}
          </li>
        ))}
        <li className="break-words">
          <span aria-hidden="true">○ </span>
          <span className="font-medium text-content-primary">Curriculum verified</span>
          <span className="sr-only">: decided per unit, not on the source</span>
          {' · A specific Funda360 curriculum unit was checked against the source. Decided on each unit, never here.'}
        </li>
      </ol>
      <details className="text-sm">
        <summary className="focus-ring cursor-pointer font-medium text-content-primary">What is recorded</summary>
        <dl className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Fact label="Canonical address" value={s.url} />
          <Fact label="Other addresses" value={s.alternate_urls.join(' ')} />
          <Fact label="Edition or year" value={s.edition} />
          <Fact label="ISBN" value={s.isbn} />
          <Fact label="Retrieval status" value={s.retrieval_status.replace(/_/g, ' ')} />
          <Fact label="Retrieved on" value={s.retrieved_on} />
          <Fact label="SHA-256" value={s.checksum_sha256} />
          <Fact label="Size" value={s.retrieval_size_bytes ? `${s.retrieval_size_bytes} bytes` : null} />
          <Fact label="Content type" value={s.retrieval_content_type} />
          <Fact label="Final address" value={s.retrieval_final_url} />
          <Fact label="Redirects" value={s.retrieval_redirects === null ? null : String(s.retrieval_redirects)} />
          <Fact label="Document review" value={s.content_review_note} />
          <Fact label="Licence note" value={s.licence_review_note} />
        </dl>
      </details>
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
                      () => contentStudioService.recordSourceEvidence({ sourceId: s.id, on: seen }),
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
              <Field label="Paste the RECORD line printed by verify-dbe-sources.sh">
                <textarea
                  className={textareaClass}
                  value={record}
                  onChange={(e) => setRecord(e.target.value)}
                  spellCheck={false}
                />
              </Field>
              <p className="text-xs text-content-tertiary">
                Run <code>docs/sources/verify-dbe-sources.sh</code> on a machine that can reach the
                publisher, then paste the line that starts with RECORD. Funda360 reads the checksum,
                size and address from it, checks the address is one registered for this source, and
                dates it itself. A checksum cannot be typed in by hand.
              </p>
              <ButtonSlot>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!looksLikeRecordLine(record)}
                  isLoading={busy === `retrieved:${s.id}`}
                  onClick={() =>
                    void run(
                      `retrieved:${s.id}`,
                      () => curriculumReviewService.recordRetrieval(s.id, record.trim()),
                      'Retrieval recorded.',
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
            <fieldset className="flex flex-col gap-2 rounded-card border border-border p-3">
              <legend className="px-1 text-sm font-medium text-content-primary">Identity review</legend>
              <Field label="Identity decision">
                <select className={selectClass} value={identityDecision} onChange={(e) => setIdentityDecision(e.target.value)}>
                  <option value="verified">Verified: this is the intended authoritative edition</option>
                  <option value="not_verified">Not verified</option>
                  <option value="needs_information">Needs more information</option>
                </select>
              </Field>
              <Field label="Identity review notes (required)">
                <textarea className={textareaClass} value={identityNotes} onChange={(e) => setIdentityNotes(e.target.value)} />
              </Field>
              <ButtonSlot>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={identityNotes.trim().length < 3 || (identityDecision === 'verified' && !retrieved)}
                  isLoading={busy === `identity:${s.id}`}
                  onClick={() =>
                    void run(
                      `identity:${s.id}`,
                      () => curriculumReviewService.recordSourceReview({ sourceId: s.id, kind: 'identity', decision: identityDecision, notes: identityNotes }),
                      'Identity decision recorded.',
                    )
                  }
                  aria-label={`Record the identity decision for ${s.title}`}
                >
                  Record identity decision
                </Button>
                {!retrieved && identityDecision === 'verified' && (
                  <p className="mt-1 text-xs text-content-tertiary">
                    Identity can only be confirmed once the download is recorded.
                  </p>
                )}
              </ButtonSlot>
            </fieldset>
          )}
          {s.status === 'verified' && !s.content_reviewed_at && (
            <fieldset className="flex flex-col gap-2 rounded-card border border-border p-3">
              <legend className="px-1 text-sm font-medium text-content-primary">Document review</legend>
              <Field label="Document review decision">
                <select className={selectClass} value={docDecision} onChange={(e) => setDocDecision(e.target.value)}>
                  <option value="reviewed">Reviewed: I read the document</option>
                  <option value="issues_found">Issues found</option>
                </select>
              </Field>
              <Field label="What did you review? (sections and edition)">
                <textarea className={textareaClass} value={docNotes} onChange={(e) => setDocNotes(e.target.value)} />
              </Field>
              {docDecision === 'issues_found' && (
                <Field label="Findings">
                  <textarea className={textareaClass} value={docFindings} onChange={(e) => setDocFindings(e.target.value)} />
                </Field>
              )}
              <ButtonSlot>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={docNotes.trim().length < 3 || (docDecision === 'issues_found' && !docFindings.trim())}
                  isLoading={busy === `content:${s.id}`}
                  onClick={() =>
                    void run(
                      `content:${s.id}`,
                      () => curriculumReviewService.recordSourceReview({ sourceId: s.id, kind: 'document', decision: docDecision, notes: docNotes, findings: docFindings }),
                      'Document review recorded.',
                    )
                  }
                  aria-label={`Record the document review of ${s.title}`}
                >
                  Record document review
                </Button>
              </ButtonSlot>
            </fieldset>
          )}
          <fieldset className="flex flex-col gap-2 rounded-card border border-border p-3">
            <legend className="px-1 text-sm font-medium text-content-primary">Licence review</legend>
            <Field label="Licence decision">
              <select className={selectClass} value={licDecision} onChange={(e) => setLicDecision(e.target.value)}>
                <option value="permitted">Permitted</option>
                <option value="restricted">Restricted use (say how in the notes)</option>
                <option value="not_permitted">Not permitted</option>
              </select>
            </Field>
            <Field label="Licence review notes (required)">
              <textarea className={textareaClass} value={licNotes} onChange={(e) => setLicNotes(e.target.value)} />
            </Field>
            <ButtonSlot>
              <Button
                type="button"
                variant="secondary"
                disabled={licNotes.trim().length < 3}
                isLoading={busy === `licence:${s.id}`}
                onClick={() =>
                  void run(
                    `licence:${s.id}`,
                    () => curriculumReviewService.recordSourceReview({ sourceId: s.id, kind: 'licence', decision: licDecision, notes: licNotes }),
                    'Licence decision recorded.',
                  )
                }
                aria-label={`Record the licence decision for ${s.title}`}
              >
                Record licence decision
              </Button>
            </ButtonSlot>
          </fieldset>
          {retrieved && (
            <details className="rounded-card border border-border p-3 text-sm">
              <summary className="focus-ring cursor-pointer font-medium text-content-primary">Correct recorded evidence</summary>
              <div className="mt-2 flex flex-col gap-2">
                <p className="text-xs text-content-secondary">
                  If the wrong file was hashed, correct it here. This clears the retrieval, the
                  identity decision and the document review, so each must be done again for the
                  right file. The old values stay in the history and the audit log.
                </p>
                <Field label="Reason for the correction (at least 10 characters)">
                  <textarea className={textareaClass} value={reason} onChange={(e) => setReason(e.target.value)} />
                </Field>
                <ButtonSlot>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={reason.trim().length < 10}
                    isLoading={busy === `correct:${s.id}`}
                    onClick={() =>
                      void run(
                        `correct:${s.id}`,
                        () => curriculumReviewService.correctEvidence(s.id, reason),
                        'Evidence cleared. Redo the later steps.',
                      )
                    }
                    aria-label={`Correct the recorded evidence of ${s.title}`}
                  >
                    Correct recorded evidence
                  </Button>
                </ButtonSlot>
              </div>
            </details>
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
  const [form, setForm] = useState({
    title: '', publisher: '', licence: '', url: '', edition: '', jurisdiction: '', subject: '', gradePhase: '', alternates: '', isbn: '', note: '',
  });
  const [docType, setDocType] = useState<CurriculumSourceRow['doc_type']>('caps_policy');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const alternates = parseAlternateUrls(form.alternates);

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
        Register the official documents that content is checked against. Funda360 stores
        descriptions and evidence only: documents are never copied into the app. A source climbs
        separate steps, each with its own evidence, and none of them makes any lesson verified.
      </p>
      <LadderExplainer />
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
                title: form.title,
                publisher: form.publisher,
                docType,
                licence: form.licence,
                url: form.url,
                edition: form.edition,
                jurisdiction: form.jurisdiction,
                subject: form.subject,
                gradePhase: form.gradePhase,
                alternateUrls: alternates.urls,
                isbn: form.isbn,
                note: form.note,
              });
              setForm({ title: '', publisher: '', licence: '', url: '', edition: '', jurisdiction: '', subject: '', gradePhase: '', alternates: '', isbn: '', note: '' });
            },
            'Source registered.',
          );
        }}
      >
        <h3 className="text-sm font-semibold text-content-primary">Register a source</h3>
        <TextField label="Title" value={form.title} onChange={(e) => set('title')(e.target.value)} required minLength={3} maxLength={300} />
        <TextField label="Publisher" value={form.publisher} onChange={(e) => set('publisher')(e.target.value)} required minLength={2} maxLength={200} />
        <Field label="Kind of document">
          <select className={selectClass} value={docType} onChange={(e) => setDocType(e.target.value as CurriculumSourceRow['doc_type'])}>
            {DOC_TYPES.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </Field>
        <TextField label="Jurisdiction (optional)" value={form.jurisdiction} onChange={(e) => set('jurisdiction')(e.target.value)} />
        <TextField label="Subject (optional)" value={form.subject} onChange={(e) => set('subject')(e.target.value)} />
        <TextField label="Grade or phase (optional)" value={form.gradePhase} onChange={(e) => set('gradePhase')(e.target.value)} />
        <TextField label="Canonical web address (optional, https only)" type="url" value={form.url} onChange={(e) => set('url')(e.target.value)} />
        <Field label="Other web addresses (optional, one per line, https only)">
          <textarea className={textareaClass} value={form.alternates} onChange={(e) => set('alternates')(e.target.value)} />
        </Field>
        {alternates.bad.length > 0 && (
          <p role="alert" className="text-xs text-danger-600">
            These addresses must start with https://: {alternates.bad.join(', ')}
          </p>
        )}
        <TextField label="Edition or year (optional)" value={form.edition} onChange={(e) => set('edition')(e.target.value)} />
        <TextField label="ISBN (optional)" value={form.isbn} onChange={(e) => set('isbn')(e.target.value)} />
        <TextField label="Licence or permission to use it" value={form.licence} onChange={(e) => set('licence')(e.target.value)} required />
        <Field label="Notes (optional)">
          <textarea className={textareaClass} value={form.note} onChange={(e) => set('note')(e.target.value)} />
        </Field>
        <ButtonSlot>
          <Button type="submit" isLoading={busy === 'register'} disabled={alternates.bad.length > 0}>
            Register source
          </Button>
        </ButtonSlot>
      </form>
    </Card>
  );
}
