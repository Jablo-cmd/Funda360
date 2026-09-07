import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { TextField } from '@/components/ui/TextField';
import { PageContainer } from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { LoadingBlock } from '@/components/ui/LoadingBlock';
import { NoActiveSchoolNotice } from '@/components/ui/NoActiveSchoolNotice';
import { useToast } from '@/components/ui/toast/useToast';
import { useSchool } from '@/features/school/hooks/useSchool';
import {
  notificationPreferenceService,
  type SchoolMessagingSettings,
} from '@/features/notifications/services/notificationPreferenceService';
import { getDbErrorMessage } from '@/lib/dbErrors';

const EMPTY: SchoolMessagingSettings = {
  emailEnabled: false,
  smsEnabled: false,
  whatsappEnabled: false,
  emailFromName: null,
  emailReplyTo: null,
  smsSenderId: null,
  emailProvider: null,
  smsProvider: null,
  whatsappProvider: null,
};

export function MessagingSettingsPage() {
  const { school } = useSchool();
  const schoolId = school?.id ?? null;
  const { showToast } = useToast();
  const [settings, setSettings] = useState<SchoolMessagingSettings>(EMPTY);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!schoolId) return;
    let cancelled = false;
    notificationPreferenceService
      .getSchoolSettings(schoolId)
      .then((next) => {
        if (!cancelled && next) setSettings(next);
      })
      .catch((err) => {
        if (!cancelled) setError(getDbErrorMessage(err, 'Failed to load messaging settings.'));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [schoolId]);

  const handleSave = async () => {
    if (!schoolId) return;
    setSaving(true);
    setError(null);
    try {
      const saved = await notificationPreferenceService.saveSchoolSettings(schoolId, settings);
      setSettings(saved);
      showToast('Messaging settings saved.', { variant: 'success' });
    } catch (err) {
      setError(getDbErrorMessage(err, 'Failed to save.'));
    } finally {
      setSaving(false);
    }
  };

  const set = (patch: Partial<SchoolMessagingSettings>) => setSettings((s) => ({ ...s, ...patch }));

  if (!schoolId) {
    return (
      <PageContainer>
        <PageHeader title="Messaging & delivery" />
        <NoActiveSchoolNotice resource="messaging settings" />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Messaging & delivery"
        description="Enable the channels notifications can be delivered on. Provider API keys are configured separately in the delivery worker's environment — never here."
      />
      <ErrorAlert message={error} />

      {isLoading ? (
        <LoadingBlock label="Loading settings…" />
      ) : (
        <div className="flex max-w-xl flex-col gap-6">
          <fieldset className="flex flex-col gap-3 rounded-card border border-border bg-surface-raised p-4">
            <legend className="px-1 text-sm font-semibold text-content-primary">Email</legend>
            <Checkbox
              label="Deliver notifications by email"
              checked={settings.emailEnabled}
              onChange={(e) => set({ emailEnabled: e.target.checked })}
            />
            <TextField
              label="From name"
              value={settings.emailFromName ?? ''}
              onChange={(e) => set({ emailFromName: e.target.value || null })}
            />
            <TextField
              label="Reply-to address"
              value={settings.emailReplyTo ?? ''}
              onChange={(e) => set({ emailReplyTo: e.target.value || null })}
            />
            <TextField
              label="Provider (e.g. resend, sendgrid, ses)"
              value={settings.emailProvider ?? ''}
              onChange={(e) => set({ emailProvider: e.target.value || null })}
            />
          </fieldset>

          <fieldset className="flex flex-col gap-3 rounded-card border border-border bg-surface-raised p-4">
            <legend className="px-1 text-sm font-semibold text-content-primary">SMS</legend>
            <Checkbox
              label="Deliver notifications by SMS"
              checked={settings.smsEnabled}
              onChange={(e) => set({ smsEnabled: e.target.checked })}
            />
            <TextField
              label="Sender ID"
              value={settings.smsSenderId ?? ''}
              onChange={(e) => set({ smsSenderId: e.target.value || null })}
            />
            <TextField
              label="Provider (e.g. twilio, clickatell)"
              value={settings.smsProvider ?? ''}
              onChange={(e) => set({ smsProvider: e.target.value || null })}
            />
          </fieldset>

          <fieldset className="flex flex-col gap-3 rounded-card border border-border bg-surface-raised p-4">
            <legend className="px-1 text-sm font-semibold text-content-primary">WhatsApp</legend>
            <Checkbox
              label="Deliver notifications by WhatsApp"
              checked={settings.whatsappEnabled}
              onChange={(e) => set({ whatsappEnabled: e.target.checked })}
            />
            <TextField
              label="Provider (e.g. twilio, meta)"
              value={settings.whatsappProvider ?? ''}
              onChange={(e) => set({ whatsappProvider: e.target.value || null })}
            />
          </fieldset>

          <p className="text-xs text-content-tertiary">
            Enabling a channel here only means the app will queue a delivery for it. Nothing is actually sent until the{' '}
            <code>notifications-dispatch</code> function is deployed with that provider&rsquo;s credentials — see{' '}
            <code>docs/NOTIFICATIONS_DELIVERY.md</code>.
          </p>

          <div className="w-40">
            <Button type="button" onClick={() => void handleSave()} isLoading={saving}>
              Save settings
            </Button>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
