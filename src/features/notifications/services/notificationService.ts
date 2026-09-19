import { supabase } from '@/lib/supabase';
import type { NotificationRow } from '@/lib/database.types';
import type { Notification } from '@/features/notifications/types/notification.types';

function toNotification(row: NotificationRow): Notification {
  return {
    id: row.id,
    schoolId: row.school_id,
    recipientProfileId: row.recipient_profile_id,
    type: row.type,
    title: row.title,
    body: row.body,
    relatedEntityTable: row.related_entity_table,
    relatedEntityId: row.related_entity_id,
    linkPath: row.link_path,
    isRead: row.read_at !== null,
    createdAt: row.created_at,
  };
}

async function getMyNotifications(recipientProfileId: string): Promise<Notification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('recipient_profile_id', recipientProfileId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return data.map(toNotification);
}

async function markRead(id: string): Promise<Notification> {
  const { data, error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return toNotification(data);
}

async function markAllRead(recipientProfileId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('recipient_profile_id', recipientProfileId)
    .is('read_at', null);
  if (error) throw error;
}

function toNotificationForRealtime(row: NotificationRow): Notification {
  return toNotification(row);
}

export const notificationService = {
  getMyNotifications,
  markRead,
  markAllRead,
  toNotificationForRealtime,
};
