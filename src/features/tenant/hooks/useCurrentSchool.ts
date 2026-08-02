import { useTenant } from '@/features/tenant/context/tenantContext';
import type { School } from '@/types/school.types';

/** Convenience selector over useTenant() for call sites that only need the active school. */
export function useCurrentSchool(): School | null {
  return useTenant().tenant?.school ?? null;
}
