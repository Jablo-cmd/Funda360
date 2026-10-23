import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { PageContainer } from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { LoadingBlock } from '@/components/ui/LoadingBlock';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { Checkbox } from '@/components/ui/Checkbox';
import { DataTable } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/toast/useToast';
import { getDbErrorMessage } from '@/lib/dbErrors';
import type { EducationAreaRow, GovernmentApiPermission } from '@/lib/database.types';
import {
  governmentReportService,
  type SchoolAreaLink,
} from '@/features/government/services/governmentReportService';
import type {
  GovernmentApiClientSummary,
  GovernmentImportJob,
} from '@/features/government/types/government.types';

const FIELD_CLASS =
  'focus-ring h-11 w-full rounded-md border border-border-strong bg-surface-raised px-3 text-sm text-content-primary lg:h-10';
const LABEL_CLASS = 'mb-1.5 block text-xs font-medium text-content-tertiary';

const API_PERMISSIONS: { value: GovernmentApiPermission; label: string }[] = [
  { value: 'schools', label: 'Schools (directory)' },
  { value: 'reports', label: 'Reports (summary, school indicators, province)' },
  { value: 'attendance', label: 'Attendance aggregates' },
  { value: 'assessments', label: 'Assessment aggregates' },
  { value: 'staff', label: 'Staff and educator counts' },
  { value: 'interventions', label: 'Intervention status and dates' },
  { value: 'data_quality', label: 'Data quality' },
  { value: 'learners', label: 'Learner enrolments (needs learner-level grant)' },
  { value: 'imports', label: 'Imports (school EMIS numbers, reviewed here)' },
];

const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleString('en-ZA') : '—';

/**
 * Platform administration of the Government Data & Integration API: API
 * clients (scope, permissions, expiry, rate limit; the token is shown once)
 * and the review step for imports. Every action is a platform-admin RPC
 * that requires MFA and writes to the audit log.
 */
export function GovernmentIntegrationsPage() {
  const id = useId();
  const { showToast } = useToast();
  const [clients, setClients] = useState<GovernmentApiClientSummary[]>([]);
  const [jobs, setJobs] = useState<GovernmentImportJob[]>([]);
  const [areas, setAreas] = useState<EducationAreaRow[]>([]);
  const [schools, setSchools] = useState<SchoolAreaLink[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState<{ name: string; token: string } | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<GovernmentApiClientSummary | null>(null);
  const [reviewing, setReviewing] = useState<{
    job: GovernmentImportJob;
    decision: 'commit' | 'reject';
  } | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');

  const [form, setForm] = useState({
    name: '',
    description: '',
    scope: '',
    permissions: ['schools', 'reports'] as GovernmentApiPermission[],
    learnerDetail: false,
    rateLimit: '60',
    expiresOn: '',
  });

  const load = useCallback(async () => {
    try {
      const [c, j, a, s] = await Promise.all([
        governmentReportService.listApiClients(),
        governmentReportService.listImportJobs(),
        governmentReportService.listAreas(),
        governmentReportService.listSchoolAreaLinks(),
      ]);
      setClients(c);
      setJobs(j);
      setAreas(a);
      setSchools(s);
      setError(null);
    } catch (err) {
      setError(getDbErrorMessage(err, 'Could not load integrations.'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const scopeOptions = useMemo(
    () => [
      ...areas
        .slice()
        .sort((a, b) => a.level.localeCompare(b.level) || a.name.localeCompare(b.name))
        .map((a) => ({
          value: `area:${a.id}`,
          label: `${a.level[0]!.toUpperCase()}${a.level.slice(1)}: ${a.name}`,
        })),
      ...schools.map((s) => ({ value: `school:${s.id}`, label: `School: ${s.name}` })),
    ],
    [areas, schools],
  );
  const schoolName = (schoolId: string) => schools.find((s) => s.id === schoolId)?.name ?? schoolId;

  const togglePermission = (permission: GovernmentApiPermission, checked: boolean) =>
    setForm((f) => ({
      ...f,
      permissions: checked
        ? [...f.permissions, permission]
        : f.permissions.filter((p) => p !== permission),
      learnerDetail: permission === 'learners' && !checked ? false : f.learnerDetail,
    }));

  const submitClient = async (event: FormEvent) => {
    event.preventDefault();
    const [kind, scopeId] = form.scope.split(':');
    setBusy(true);
    try {
      const result = await governmentReportService.createApiClient({
        name: form.name.trim(),
        description: form.description.trim() || null,
        areaId: kind === 'area' ? scopeId! : null,
        schoolId: kind === 'school' ? scopeId! : null,
        permissions: form.permissions,
        learnerDetail: form.learnerDetail,
        rateLimitPerMinute: Number(form.rateLimit),
        expiresAt: form.expiresOn ? new Date(`${form.expiresOn}T23:59:59`).toISOString() : null,
      });
      setIssued({ name: form.name.trim(), token: result.token });
      setForm((f) => ({ ...f, name: '', description: '', learnerDetail: false }));
      await load();
    } catch (err) {
      showToast(getDbErrorMessage(err, 'The API client was not created.'), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const revoke = async () => {
    if (!confirmRevoke) return;
    setBusy(true);
    try {
      await governmentReportService.revokeApiClient(confirmRevoke.id);
      showToast('API client revoked. Its token stops working immediately.', { variant: 'success' });
      setConfirmRevoke(null);
      await load();
    } catch (err) {
      showToast(getDbErrorMessage(err, 'The client was not revoked.'), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const review = async () => {
    if (!reviewing) return;
    setBusy(true);
    try {
      await governmentReportService.reviewImportJob(
        reviewing.job.id,
        reviewing.decision,
        reviewNotes.trim() || null,
      );
      showToast(reviewing.decision === 'commit' ? 'Import committed.' : 'Import rejected.', {
        variant: 'success',
      });
      setReviewing(null);
      setReviewNotes('');
      await load();
    } catch (err) {
      showToast(getDbErrorMessage(err, 'The import was not reviewed.'), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) {
    return (
      <PageContainer>
        <LoadingBlock label="Loading integrations…" />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Government integrations"
        description="API clients for the Government Data & Integration API and the review step for imports. This is an integration-ready interface, not a connection to any department system."
      />
      <ErrorAlert message={error} />

      <Card title="API clients">
        <form onSubmit={(e) => void submitClient(e)} className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <TextField
              label="Client name"
              required
              maxLength={120}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <TextField
              label="Description (optional)"
              maxLength={500}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <div>
              <label htmlFor={`${id}-scope`} className={LABEL_CLASS}>
                Scope
              </label>
              <select
                id={`${id}-scope`}
                className={FIELD_CLASS}
                required
                value={form.scope}
                onChange={(e) => setForm({ ...form, scope: e.target.value })}
              >
                <option value="">Choose an area or school…</option>
                {scopeOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <TextField
              label="Requests per minute"
              type="number"
              min={1}
              max={600}
              required
              value={form.rateLimit}
              onChange={(e) => setForm({ ...form, rateLimit: e.target.value })}
            />
            <TextField
              label="Expires on (optional)"
              type="date"
              value={form.expiresOn}
              onChange={(e) => setForm({ ...form, expiresOn: e.target.value })}
            />
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className={LABEL_CLASS}>Permissions</legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {API_PERMISSIONS.map((p) => (
                <Checkbox
                  key={p.value}
                  label={p.label}
                  checked={form.permissions.includes(p.value)}
                  onChange={(e) => togglePermission(p.value, e.target.checked)}
                />
              ))}
            </div>
            <Checkbox
              label="Allow learner-level detail (enrolments and intervention learner ids)"
              checked={form.learnerDetail}
              disabled={!form.permissions.includes('learners')}
              onChange={(e) => setForm({ ...form, learnerDetail: e.target.checked })}
            />
          </fieldset>
          <div>
            <Button
              type="submit"
              className="w-full sm:w-auto"
              isLoading={busy}
              disabled={!form.name.trim() || !form.scope || form.permissions.length === 0}
            >
              Create API client
            </Button>
          </div>
        </form>

        <DataTable
          columns={[
            {
              key: 'name',
              header: 'Client',
              render: (c) => (
                <div className="min-w-0">
                  <p className="font-medium text-content-primary">{c.name}</p>
                  <p className="text-xs text-content-tertiary">
                    {c.scope_level}: {c.scope_name ?? '—'} · token f360g_{c.token_prefix}_…
                  </p>
                </div>
              ),
            },
            {
              key: 'permissions',
              header: 'Permissions',
              render: (c) => (
                <span className="text-xs">
                  {c.permissions.join(', ')}
                  {c.learner_detail ? ' (learner detail)' : ''}
                </span>
              ),
            },
            {
              key: 'limit',
              header: 'Per minute',
              align: 'right',
              render: (c) => c.rate_limit_per_minute,
            },
            {
              key: 'usage',
              header: 'Last 24 h',
              align: 'right',
              render: (c) => `${c.requests_24h} (${c.errors_24h} errors)`,
            },
            { key: 'last', header: 'Last used', render: (c) => formatDate(c.last_used_at) },
            {
              key: 'status',
              header: 'Status',
              render: (c) =>
                c.revoked_at
                  ? `Revoked ${formatDate(c.revoked_at)}`
                  : c.expires_at && new Date(c.expires_at) < new Date()
                    ? 'Expired'
                    : c.expires_at
                      ? `Active until ${formatDate(c.expires_at)}`
                      : 'Active',
            },
            {
              key: 'revoke',
              header: '',
              align: 'right',
              render: (c) =>
                c.revoked_at ? null : (
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-auto"
                    disabled={busy}
                    onClick={() => setConfirmRevoke(c)}
                    aria-label={`Revoke ${c.name}`}
                  >
                    Revoke
                  </Button>
                ),
            },
          ]}
          rows={clients}
          getRowKey={(c) => c.id}
          emptyMessage="No API clients yet."
        />
      </Card>

      <Card title="Imports awaiting review">
        <p className="text-sm text-content-secondary">
          Clients can only submit validated imports. Nothing is written to school records until you
          commit an import here; it is validated again against current records first.
        </p>
        {jobs.length === 0 ? (
          <p className="text-sm text-content-secondary">No imports have been submitted.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {jobs.map((job) => (
              <li key={job.id} className="rounded-md border border-border p-3 text-sm">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium text-content-primary">
                      School EMIS numbers from {job.client_name}
                    </p>
                    <p className="break-words text-xs text-content-tertiary">
                      {formatDate(job.created_at)} · key {job.idempotency_key} · {job.valid_rows} of{' '}
                      {job.total_rows} rows valid · status {job.status}
                    </p>
                  </div>
                  {job.status === 'validated' && (
                    <div className="grid grid-cols-2 gap-2 sm:w-64">
                      <Button
                        type="button"
                        disabled={busy}
                        onClick={() => setReviewing({ job, decision: 'commit' })}
                      >
                        Commit
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={busy}
                        onClick={() => setReviewing({ job, decision: 'reject' })}
                      >
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
                <details className="mt-2">
                  <summary className="cursor-pointer text-content-primary">Preview</summary>
                  <ul className="mt-2 flex flex-col gap-1">
                    {job.rows.map((r) => (
                      <li key={r.row} className="break-words">
                        {schoolName(r.school_id)}: {r.current_emis_number ?? 'no EMIS number'} →{' '}
                        {r.emis_number} ({r.action})
                      </li>
                    ))}
                    {job.errors.map((e) => (
                      <li key={`${e.row}-${e.code}-${e.field ?? ''}`} className="text-danger-600">
                        Row {e.row}: {e.message}
                      </li>
                    ))}
                  </ul>
                </details>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal isOpen={issued !== null} onClose={() => setIssued(null)} title="API token created">
        {issued && (
          <div className="flex flex-col gap-3 text-sm">
            <p>
              Token for <strong>{issued.name}</strong>. Copy it now and give it to the integration
              owner through a secure channel. It is not stored and cannot be shown again; if it is
              lost, revoke the client and create a new one.
            </p>
            <code className="block break-all rounded-md border border-border bg-surface-sunken p-3 font-mono text-xs">
              {issued.token}
            </code>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                void navigator.clipboard?.writeText(issued.token).then(
                  () => showToast('Token copied.', { variant: 'success' }),
                  () =>
                    showToast('Copy failed; select the token and copy it manually.', {
                      variant: 'error',
                    }),
                );
              }}
            >
              Copy token
            </Button>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={confirmRevoke !== null}
        onClose={() => setConfirmRevoke(null)}
        title="Revoke API client"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setConfirmRevoke(null)}>
              Cancel
            </Button>
            <Button type="button" isLoading={busy} onClick={() => void revoke()}>
              Revoke client
            </Button>
          </div>
        }
      >
        <p className="text-sm">
          {confirmRevoke?.name} will be refused on its next request. This cannot be undone; create a
          new client to restore access.
        </p>
      </Modal>

      <Modal
        isOpen={reviewing !== null}
        onClose={() => setReviewing(null)}
        title={reviewing?.decision === 'commit' ? 'Commit import' : 'Reject import'}
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setReviewing(null)}>
              Cancel
            </Button>
            <Button type="button" isLoading={busy} onClick={() => void review()}>
              {reviewing?.decision === 'commit' ? 'Commit' : 'Reject'}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-3 text-sm">
          <p>
            {reviewing?.decision === 'commit'
              ? `This updates the EMIS number of ${reviewing.job.rows.filter((r) => r.action !== 'unchanged').length} schools. Each change is audited.`
              : 'The import is closed without changing any school record.'}
          </p>
          <TextField
            label="Notes (optional)"
            maxLength={500}
            value={reviewNotes}
            onChange={(e) => setReviewNotes(e.target.value)}
          />
        </div>
      </Modal>
    </PageContainer>
  );
}
