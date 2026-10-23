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
import { useToast } from '@/components/ui/toast/useToast';
import { getDbErrorMessage } from '@/lib/dbErrors';
import type {
  EducationAreaLevel,
  EducationAreaRow,
  EducationOfficialAssignmentRow,
} from '@/lib/database.types';
import {
  governmentReportService,
  type EducationOfficial,
  type SchoolAreaLink,
} from '@/features/government/services/governmentReportService';

const FIELD_CLASS =
  'focus-ring h-11 w-full rounded-md border border-border-strong bg-surface-raised px-3 text-sm text-content-primary lg:h-10';
const LABEL_CLASS = 'mb-1.5 block text-xs font-medium text-content-tertiary';

const PARENT_LEVEL: Record<EducationAreaLevel, EducationAreaLevel | null> = {
  province: null,
  district: 'province',
  circuit: 'district',
};

/** "Western Cape / Metro East / Circuit 4" for any area. */
function areaPath(areas: EducationAreaRow[], areaId: string | null): string {
  const byId = new Map(areas.map((a) => [a.id, a]));
  const parts: string[] = [];
  let current = areaId ? byId.get(areaId) : undefined;
  while (current) {
    parts.unshift(current.name);
    current = current.parent_id ? byId.get(current.parent_id) : undefined;
  }
  return parts.join(' / ');
}

/**
 * Platform administration for government reporting: the Province ->
 * District -> Circuit hierarchy, which area each school reports to, and
 * which officials may see which area. Every action is a platform-admin-only
 * RPC that writes to the audit log.
 */
export function EducationAreasPage() {
  const id = useId();
  const { showToast } = useToast();
  const [areas, setAreas] = useState<EducationAreaRow[]>([]);
  const [schools, setSchools] = useState<SchoolAreaLink[]>([]);
  const [officials, setOfficials] = useState<EducationOfficial[]>([]);
  const [assignments, setAssignments] = useState<EducationOfficialAssignmentRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [areaLevel, setAreaLevel] = useState<EducationAreaLevel>('province');
  const [areaParent, setAreaParent] = useState('');
  const [areaName, setAreaName] = useState('');
  const [areaCode, setAreaCode] = useState('');

  const [official, setOfficial] = useState({ firstName: '', lastName: '', email: '', phone: '' });
  const [issuedPassword, setIssuedPassword] = useState<{ email: string; password: string } | null>(
    null,
  );

  const [grantOfficial, setGrantOfficial] = useState('');
  const [grantArea, setGrantArea] = useState('');
  const [grantDetail, setGrantDetail] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [a, s, o, g] = await Promise.all([
        governmentReportService.listAreas(),
        governmentReportService.listSchoolAreaLinks(),
        governmentReportService.listOfficials(),
        governmentReportService.listAssignments(),
      ]);
      setAreas(a);
      setSchools(s);
      setOfficials(o);
      setAssignments(g);
    } catch (err) {
      setError(getDbErrorMessage(err, 'Could not load education areas.'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true);
    try {
      await action();
      showToast(success, { variant: 'success' });
      await load();
      return true;
    } catch (err) {
      showToast(getDbErrorMessage(err, 'That did not work.'), { variant: 'error' });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const linkableAreas = useMemo(
    () =>
      areas
        .filter((a) => a.level !== 'province')
        .map((a) => ({ id: a.id, label: areaPath(areas, a.id) }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [areas],
  );
  const allAreas = useMemo(
    () =>
      areas
        .map((a) => ({ id: a.id, label: `${areaPath(areas, a.id)} (${a.level})` }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [areas],
  );
  const parentLevel = PARENT_LEVEL[areaLevel];
  const parentOptions = parentLevel ? areas.filter((a) => a.level === parentLevel) : [];
  const officialName = (profileId: string) => {
    const o = officials.find((x) => x.id === profileId);
    return o ? `${o.firstName} ${o.lastName}` : 'Unknown official';
  };

  const submitArea = async (event: FormEvent) => {
    event.preventDefault();
    const ok = await run(
      () =>
        governmentReportService.saveArea({
          id: null,
          level: areaLevel,
          parentId: parentLevel ? areaParent || null : null,
          name: areaName,
          code: areaCode || null,
        }),
      'Area added.',
    );
    if (ok) {
      setAreaName('');
      setAreaCode('');
    }
  };

  const submitOfficial = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await governmentReportService.provisionOfficial({
        email: official.email.trim(),
        firstName: official.firstName.trim(),
        lastName: official.lastName.trim(),
        phone: official.phone.trim() || null,
      });
      setIssuedPassword({ email: official.email.trim(), password: result.temporaryPassword });
      setOfficial({ firstName: '', lastName: '', email: '', phone: '' });
      await load();
    } catch (err) {
      showToast(getDbErrorMessage(err, 'The account was not created.'), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const submitGrant = async (event: FormEvent) => {
    event.preventDefault();
    // "area:<id>" or "school:<id>": a school-level grant covers that one school only.
    const [kind, targetId] = grantArea.split(':');
    const ok = await run(
      () =>
        kind === 'school'
          ? governmentReportService.grantSchoolAccess(grantOfficial, targetId!, grantDetail)
          : governmentReportService.grantAccess(grantOfficial, targetId!, grantDetail),
      'Access granted.',
    );
    if (ok) setGrantDetail(false);
  };

  if (isLoading) {
    return (
      <PageContainer>
        <LoadingBlock label="Loading education areas…" />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Education areas"
        description="Provinces, districts and circuits; which area each school reports to; and which officials can see each area."
      />
      <ErrorAlert message={error} />

      <Card title="Areas">
        {areas.length === 0 ? (
          <p className="text-sm text-content-secondary">No areas yet. Add a province first.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {allAreas.map((a) => (
              <li key={a.id} className="break-words text-content-primary">
                {a.label}
              </li>
            ))}
          </ul>
        )}
        <form
          onSubmit={(e) => void submitArea(e)}
          className="grid grid-cols-1 gap-3 border-t border-border pt-3 sm:grid-cols-2 lg:grid-cols-4"
        >
          <div>
            <label htmlFor={`${id}-level`} className={LABEL_CLASS}>
              Level
            </label>
            <select
              id={`${id}-level`}
              className={FIELD_CLASS}
              value={areaLevel}
              onChange={(e) => {
                setAreaLevel(e.target.value as EducationAreaLevel);
                setAreaParent('');
              }}
            >
              <option value="province">Province</option>
              <option value="district">District</option>
              <option value="circuit">Circuit</option>
            </select>
          </div>
          {parentLevel && (
            <div>
              <label htmlFor={`${id}-parent`} className={LABEL_CLASS}>
                {parentLevel === 'province' ? 'Province' : 'District'}
              </label>
              <select
                id={`${id}-parent`}
                className={FIELD_CLASS}
                value={areaParent}
                required
                onChange={(e) => setAreaParent(e.target.value)}
              >
                <option value="">Choose…</option>
                {parentOptions.map((a) => (
                  <option key={a.id} value={a.id}>
                    {areaPath(areas, a.id)}
                  </option>
                ))}
              </select>
            </div>
          )}
          <TextField
            label="Name"
            value={areaName}
            required
            maxLength={160}
            onChange={(e) => setAreaName(e.target.value)}
          />
          <TextField
            label="Code (optional)"
            value={areaCode}
            maxLength={40}
            onChange={(e) => setAreaCode(e.target.value)}
          />
          <div className="flex items-end">
            <Button
              type="submit"
              className="w-full lg:w-auto"
              isLoading={busy}
              disabled={!areaName.trim() || (Boolean(parentLevel) && !areaParent)}
            >
              Add area
            </Button>
          </div>
        </form>
      </Card>

      <Card title="Schools">
        <DataTable
          columns={[
            {
              key: 'school',
              header: 'School',
              render: (s) => (
                <div>
                  <p className="font-medium">{s.name}</p>
                  <p className="text-xs text-content-tertiary">
                    {s.emisNumber ? `EMIS ${s.emisNumber}` : 'No EMIS number'}
                    {s.province || s.district
                      ? ` · recorded as ${[s.province, s.district].filter(Boolean).join(' / ')}`
                      : ''}
                  </p>
                </div>
              ),
            },
            {
              key: 'area',
              header: 'Reports to',
              render: (s) => (
                <select
                  aria-label={`Education area for ${s.name}`}
                  className={FIELD_CLASS}
                  value={s.educationAreaId ?? ''}
                  disabled={busy}
                  onChange={(e) =>
                    void run(
                      () => governmentReportService.setSchoolArea(s.id, e.target.value || null),
                      'School linked.',
                    )
                  }
                >
                  <option value="">Not linked</option>
                  {linkableAreas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                    </option>
                  ))}
                </select>
              ),
            },
          ]}
          rows={schools}
          getRowKey={(s) => s.id}
          emptyMessage="No schools."
        />
      </Card>

      <Card title="Education officials">
        {issuedPassword && (
          <div
            role="status"
            className="rounded-md border border-border bg-surface-sunken p-3 text-sm"
          >
            <p className="font-medium text-content-primary">
              Account created for {issuedPassword.email}
            </p>
            <p className="text-content-secondary">
              Temporary password: <code className="font-mono">{issuedPassword.password}</code>.
              Share it securely; it is not shown again. The official must set up two-factor
              authentication.
            </p>
          </div>
        )}
        <form
          onSubmit={(e) => void submitOfficial(e)}
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
        >
          <TextField
            label="First name"
            required
            value={official.firstName}
            onChange={(e) => setOfficial({ ...official, firstName: e.target.value })}
          />
          <TextField
            label="Last name"
            required
            value={official.lastName}
            onChange={(e) => setOfficial({ ...official, lastName: e.target.value })}
          />
          <TextField
            label="Email"
            type="email"
            required
            value={official.email}
            onChange={(e) => setOfficial({ ...official, email: e.target.value })}
          />
          <TextField
            label="Phone (optional)"
            value={official.phone}
            onChange={(e) => setOfficial({ ...official, phone: e.target.value })}
          />
          <div className="flex items-end">
            <Button type="submit" className="w-full lg:w-auto" isLoading={busy}>
              Create official account
            </Button>
          </div>
        </form>

        <form
          onSubmit={(e) => void submitGrant(e)}
          className="grid grid-cols-1 gap-3 border-t border-border pt-3 sm:grid-cols-2 lg:grid-cols-4"
        >
          <div>
            <label htmlFor={`${id}-grant-official`} className={LABEL_CLASS}>
              Official
            </label>
            <select
              id={`${id}-grant-official`}
              className={FIELD_CLASS}
              required
              value={grantOfficial}
              onChange={(e) => setGrantOfficial(e.target.value)}
            >
              <option value="">Choose…</option>
              {officials
                .filter((o) => o.status === 'active')
                .map((o) => (
                  <option key={o.id} value={o.id}>
                    {`${o.firstName} ${o.lastName} (${o.email})`}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label htmlFor={`${id}-grant-area`} className={LABEL_CLASS}>
              Area or school
            </label>
            <select
              id={`${id}-grant-area`}
              className={FIELD_CLASS}
              required
              value={grantArea}
              onChange={(e) => setGrantArea(e.target.value)}
            >
              <option value="">Choose…</option>
              <optgroup label="Areas (province, district or circuit)">
                {allAreas.map((a) => (
                  <option key={a.id} value={`area:${a.id}`}>
                    {a.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Single school">
                {schools.map((school) => (
                  <option key={school.id} value={`school:${school.id}`}>
                    {school.name}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>
          <div className="flex items-end pb-2">
            <Checkbox
              label="Allow learner-level detail"
              checked={grantDetail}
              onChange={(e) => setGrantDetail(e.target.checked)}
            />
          </div>
          <div className="flex items-end">
            <Button
              type="submit"
              className="w-full lg:w-auto"
              isLoading={busy}
              disabled={!grantOfficial || !grantArea}
            >
              Grant access
            </Button>
          </div>
        </form>

        <DataTable
          columns={[
            { key: 'official', header: 'Official', render: (g) => officialName(g.profile_id) },
            {
              key: 'area',
              header: 'Area or school',
              render: (g) =>
                g.school_id
                  ? `School: ${schools.find((school) => school.id === g.school_id)?.name ?? g.school_id}`
                  : areaPath(areas, g.area_id),
            },
            {
              key: 'detail',
              header: 'Learner detail',
              render: (g) => (g.can_view_learner_detail ? 'Yes' : 'No'),
            },
            {
              key: 'granted',
              header: 'Granted',
              render: (g) => new Date(g.granted_at).toLocaleDateString('en-ZA'),
            },
            {
              key: 'revoke',
              header: '',
              align: 'right',
              render: (g) => (
                <Button
                  type="button"
                  variant="ghost"
                  className="w-auto"
                  disabled={busy}
                  onClick={() =>
                    void run(() => governmentReportService.revokeAccess(g.id), 'Access revoked.')
                  }
                >
                  Revoke
                </Button>
              ),
            },
          ]}
          rows={assignments}
          getRowKey={(g) => g.id}
          emptyMessage="No official has been granted access yet."
        />
      </Card>
    </PageContainer>
  );
}
