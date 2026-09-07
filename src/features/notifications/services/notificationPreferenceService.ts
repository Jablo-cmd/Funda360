import { supabase } from '@/lib/supabase';
import type {
  NotificationPreferenceRow,
  SchoolMessagingSettingsRow,
  SchoolMessagingSettingsUpdate,
} from '@/lib/database.types';

export interface NotificationPreferences {
  emailEnabled: boolean;
  smsEnabled: boolean;
  whatsappEnabled: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
}

const DEFAULTS: NotificationPreferences = {
  emailEnabled: false,
  smsEnabled: false,
  whatsappEnabled: false,
  quietHoursStart: null,
  quietHoursEnd: null,
};

function toPreferences(row: NotificationPreferenceRow): NotificationPreferences {
  return {
    emailEnabled: row.email_enabled,
    smsEnabled: row.sms_enabled,
    whatsappEnabled: row.whatsapp_enabled,
    quietHoursStart: row.quiet_hours_start,
    quietHoursEnd: row.quiet_hours_end,
  };
}

/** The caller's own preferences. Returns sensible defaults (all external channels off) when no row exists yet. */
async function getMyPreferences(profileId: string): Promise<NotificationPreferences> {
  const { data, error } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('profile_id', profileId)
    .maybeSingle();
  if (error) throw error;
  return data ? toPreferences(data) : { ...DEFAULTS };
}

async function saveMyPreferences(profileId: string, prefs: NotificationPreferences): Promise<NotificationPreferences> {
  const { data, error } = await supabase
    .from('notification_preferences')
    .upsert(
      {
        profile_id: profileId,
        email_enabled: prefs.emailEnabled,
        sms_enabled: prefs.smsEnabled,
        whatsapp_enabled: prefs.whatsappEnabled,
        quiet_hours_start: prefs.quietHoursStart,
        quiet_hours_end: prefs.quietHoursEnd,
      },
      { onConflict: 'profile_id' },
    )
    .select('*')
    .single();
  if (error) throw error;
  return toPreferences(data);
}

export interface SchoolMessagingSettings {
  emailEnabled: boolean;
  smsEnabled: boolean;
  whatsappEnabled: boolean;
  emailFromName: string | null;
  emailReplyTo: string | null;
  smsSenderId: string | null;
  emailProvider: string | null;
  smsProvider: string | null;
  whatsappProvider: string | null;
}

function toSettings(row: SchoolMessagingSettingsRow): SchoolMessagingSettings {
  return {
    emailEnabled: row.email_enabled,
    smsEnabled: row.sms_enabled,
    whatsappEnabled: row.whatsapp_enabled,
    emailFromName: row.email_from_name,
    emailReplyTo: row.email_reply_to,
    smsSenderId: row.sms_sender_id,
    emailProvider: row.email_provider,
    smsProvider: row.sms_provider,
    whatsappProvider: row.whatsapp_provider,
  };
}

async function getSchoolSettings(schoolId: string): Promise<SchoolMessagingSettings | null> {
  const { data, error } = await supabase
    .from('school_messaging_settings')
    .select('*')
    .eq('school_id', schoolId)
    .maybeSingle();
  if (error) throw error;
  return data ? toSettings(data) : null;
}

async function saveSchoolSettings(schoolId: string, settings: SchoolMessagingSettings): Promise<SchoolMessagingSettings> {
  const payload: SchoolMessagingSettingsUpdate & { school_id: string } = {
    school_id: schoolId,
    email_enabled: settings.emailEnabled,
    sms_enabled: settings.smsEnabled,
    whatsapp_enabled: settings.whatsappEnabled,
    email_from_name: settings.emailFromName,
    email_reply_to: settings.emailReplyTo,
    sms_sender_id: settings.smsSenderId,
    email_provider: settings.emailProvider,
    sms_provider: settings.smsProvider,
    whatsapp_provider: settings.whatsappProvider,
  };
  const { data, error } = await supabase
    .from('school_messaging_settings')
    .upsert(payload, { onConflict: 'school_id' })
    .select('*')
    .single();
  if (error) throw error;
  return toSettings(data);
}

export const notificationPreferenceService = {
  getMyPreferences,
  saveMyPreferences,
  getSchoolSettings,
  saveSchoolSettings,
};
