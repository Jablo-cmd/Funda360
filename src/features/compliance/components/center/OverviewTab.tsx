import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { TextField } from '@/components/ui/TextField';
import { Checkbox } from '@/components/ui/Checkbox';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { ComplianceBadge, ComplianceIcon } from '@/components/ui/complianceIcons';
import { useAuth } from '@/features/auth/context/authContext';
import {
  MetricTile,
  SectionTitle,
  StatusPill,
} from '@/features/compliance/components/ComplianceUi';
import { assessFrameworks, assessSafeguards } from '@/features/compliance/utils/frameworkStatus';
import { generateComplianceReportPdf } from '@/features/compliance/utils/complianceReportPdf';
import { formatDateTime } from '@/features/compliance/utils/formatting';
import { transportContext } from '@/features/compliance/utils/transportContext';
import type { ComplianceOverview } from '@/features/compliance/types/compliance.types';

export function OverviewTab({ overview }: { overview: ComplianceOverview }) {
  const frameworks = assessFrameworks(overview);
  const safeguards = assessSafeguards(overview, transportContext());
  const [reportOpen, setReportOpen] = useState(false);
  const readyCount = frameworks.filter((f) => f.status === 'ready').length;

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-card border border-border bg-white shadow-card dark:bg-surface-raised dark:shadow-card-dark">
        <div className="h-1 bg-accent-500" />
        <div className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-accent-700">
              Data protection status
            </p>
            <h2 className="mt-1 text-2xl font-bold text-brand-700 dark:text-brand-200">
              POPIA + FERPA + GDPR ready
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-content-secondary">
              {readyCount} of {frameworks.length} frameworks have every measurable control in place.
              Every status below is computed live from {overview.school.name}'s records — as of{' '}
              {formatDateTime(overview.generated_at)}.
            </p>
          </div>
          <Button onClick={() => setReportOpen(true)}>Regulator report (PDF)</Button>
        </div>
      </section>

      <section>
        <SectionTitle description="South African POPIA is always on; other frameworks follow the school's settings.">
          Frameworks
        </SectionTitle>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {frameworks.map((f) => (
            <article
              key={f.framework}
              className="rounded-card border border-border bg-surface-raised p-4 shadow-card dark:shadow-card-dark"
            >
              <div className="flex items-start gap-3">
                <ComplianceBadge icon={f.icon} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-lg font-bold text-content-primary">{f.title}</h3>
                    <StatusPill status={f.status} />
                  </div>
                  <p className="text-xs text-content-tertiary">{f.jurisdiction}</p>
                </div>
              </div>
              <ul className="mt-3 space-y-2">
                {f.checks.map((c) => (
                  <li key={c.label} className="text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-content-primary">{c.label}</span>
                      <StatusPill status={c.status} />
                    </div>
                    <p className="text-xs text-content-secondary">{c.detail}</p>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle description="Technical safeguards. “Measured” is read from the live system; “Provider-attested” is guaranteed by the hosting provider.">
          Safeguards
        </SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {safeguards.map((g) => (
            <article
              key={g.key}
              className="flex gap-3 rounded-card border border-border bg-surface-raised p-4"
            >
              <span className="mt-0.5 text-brand-600 dark:text-brand-300">
                <ComplianceIcon icon={g.icon} className="h-7 w-7" />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-content-primary">{g.title}</h3>
                  <StatusPill status={g.status} />
                </div>
                <p className="mt-1 text-sm text-content-secondary">{g.detail}</p>
                <p className="mt-1 text-xs font-medium uppercase tracking-wide text-content-tertiary">
                  {g.evidence === 'measured' ? 'Measured' : 'Provider-attested'}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle>Key figures</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricTile
            label="Open data requests"
            value={overview.dsar.open}
            hint={`${overview.dsar.overdue} overdue`}
            tone={overview.dsar.overdue ? 'alert' : 'neutral'}
          />
          <MetricTile
            label="Open corrections"
            value={overview.amendments.open}
            hint={`${overview.amendments.overdue} overdue · ${overview.amendments.hearings_requested} hearings`}
            tone={overview.amendments.overdue ? 'alert' : 'neutral'}
          />
          <MetricTile
            label={`Under ${overview.settings.coppa_consent_age} with online consent`}
            value={`${overview.learners.under_coppa_with_online_consent}/${overview.learners.under_coppa_age}`}
            hint={`${overview.learners.online_accounts_without_consent} logins without consent`}
            tone={overview.learners.online_accounts_without_consent ? 'alert' : 'neutral'}
          />
          <MetricTile
            label="Flagged content"
            value={overview.content_safety.open_events}
            hint={`${overview.content_safety.events_30d} flags in 30 days`}
            tone={overview.content_safety.open_events ? 'alert' : 'neutral'}
          />
          <MetricTile label="Record accesses (30 days)" value={overview.access_events_30d} />
          <MetricTile label="Audited changes (30 days)" value={overview.audit_events_30d} />
          <MetricTile label="Disclosures (90 days)" value={overview.disclosures_90d} />
          <MetricTile
            label="Privileged accounts with MFA"
            value={`${overview.mfa.privileged_with_mfa}/${overview.mfa.privileged_accounts}`}
          />
        </div>
      </section>

      <RegulatorReportModal
        overview={overview}
        isOpen={reportOpen}
        onClose={() => setReportOpen(false)}
      />
    </div>
  );
}

function RegulatorReportModal({
  overview,
  isOpen,
  onClose,
}: {
  overview: ComplianceOverview;
  isOpen: boolean;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const now = new Date();
  const [period, setPeriod] = useState(
    `${now.getFullYear()} — as at ${now.toLocaleDateString('en-ZA', { dateStyle: 'long' })}`,
  );
  const [preparedBy, setPreparedBy] = useState(
    overview.settings.information_officer_name ?? user?.email ?? '',
  );
  const [attribution, setAttribution] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const doc = await generateComplianceReportPdf(overview, {
        reportingPeriodLabel: period,
        preparedBy,
        includePlatformAttribution: attribution,
        transport: transportContext(),
      });
      const slug = overview.school.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      doc.save(`${slug}-compliance-report-${overview.generated_at.slice(0, 10)}.pdf`);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The report could not be generated.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Regulator compliance report"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => void generate()}
            isLoading={busy}
            disabled={!period.trim() || !preparedBy.trim()}
          >
            Generate PDF
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-content-secondary">
          A white-label report in {overview.school.name}'s name for the Information Regulator, an
          auditor or your governing body. Every status is computed from live records.
        </p>
        <TextField
          label="Reporting period"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
        />
        <TextField
          label="Prepared by"
          value={preparedBy}
          onChange={(e) => setPreparedBy(e.target.value)}
        />
        <Checkbox
          label="Mention Funda360 in the footer"
          checked={attribution}
          onChange={(e) => setAttribution(e.target.checked)}
        />
        <ErrorAlert message={error} />
      </div>
    </Modal>
  );
}
