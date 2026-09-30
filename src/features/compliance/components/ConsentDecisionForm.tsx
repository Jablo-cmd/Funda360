import { useId, useMemo, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { Checkbox } from '@/components/ui/Checkbox';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { ConsentWorkflowIcon } from '@/components/ui/complianceIcons';
import { getDbErrorMessage } from '@/lib/dbErrors';
import { cn } from '@/lib/cn';
import type { ConsentDecision, ConsentPurpose } from '@/lib/database.types';
import { CONSENT_PURPOSES } from '@/features/compliance/constants/consentPurposes';
import { recordConsent } from '@/features/compliance/services/complianceService';
import type { PrivacyChild } from '@/features/compliance/types/compliance.types';

export interface ConsentDecisionFormProps {
  child: PrivacyChild;
  privacyNoticeVersion: string;
  /** Purposes that must be decided before the form can be submitted (onboarding). */
  required: ConsentPurpose[];
  /** Which purposes to show; defaults to all. */
  purposes?: ConsentPurpose[];
  submitLabel?: string;
  onSaved: () => void;
}

type Choice = 'granted' | 'refused';

/**
 * Verifiable parental consent, with no hidden defaults: every choice starts
 * unselected, refusing is exactly as easy as granting, each purpose shows
 * what refusing means before the choice is made, and a grant needs the
 * guardian's typed full name plus an explicit declaration. A purpose that is
 * currently granted can be withdrawn here too. Decisions are written through
 * record_parental_consent(), which appends to the consent ledger and audits.
 */
export function ConsentDecisionForm({
  child,
  privacyNoticeVersion,
  required,
  purposes,
  submitLabel = 'Save my decisions',
  onSaved,
}: ConsentDecisionFormProps) {
  const formId = useId();
  const shown = useMemo(
    () =>
      CONSENT_PURPOSES.filter((p) => (purposes ? purposes.includes(p.purpose) : true)).filter(
        // The online-account question only matters for children, and only once asked.
        (p) =>
          p.purpose !== 'online_learner_account' ||
          child.under_coppa_age ||
          child.has_online_account ||
          child.consents.online_learner_account != null,
      ),
    [purposes, child],
  );
  const [choices, setChoices] = useState<Partial<Record<ConsentPurpose, Choice | 'withdraw'>>>({});
  const [attestedName, setAttestedName] = useState('');
  const [declared, setDeclared] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const missing = required.filter((p) => child.consents[p] == null && !choices[p]);
  const pending = Object.entries(choices).filter(([, v]) => v) as Array<
    [ConsentPurpose, Choice | 'withdraw']
  >;
  const grants = pending.some(([, v]) => v === 'granted');
  const canSubmit =
    pending.length > 0 &&
    missing.length === 0 &&
    (!grants || (attestedName.trim().length >= 3 && declared));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setIsSaving(true);
    setError(null);
    try {
      for (const [purpose, choice] of pending) {
        const decision: ConsentDecision = choice === 'withdraw' ? 'withdrawn' : choice;
        await recordConsent({
          learnerId: child.learner_id,
          purpose,
          decision,
          attestedName: attestedName.trim(),
        });
      }
      setChoices({});
      setDeclared(false);
      onSaved();
    } catch (err) {
      setError(getDbErrorMessage(err, 'Your consent decision could not be saved.'));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className="space-y-4"
      aria-labelledby={`${formId}-title`}
    >
      <p id={`${formId}-title`} className="sr-only">
        Consent decisions for {child.name}
      </p>
      <ul className="space-y-3">
        {shown.map((info) => {
          const current = child.consents[info.purpose] ?? null;
          const choice = choices[info.purpose];
          const isRequired = required.includes(info.purpose) && current == null;
          const groupName = `${formId}-${info.purpose}`;
          return (
            <li
              key={info.purpose}
              className="rounded-card border border-border bg-surface-raised p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-content-primary">
                    {info.title}
                    {isRequired && (
                      <span className="ml-2 text-xs font-semibold uppercase text-accent-700">
                        Decision required
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-sm text-content-secondary">{info.description}</p>
                  <p className="mt-1 text-sm text-content-secondary">
                    <span className="font-medium text-content-primary">If you refuse: </span>
                    {info.ifRefused}
                  </p>
                  <p className="mt-1 text-xs text-content-tertiary">{info.frameworks}</p>
                </div>
                <CurrentDecision decision={current} />
              </div>
              <fieldset className="mt-3">
                <legend className="sr-only">{info.title} decision</legend>
                <div className="flex flex-wrap gap-2">
                  {current !== 'granted' && (
                    <ChoiceButton
                      name={groupName}
                      label="I consent"
                      checked={choice === 'granted'}
                      onSelect={() => setChoices((c) => ({ ...c, [info.purpose]: 'granted' }))}
                    />
                  )}
                  {current !== 'granted' && current !== 'refused' && (
                    <ChoiceButton
                      name={groupName}
                      label="I do not consent"
                      checked={choice === 'refused'}
                      onSelect={() => setChoices((c) => ({ ...c, [info.purpose]: 'refused' }))}
                    />
                  )}
                  {current === 'granted' && (
                    <ChoiceButton
                      name={groupName}
                      label="Withdraw consent"
                      checked={choice === 'withdraw'}
                      onSelect={() => setChoices((c) => ({ ...c, [info.purpose]: 'withdraw' }))}
                    />
                  )}
                  {choice && (
                    <button
                      type="button"
                      className="focus-ring rounded-md px-3 py-2 text-sm text-content-secondary underline-offset-2 hover:underline"
                      onClick={() => setChoices((c) => ({ ...c, [info.purpose]: undefined }))}
                    >
                      Clear
                    </button>
                  )}
                </div>
              </fieldset>
            </li>
          );
        })}
      </ul>

      {grants && (
        <div className="space-y-3 rounded-card border border-accent-500/60 bg-accent-50 p-4 dark:bg-accent-50/40">
          <div className="flex items-center gap-2 text-sm font-semibold text-content-primary">
            <ConsentWorkflowIcon className="h-5 w-5 text-brand-600" />
            Sign your consent
          </div>
          <TextField
            label="Your full name (typed signature)"
            value={attestedName}
            onChange={(e) => setAttestedName(e.target.value)}
            autoComplete="name"
            required
          />
          <Checkbox
            label={`I am ${child.name}'s parent or legal guardian, I have read the school's privacy notice (version ${privacyNoticeVersion}), and I understand I can withdraw consent at any time.`}
            checked={declared}
            onChange={(e) => setDeclared(e.target.checked)}
          />
        </div>
      )}

      {missing.length > 0 && (
        <p className="text-sm text-content-secondary">
          Please make a choice for every item marked “Decision required”.
        </p>
      )}
      <ErrorAlert message={error} />
      <Button type="submit" disabled={!canSubmit} isLoading={isSaving}>
        {submitLabel}
      </Button>
    </form>
  );
}

function ChoiceButton({
  name,
  label,
  checked,
  onSelect,
}: {
  name: string;
  label: string;
  checked: boolean;
  onSelect: () => void;
}) {
  return (
    <label
      className={cn(
        'flex min-h-[44px] cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium focus-within:ring-2 focus-within:ring-brand-500',
        checked
          ? 'border-brand-600 bg-brand-600 text-white'
          : 'border-border-strong bg-surface text-content-primary hover:border-brand-400',
      )}
    >
      <input type="radio" name={name} className="sr-only" checked={checked} onChange={onSelect} />
      {label}
    </label>
  );
}

function CurrentDecision({ decision }: { decision: ConsentDecision | null }) {
  const label =
    decision === 'granted'
      ? 'Consent given'
      : decision === 'refused'
        ? 'Refused'
        : decision === 'withdrawn'
          ? 'Withdrawn'
          : 'Not yet decided';
  const tone =
    decision === 'granted'
      ? 'border-success-500/40 bg-success-500/10 text-green-800 dark:text-green-300'
      : decision == null
        ? 'border-accent-500/50 bg-accent-50 text-accent-700'
        : 'border-border bg-surface text-content-secondary';
  return (
    <span className={cn('shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold', tone)}>
      {label}
    </span>
  );
}
