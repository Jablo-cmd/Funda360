import { supabase } from '@/lib/supabase';
import type { AnnouncementRow, AnnouncementInsert } from '@/lib/database.types';
import type { Announcement, CreateAnnouncementInput } from '@/features/announcements/types/announcement.types';

function toAnnouncement(row: AnnouncementRow): Announcement {
  return {
    id: row.id,
    schoolId: row.school_id,
    title: row.title,
    body: row.body,
    audience: row.audience,
    active: row.active,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Every active announcement visible to the caller — RLS (announcements_select) already scopes this to the caller's tenant AND their audience (staff never see all_guardians-only posts, and vice versa), so no extra client-side filtering is needed. */
async function getAnnouncements(schoolId: string): Promise<Announcement[]> {
  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .eq('school_id', schoolId)
    .eq('active', true)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data.map(toAnnouncement);
}

/** Posting fans out a real notification to every matching recipient — see announcements_notify_recipients() (20260829140000_announcements.sql). */
async function createAnnouncement(schoolId: string, input: CreateAnnouncementInput): Promise<Announcement> {
  const payload: AnnouncementInsert = {
    school_id: schoolId,
    title: input.title,
    body: input.body,
    audience: input.audience,
  };
  const { data, error } = await supabase.from('announcements').insert(payload).select('*').single();
  if (error) throw error;
  return toAnnouncement(data);
}

/** Never hard-deleted (no DELETE RLS policy) — a retracted announcement is excluded via active: false. */
async function archiveAnnouncement(id: string): Promise<Announcement> {
  const { data, error } = await supabase.from('announcements').update({ active: false }).eq('id', id).select('*').single();
  if (error) throw error;
  return toAnnouncement(data);
}

export const announcementService = {
  getAnnouncements,
  createAnnouncement,
  archiveAnnouncement,
};
