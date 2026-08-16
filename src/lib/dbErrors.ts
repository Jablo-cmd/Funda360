/**
 * Translates a thrown Supabase/PostgREST error into copy safe to show end
 * users, instead of the raw table/column/constraint text Postgres returns
 * (e.g. `duplicate key value violates unique constraint "learners_school_id_learner_number_key"`).
 * Always logs the original error so developers keep full detail in the
 * console. Falls back to `fallback` for anything unrecognized, and to a
 * plain Error's own message for non-database errors (e.g. network
 * failures) — matching the previous `error instanceof Error ? error.message
 * : fallback` behaviour used across the app for those cases. Authentication
 * errors are unaffected — they go through authErrors.ts, not this.
 */

interface PostgrestLikeError {
  message: string;
  code?: string;
}

function isPostgrestLikeError(error: unknown): error is PostgrestLikeError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string' &&
    'code' in error
  );
}

/** RAISE EXCEPTION messages this codebase's own migrations use — a `reason: detail` convention, not raw schema. */
const RAISED_MESSAGE_PATTERNS: Array<[RegExp, string]> = [
  [/^insufficient_privilege:/i, "You don't have permission to do this."],
  [/^not_found:/i, 'The requested record could not be found.'],
  [/^email_taken:/i, 'That email address is already registered.'],
];

/** Common Postgres SQLSTATE codes surfaced via constraints, not custom RAISE EXCEPTION text. */
const SQLSTATE_MESSAGES: Record<string, string> = {
  '23505': 'This already exists — please check for a duplicate entry.',
  '23503': "This action can't be completed because it's linked to other records.",
  '23514': 'The information provided is not valid.',
  '42501': "You don't have permission to perform this action.",
};

export function getDbErrorMessage(error: unknown, fallback: string): string {
  if (isPostgrestLikeError(error)) {
    console.error(error);

    for (const [pattern, message] of RAISED_MESSAGE_PATTERNS) {
      if (pattern.test(error.message)) return message;
    }

    const codeMessage = error.code ? SQLSTATE_MESSAGES[error.code] : undefined;
    if (codeMessage) return codeMessage;

    return fallback;
  }

  if (error instanceof Error) return error.message;

  return fallback;
}
