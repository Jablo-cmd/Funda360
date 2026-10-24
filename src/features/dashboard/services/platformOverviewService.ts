import { supabase } from '@/lib/supabase';
import type { PlatformOverview } from '@/lib/database.types';

/** Counts for the platform-owner dashboard (get_platform_overview, platform administrators only). */
export async function getPlatformOverview(): Promise<PlatformOverview> {
  const { data, error } = await supabase.rpc('get_platform_overview');
  if (error) throw error;
  return data;
}
