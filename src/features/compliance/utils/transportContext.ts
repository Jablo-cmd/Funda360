import type { TransportContext } from '@/features/compliance/utils/frameworkStatus';

/** The live session's transport facts, used to *measure* (not claim) encryption in transit. */
export function transportContext(): TransportContext {
  return {
    pageProtocol: window.location.protocol,
    apiUrl: String(import.meta.env.VITE_SUPABASE_URL ?? ''),
  };
}
