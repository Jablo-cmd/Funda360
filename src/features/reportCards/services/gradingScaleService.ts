import { supabase } from '@/lib/supabase';
import type {
  GradingScaleRow,
  GradingScaleBandRow,
  GradingScaleInsert,
  GradingScaleBandInsert,
} from '@/lib/database.types';
import type {
  GradingScale,
  GradingScaleBand,
  GradingScaleWithBands,
} from '@/features/reportCards/types/reportCard.types';

function toScale(row: GradingScaleRow): GradingScale {
  return {
    id: row.id,
    schoolId: row.school_id,
    name: row.name,
    description: row.description,
    isDefault: row.is_default,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toBand(row: GradingScaleBandRow): GradingScaleBand {
  return {
    id: row.id,
    gradingScaleId: row.grading_scale_id,
    schoolId: row.school_id,
    code: row.code,
    label: row.label,
    descriptor: row.descriptor,
    minPercentage: row.min_percentage,
    maxPercentage: row.max_percentage,
    sortOrder: row.sort_order,
  };
}

export interface GradingScaleInput {
  name: string;
  description?: string | null;
  isDefault: boolean;
}

export interface GradingBandInput {
  code: string;
  label: string;
  descriptor?: string | null;
  minPercentage: number;
  maxPercentage: number;
}

async function listScales(schoolId: string): Promise<GradingScaleWithBands[]> {
  const { data: scales, error } = await supabase
    .from('grading_scales')
    .select('*')
    .eq('school_id', schoolId)
    .eq('active', true)
    .order('name', { ascending: true });
  if (error) throw error;
  if (scales.length === 0) return [];

  const { data: bands, error: bandsError } = await supabase
    .from('grading_scale_bands')
    .select('*')
    .in('grading_scale_id', scales.map((s) => s.id))
    .order('min_percentage', { ascending: false });
  if (bandsError) throw bandsError;

  return scales.map((scale) => ({
    ...toScale(scale),
    bands: bands.filter((b) => b.grading_scale_id === scale.id).map(toBand),
  }));
}

async function createScale(schoolId: string, input: GradingScaleInput): Promise<GradingScale> {
  const payload: GradingScaleInsert = {
    school_id: schoolId,
    name: input.name,
    description: input.description || null,
    is_default: input.isDefault,
  };
  const { data, error } = await supabase.from('grading_scales').insert(payload).select('*').single();
  if (error) throw error;
  return toScale(data);
}

async function updateScale(id: string, input: GradingScaleInput): Promise<GradingScale> {
  const { data, error } = await supabase
    .from('grading_scales')
    .update({ name: input.name, description: input.description || null, is_default: input.isDefault })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return toScale(data);
}

/** Never hard-deleted — a retired scale is excluded from selection via active: false. */
async function archiveScale(id: string): Promise<void> {
  const { error } = await supabase.from('grading_scales').update({ active: false, is_default: false }).eq('id', id);
  if (error) throw error;
}

/**
 * Replaces every band on a scale in one transaction-like sequence: the
 * non-overlap rule is enforced per-row by the DB trigger, so bands are
 * deleted first (bands are the one deletable config row in this schema —
 * see the migration) then re-inserted from the supplied list.
 */
async function replaceBands(schoolId: string, scaleId: string, bands: GradingBandInput[]): Promise<GradingScaleBand[]> {
  const { error: delError } = await supabase.from('grading_scale_bands').delete().eq('grading_scale_id', scaleId);
  if (delError) throw delError;
  if (bands.length === 0) return [];

  const payload: GradingScaleBandInsert[] = bands
    .slice()
    .sort((a, b) => b.minPercentage - a.minPercentage)
    .map((band, index) => ({
      grading_scale_id: scaleId,
      school_id: schoolId,
      code: band.code,
      label: band.label,
      descriptor: band.descriptor || null,
      min_percentage: band.minPercentage,
      max_percentage: band.maxPercentage,
      sort_order: index,
    }));
  const { data, error } = await supabase.from('grading_scale_bands').insert(payload).select('*');
  if (error) throw error;
  return data.map(toBand);
}

export const gradingScaleService = {
  listScales,
  createScale,
  updateScale,
  archiveScale,
  replaceBands,
};
