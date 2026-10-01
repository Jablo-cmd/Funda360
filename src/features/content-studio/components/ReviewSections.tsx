import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { AccessBadges } from '@/features/learning/components/ToolkitPanel';
import { ResourceBody } from '@/features/learning/components/ResourceViewer';
import type {
  ContentSourceReferenceRow,
  ContentValidationFindingRow,
  CurriculumSourceRow,
} from '@/lib/database.types';
import type { ReviewData, UnitContent } from '@/features/content-studio/types';
import {
  describeValidation,
  formatDate,
  effectiveVerification,
  SEVERITY_META,
  VERIFICATION_OPTIONS,
  workflowActions,
} from '@/features/content-studio/utils/studio';
import {
  ActionButtonRow,
  ButtonSlot,
  Field,
  selectClass,
  StatusBadge,
} from '@/features/content-studio/components/StudioBits';

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-3 border-t border-border pt-4 first:border-t-0 first:pt-0">
      <h3 className="text-sm font-semibold text-content-primary">{title}</h3>
      {children}
    </section>
  );
}

function Para({ label, text }: { label: string; text: string | null }) {
  if (!text) return null;
  return (
    <p className="break-words text-sm text-content-primary">
      <span className="font-medium">{label}: </span>
      {text}
    </p>
  );
}

// --- What a reviewer reads ------------------------------------------------------------------

export function ContentSection({ content, ai }: { content: UnitContent; ai: boolean }) {
  if (content.kind === 'teaching_resources') {
    return (
      <Section title="The content">
        {content.resource.summary && (
          <p className="text-sm text-content-secondary">{content.resource.summary}</p>
        )}
        <AccessBadges resource={content.resource} />
        <ResourceBody resource={content.resource} />
      </Section>
    );
  }
  if (content.kind === 'learning_assessments') {
    return (
      <Section title="The content">
        <Para label="Purpose" text={content.assessment.purpose} />
        <ol className="flex flex-col gap-3" aria-label="Questions">
          {content.questions.map((q) => (
            <li
              key={q.id}
              className="rounded-card border border-border p-3 text-sm text-content-primary"
            >
              <p className="break-words font-medium">
                {q.position}. {q.prompt}{' '}
                <span className="text-content-tertiary">
                  ({q.marks} {q.marks === 1 ? 'mark' : 'marks'})
                </span>
              </p>
              {Array.isArray(q.options) && q.options.length > 0 && (
                <p className="mt-1 break-words text-content-secondary">
                  Options: {q.options.map(String).join(' · ')}
                </p>
              )}
              <p className="mt-1 break-words">
                <span className="font-medium">
                  {ai ? 'Answer proposed by the AI (check it): ' : 'Answer: '}
                </span>
                {q.answer ?? 'No answer key'}
              </p>
              {q.feedback && (
                <p className="break-words text-content-secondary">Feedback: {q.feedback}</p>
              )}
            </li>
          ))}
        </ol>
      </Section>
    );
  }
  const { lesson, objectives, activities, resources } = content;
  return (
    <Section title="The content">
      <Para label="Description" text={lesson.description} />
      <Para label="Teacher notes" text={lesson.teacher_notes} />
      <Para label="Learner instructions" text={lesson.learner_instructions} />
      <Para
        label="Time"
        text={lesson.estimated_minutes ? `${lesson.estimated_minutes} minutes` : null}
      />
      <div>
        <p className="text-sm font-medium text-content-primary">Objectives</p>
        <ul className="list-disc pl-5 text-sm text-content-secondary">
          {objectives.map((o) => (
            <li key={o.code} className="break-words">
              {o.code}: {o.description}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <p className="text-sm font-medium text-content-primary">Toolkit resources</p>
        <ul
          className="flex flex-col gap-1 text-sm text-content-secondary"
          aria-label="Toolkit resources"
        >
          {resources.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-2">
              <span className="break-words">
                {r.stage}: {r.title}
              </span>
              <StatusBadge status={r.status} />
            </li>
          ))}
        </ul>
        <p className="mt-1 text-xs text-content-tertiary">
          Each resource is reviewed and published on its own, under the Resources tab.
        </p>
      </div>
      {activities.length > 0 && (
        <div>
          <p className="text-sm font-medium text-content-primary">Activities</p>
          <ul className="flex flex-col gap-1 text-sm text-content-secondary">
            {activities.map((a) => (
              <li key={a.id} className="break-words">
                <span className="font-medium text-content-primary">{a.title}.</span>{' '}
                {a.instructions}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Section>
  );
}

// --- Where it came from -----------------------------------------------------------------------

export function ProvenanceSection({ data }: { data: ReviewData }) {
  const p = data.provenance;
  const v = effectiveVerification(p);
  return (
    <Section title="Where this came from">
      <dl className="grid grid-cols-1 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[10rem_1fr]">
        <dt className="font-medium text-content-primary">Written by</dt>
        <dd className="break-words text-content-secondary">
          {p.origin === 'ai_draft' ? 'AI-assisted draft' : 'People'}
          {p.created_by ? `, saved by ${p.created_by.name}` : ''} on {formatDate(p.created_at)}
        </dd>
        {p.generation && (
          <>
            <dt className="font-medium text-content-primary">AI model</dt>
            <dd className="break-words text-content-secondary">
              {p.generation.model} ({p.generation.provider}), prompt {p.generation.prompt_version}
            </dd>
            <dt className="font-medium text-content-primary">Requested by</dt>
            <dd className="break-words text-content-secondary">
              {p.generation.requested_by ?? 'Unknown'} on {formatDate(p.generation.requested_at)}
            </dd>
            <dt className="font-medium text-content-primary">For objectives</dt>
            <dd className="break-words text-content-secondary">
              {(p.generation.objectives ?? []).map((o) => o.code).join(', ')}
            </dd>
          </>
        )}
        <dt className="font-medium text-content-primary">Checked against sources</dt>
        <dd className="break-words text-content-secondary">{v.label}</dd>
        <dt className="font-medium text-content-primary">Approved by</dt>
        <dd className="break-words text-content-secondary">
          {p.approved_by ? `${p.approved_by} on ${formatDate(p.approved_at)}` : 'Not approved yet'}
        </dd>
        {p.published_at && (
          <>
            <dt className="font-medium text-content-primary">Published</dt>
            <dd className="text-content-secondary">{formatDate(p.published_at)}</dd>
          </>
        )}
      </dl>
      {p.ai_disclosure && (
        <p className="rounded-md bg-surface-sunken px-3 py-2 text-xs text-content-secondary">
          {p.ai_disclosure}
        </p>
      )}
      {p.review_events.length > 0 && (
        <ol
          className="flex flex-col gap-1 text-xs text-content-tertiary"
          aria-label="Review history"
        >
          {p.review_events.map((e, i) => (
            <li key={i} className="break-words">
              {formatDate(e.at)}: {e.from ?? 'new'} → {e.to}
              {e.by ? ` by ${e.by}` : ''}
              {e.note ? ` (${e.note})` : ''}
            </li>
          ))}
        </ol>
      )}
    </Section>
  );
}

// --- Checks ---------------------------------------------------------------------------------------

function FindingRow({
  finding,
  onAcknowledge,
  busy,
}: {
  finding: ContentValidationFindingRow;
  onAcknowledge: (id: string, note: string) => void;
  busy: boolean;
}) {
  const [note, setNote] = useState('');
  const meta = SEVERITY_META[finding.severity];
  return (
    <li className="flex flex-col gap-2 rounded-card border border-border p-3">
      <div className="flex flex-wrap items-start gap-2">
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${meta.classes}`}
        >
          <span aria-hidden="true">{meta.symbol} </span>
          {meta.label}
        </span>
        <p className="min-w-0 flex-1 break-words text-sm text-content-primary">{finding.message}</p>
      </div>
      {finding.path && (
        <p className="break-words text-xs text-content-tertiary">Where: {finding.path}</p>
      )}
      {finding.severity === 'warning' &&
        (finding.acknowledged_at ? (
          <p className="break-words text-xs font-medium text-content-secondary">
            ✓ Acknowledged: {finding.ack_note}
          </p>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <TextField
              containerClassName="min-w-0 flex-1"
              label="Why is this acceptable?"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <ButtonSlot>
              <Button
                type="button"
                variant="secondary"
                disabled={!note.trim()}
                isLoading={busy}
                onClick={() => onAcknowledge(finding.id, note)}
              >
                Acknowledge
              </Button>
            </ButtonSlot>
          </div>
        ))}
    </li>
  );
}

export function ChecksSection({
  data,
  busy,
  onValidate,
  onAcknowledge,
}: {
  data: ReviewData;
  busy: string | null;
  onValidate: () => void;
  onAcknowledge: (id: string, note: string) => void;
}) {
  const sorted = [...data.findings].sort(
    (a, b) => 'error warning info'.indexOf(a.severity) - 'error warning info'.indexOf(b.severity),
  );
  return (
    <Section title="Checks">
      <p className="text-sm text-content-secondary" role="status">
        {describeValidation(data.provenance.validation)}
      </p>
      <ButtonSlot>
        <Button
          type="button"
          variant="secondary"
          isLoading={busy === 'validate'}
          onClick={onValidate}
        >
          Run checks
        </Button>
      </ButtonSlot>
      {sorted.length > 0 && (
        <ul className="flex flex-col gap-2" aria-label="Findings">
          {sorted.map((f) => (
            <FindingRow
              key={f.id}
              finding={f}
              onAcknowledge={onAcknowledge}
              busy={busy === `ack:${f.id}`}
            />
          ))}
        </ul>
      )}
      <p className="text-xs text-content-tertiary">
        Checks only report. They never change the content. Errors must be fixed and the checks run
        again. Warnings need a reviewer to say why they are acceptable.
      </p>
    </Section>
  );
}

// --- Sources and verification ---------------------------------------------------------------------

function ReferenceRow({
  reference,
  source,
  busy,
  onCheck,
}: {
  reference: ContentSourceReferenceRow;
  source: CurriculumSourceRow | undefined;
  busy: boolean;
  onCheck: (id: string, result: 'matches' | 'partial' | 'does_not_match') => void;
}) {
  const [result, setResult] = useState<'matches' | 'partial' | 'does_not_match'>(
    reference.check_result ?? 'matches',
  );
  const label = reference.check_result
    ? {
        matches: '✓ Checked: matches',
        partial: '! Checked: only partly matches',
        does_not_match: '✕ Checked: does not match',
      }[reference.check_result]
    : 'Not checked yet';
  return (
    <li className="flex flex-col gap-2 rounded-card border border-border p-3">
      <p className="break-words text-sm font-medium text-content-primary">
        {source?.title ?? 'Source'}
      </p>
      <p className="break-words text-xs text-content-tertiary">
        {reference.locator}
        {reference.supports ? ` · ${reference.supports}` : ''}
      </p>
      <p className="text-xs font-medium text-content-secondary">{label}</p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <Field label="Your check against the source">
            <select
              className={selectClass}
              value={result}
              onChange={(e) => setResult(e.target.value as typeof result)}
            >
              <option value="matches">It matches</option>
              <option value="partial">It only partly matches</option>
              <option value="does_not_match">It does not match</option>
            </select>
          </Field>
        </div>
        <ButtonSlot>
          <Button
            type="button"
            variant="secondary"
            isLoading={busy}
            onClick={() => onCheck(reference.id, result)}
          >
            Save check
          </Button>
        </ButtonSlot>
      </div>
    </li>
  );
}

export function SourcesSection({
  data,
  busy,
  onAdd,
  onCheck,
}: {
  data: ReviewData;
  busy: string | null;
  onAdd: (sourceId: string, locator: string, supports: string) => void;
  onCheck: (id: string, result: 'matches' | 'partial' | 'does_not_match') => void;
}) {
  const [sourceId, setSourceId] = useState('');
  const [locator, setLocator] = useState('');
  const [supports, setSupports] = useState('');
  const byId = new Map(data.sources.map((s) => [s.id, s]));
  return (
    <Section title="Source references">
      {data.references.length === 0 ? (
        <p className="text-sm text-content-secondary">
          Nothing links this to a source yet. AI-assisted content needs at least one before it can
          be approved.
        </p>
      ) : (
        <ul className="flex flex-col gap-2" aria-label="Source references">
          {data.references.map((r) => (
            <ReferenceRow
              key={r.id}
              reference={r}
              source={byId.get(r.source_id)}
              busy={busy === `check:${r.id}`}
              onCheck={onCheck}
            />
          ))}
        </ul>
      )}
      {data.sources.length === 0 ? (
        <p className="text-sm text-content-secondary">
          Register a source in the Sources section of this page first.
        </p>
      ) : (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            onAdd(sourceId, locator, supports);
            setLocator('');
            setSupports('');
          }}
        >
          <Field label="Source">
            <select
              className={selectClass}
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value)}
              required
            >
              <option value="">Choose a source…</option>
              {data.sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </Field>
          <TextField
            label="Where in the source (page or section)"
            value={locator}
            onChange={(e) => setLocator(e.target.value)}
            required
            minLength={3}
          />
          <TextField
            label="What it supports (optional)"
            value={supports}
            onChange={(e) => setSupports(e.target.value)}
          />
          <ButtonSlot>
            <Button
              type="submit"
              variant="secondary"
              isLoading={busy === 'add'}
              disabled={!sourceId}
            >
              Add reference
            </Button>
          </ButtonSlot>
        </form>
      )}
    </Section>
  );
}

export function VerificationSection({
  data,
  busy,
  onSave,
}: {
  data: ReviewData;
  busy: string | null;
  onSave: (status: (typeof VERIFICATION_OPTIONS)[number]['value'], note: string) => void;
}) {
  const v = effectiveVerification(data.provenance);
  const [status, setStatus] = useState<(typeof VERIFICATION_OPTIONS)[number]['value']>('reviewed');
  const [note, setNote] = useState('');
  return (
    <Section title="Verification">
      <p className="text-sm text-content-primary" role="status">
        Now: {v.label}.
      </p>
      <p className="text-xs text-content-tertiary">
        “Reviewed” means a person other than the requester compared it with its sources. “Verified”
        also needs every reference to match a verified source. Changing the content afterwards
        resets this.
      </p>
      <Field label="Verification level">
        <select
          className={selectClass}
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
        >
          {VERIFICATION_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>
      <TextField label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
      <ButtonSlot>
        <Button
          type="button"
          variant="secondary"
          isLoading={busy === 'verify'}
          onClick={() => onSave(status, note)}
        >
          Save verification
        </Button>
      </ButtonSlot>
    </Section>
  );
}

export function WorkflowSection({
  status,
  busy,
  onMove,
}: {
  status: ReviewData['provenance']['status'];
  busy: string | null;
  onMove: (to: ReviewData['provenance']['status'], note: string) => void;
}) {
  const [note, setNote] = useState('');
  const actions = workflowActions(status);
  return (
    <Section title="Next step">
      {actions.length === 0 ? (
        <p className="text-sm text-content-secondary">
          This has been retired. Create a new version to change it.
        </p>
      ) : (
        <>
          <TextField
            label="Note for the record (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <ActionButtonRow>
            {actions.map((a) => (
              <ButtonSlot key={a.to}>
                <Button
                  type="button"
                  variant={a.primary ? 'primary' : 'secondary'}
                  isLoading={busy === `move:${a.to}`}
                  onClick={() => onMove(a.to, note)}
                >
                  {a.label}
                </Button>
              </ButtonSlot>
            ))}
          </ActionButtonRow>
          <p className="text-xs text-content-tertiary">
            The database decides whether a step is allowed. If something is missing it will say
            what.
          </p>
        </>
      )}
    </Section>
  );
}
