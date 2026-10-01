import { getDbErrorMessage } from '@/lib/dbErrors';

// The curriculum RPCs raise `code: hand-written sentence` (no table, column or constraint names), so the
// sentence is safe to show and far more useful than a generic line: "every validation warning must be
// acknowledged first" tells a reviewer what to do. Global getDbErrorMessage maps invalid_state to invitation copy,
// which is wrong here, so curriculum screens go through this instead.
const RAISED =
  /^(?:invalid_state|invalid_argument|invalid_reference|insufficient_privilege|rate_limited):\s*([\s\S]+)$/i;
const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;

export function curriculumErrorMessage(error: unknown, fallback: string): string {
  const message =
    typeof error === 'object' && error !== null && 'message' in error
      ? (error as { message: unknown }).message
      : null;
  if (typeof message === 'string') {
    const raised = RAISED.exec(message);
    if (raised?.[1]) {
      console.error(error);
      const detail = raised[1].replace(UUID, '').replace(/\s+/g, ' ').trim();
      if (detail) {
        const sentence = detail.charAt(0).toUpperCase() + detail.slice(1);
        return /[.!?]$/.test(sentence) ? sentence : `${sentence}.`;
      }
    }
    if (/^not_found:/i.test(message)) {
      console.error(error);
      return 'That item could not be found.';
    }
  }
  return getDbErrorMessage(error, fallback);
}
