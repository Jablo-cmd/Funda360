import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { Checkbox } from '@/components/ui/Checkbox';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { useToast } from '@/components/ui/toast/useToast';
import { getDbErrorMessage } from '@/lib/dbErrors';
import type { ComplianceFramework, SchoolComplianceSettingsRow } from '@/lib/database.types';
import { updateComplianceSettings } from '@/features/compliance/services/complianceService';
import { SectionTitle } from '@/features/compliance/components/ComplianceUi';
import { FRAMEWORK_META } from '@/features/compliance/utils/frameworkStatus';

const OPTIONAL: ComplianceFramework[] = ['FERPA', 'GDPR', 'COPPA', 'CIPA'];

export function SettingsTab({
  schoolId,
  settings,
  canManage,
  onSaved,
}: {
  schoolId: string;
  settings: SchoolComplianceSettingsRow;
  canManage: boolean;
  onSaved: () => void;
}) {
  const { showToast } = useToast();
  const [frameworks, setFrameworks] = useState<ComplianceFramework[]>(settings.frameworks);
  const [coppaAge, setCoppaAge] = useState(String(settings.coppa_consent_age));
  const [gdprAge, setGdprAge] = useState(String(settings.gdpr_digital_consent_age));
  const [ferpaDays, setFerpaDays] = useState(String(settings.ferpa_amendment_response_days));
  const [dsarDays, setDsarDays] = useState(String(settings.dsar_response_days));
  const [filter, setFilter] = useState(settings.content_filter_enabled);
  const [ioName, setIoName] = useState(settings.information_officer_name ?? '');
  const [ioEmail, setIoEmail] = useState(settings.information_officer_email ?? '');
  const [notice, setNotice] = useState(settings.privacy_notice_version);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await updateComplianceSettings(schoolId, {
        frameworks: ['POPIA', ...frameworks.filter((f) => f !== 'POPIA')],
        coppaConsentAge: Number(coppaAge),
        gdprDigitalConsentAge: Number(gdprAge),
        ferpaAmendmentResponseDays: Number(ferpaDays),
        dsarResponseDays: Number(dsarDays),
        contentFilterEnabled: filter,
        informationOfficerName: ioName.trim(),
        informationOfficerEmail: ioEmail.trim(),
        privacyNoticeVersion: notice.trim(),
      });
      showToast('Compliance settings saved and audited.', { variant: 'success' });
      onSaved();
    } catch (err) {
      setError(
        getDbErrorMessage(
          err,
          'Settings could not be saved. Check every value is within its allowed range.',
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-8">
      <fieldset disabled={!canManage} className="space-y-8">
        <section>
          <SectionTitle description="POPIA is always on — it is the South African legal baseline.">
            Frameworks in scope
          </SectionTitle>
          <div className="space-y-2">
            <Checkbox
              label={`POPIA — ${FRAMEWORK_META.POPIA.jurisdiction} (always on)`}
              checked
              disabled
            />
            {OPTIONAL.map((f) => (
              <Checkbox
                key={f}
                label={`${f} — ${FRAMEWORK_META[f].jurisdiction}`}
                checked={frameworks.includes(f)}
                onChange={(e) =>
                  setFrameworks((prev) =>
                    e.target.checked ? [...prev, f] : prev.filter((x) => x !== f),
                  )
                }
              />
            ))}
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <SectionTitle description="POPIA s.55: every school must register an Information Officer. Families see these contact details.">
              Information Officer
            </SectionTitle>
          </div>
          <TextField label="Name" value={ioName} onChange={(e) => setIoName(e.target.value)} />
          <TextField
            label="Email"
            type="email"
            value={ioEmail}
            onChange={(e) => setIoEmail(e.target.value)}
          />
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <SectionTitle>Thresholds and deadlines</SectionTitle>
          </div>
          <TextField
            label="COPPA parental-consent age (13–18)"
            type="number"
            min={13}
            max={18}
            value={coppaAge}
            onChange={(e) => setCoppaAge(e.target.value)}
            hint="Children below this age cannot have a login without verifiable parental consent."
          />
          <TextField
            label="GDPR digital-consent age (13–16)"
            type="number"
            min={13}
            max={16}
            value={gdprAge}
            onChange={(e) => setGdprAge(e.target.value)}
          />
          <TextField
            label="FERPA amendment response (days)"
            type="number"
            min={1}
            max={90}
            value={ferpaDays}
            onChange={(e) => setFerpaDays(e.target.value)}
          />
          <TextField
            label="Data-subject request response (days)"
            type="number"
            min={1}
            max={90}
            value={dsarDays}
            onChange={(e) => setDsarDays(e.target.value)}
            hint="POPIA and GDPR: respond within a reasonable time, at most 30 days."
          />
          <TextField
            label="Privacy notice version"
            value={notice}
            onChange={(e) => setNotice(e.target.value)}
            hint="Recorded against every consent decision. Change it when the notice changes."
          />
          <div className="self-end">
            <Checkbox
              label="Safe-content filter (CIPA) enabled"
              checked={filter}
              onChange={(e) => setFilter(e.target.checked)}
            />
          </div>
        </section>
      </fieldset>
      <ErrorAlert message={error} />
      {canManage && (
        <Button type="submit" isLoading={busy}>
          Save settings
        </Button>
      )}
    </form>
  );
}
