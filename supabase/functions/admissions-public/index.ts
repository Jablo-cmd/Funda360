// admissions-public — the single controlled entry point for a prospective
// family (who has no account) to submit / save / resume an application and
// upload documents.
//
// There is NO anon RLS policy on any admissions table. This function holds
// the service-role key and calls the public_* RPCs (granted to service_role
// only). It never returns another applicant's data — every mutating action
// is scoped by the secret resume_token, and resume is scoped by
// email + reference number.
//
// Actions (POST body { action, ... }):
//   config   { schoolId }                         -> school name + academic years + grades + document requirements
//   start    { schoolId, applicantEmail, payload } -> { applicationId, resumeToken }
//   save     { resumeToken, payload }              -> { ok: true }
//   submit   { resumeToken }                       -> { referenceNumber }
//   get      { resumeToken }                       -> { found, editable, status, application? }
//   resume   { email, reference, dateOfBirth }     -> { found, status, reference_number, learner_first_name, resume_token? }
//   upload-url { resumeToken, fileName, mimeType, sizeBytes } -> { uploadUrl, path, token }
//   register-doc { resumeToken, label, path, mimeType, sizeBytes, requirementId? } -> { documentId }
//
// Abuse controls (audit P1-6): every action is rate-limited per client IP
// (stored as a salted hash in rate_limit_events — never the raw IP); `start`
// is also limited per applicant email; `resume` additionally requires the
// learner's date of birth and returns no application details beyond the
// learner's first name; documents must be PDF/PNG/JPEG up to 10 MB and can
// only be registered inside their own application's storage folder.
//
// Audit 2026-10-23 (S-3): the client IP comes from `cf-connecting-ip` (set
// by Cloudflare in front of hosted Supabase), never the first
// X-Forwarded-For hop, which the client controls. Limits that matter do not
// depend on the IP at all: `resume` is capped per reference and per email,
// `start` per school. Limiters on start/resume/upload-url/register-doc fail
// closed.
//
// Error contract: the client only ever sees a small, stable set of codes —
// `invalid_request` (400), `not_found` (404), `request_failed` (500), plus
// the fixed codes returned inline below (`method_not_allowed`,
// `unknown_action`, `documents_closed`). Raw PostgreSQL / PostgREST / RPC
// error text (SQLSTATE, table / column / constraint names, UUID parser
// messages, stack traces) is logged server-side and NEVER returned.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, json } from '../_shared/cors.ts';
import {
  clientIp,
  FAIL_CLOSED_ACTIONS,
  hashedActorId,
  isAcceptableDocument,
  isOwnDocumentPath,
  KEYED_LIMITS,
  limitKey,
  normaliseDate,
  RATE_LIMITS,
} from '../_shared/admissions/guards.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const db = () => createClient(supabaseUrl, serviceKey);

interface DbError {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
}

// SQLSTATE classes for "the client sent something the database could not
// accept" — bad UUID / date / number text (22xxx) and integrity violations
// (23xxx). These become `invalid_request`, never the raw parser message.
const CLIENT_INPUT_SQLSTATE = /^(22|23)/;

// The public_* RPCs raise `<prefix>: <human detail>`. The prefix is a
// stable code; the human detail may name ids and is dropped.
const NOT_FOUND_PREFIX = /^not_found\b/;
const BAD_REQUEST_PREFIX =
  /^(invalid_argument|invalid_state|application_locked|already_converted|insufficient_privilege)\b/;

/**
 * Maps any database / RPC / storage error to a safe, stable client
 * response and logs the real detail server-side for debugging.
 */
function dbError(action: string, err: unknown): Response {
  const e = (err ?? {}) as DbError;
  console.error(
    'admissions-public',
    action,
    JSON.stringify({ message: e.message, code: e.code, details: e.details, hint: e.hint }),
  );

  const message = typeof e.message === 'string' ? e.message : '';

  if (NOT_FOUND_PREFIX.test(message)) return json({ error: 'not_found' }, 404);
  if (BAD_REQUEST_PREFIX.test(message)) return json({ error: 'invalid_request' }, 400);
  if (typeof e.code === 'string' && CLIENT_INPUT_SQLSTATE.test(e.code)) {
    return json({ error: 'invalid_request' }, 400);
  }
  return json({ error: 'request_failed' }, 500);
}

const rateLimitSalt = Deno.env.get('ADMISSIONS_RATE_LIMIT_SALT') ?? serviceKey;

type Limit = { max: number; windowMinutes: number };

/**
 * Records one attempt for (actionKey, actor) and reports whether the rolling
 * window now holds more than `limit.max`. Recording first means concurrent
 * requests all count, so a burst cannot slip through between check and
 * insert. Throws if the limiter itself fails.
 */
async function overLimit(
  s: ReturnType<typeof db>,
  actionKey: string,
  actor: string,
  limit: Limit,
): Promise<boolean> {
  const { error: insertError } = await s.from('rate_limit_events').insert({
    actor_profile_id: actor,
    action_key: actionKey,
  });
  if (insertError) throw insertError;
  const since = new Date(Date.now() - limit.windowMinutes * 60_000).toISOString();
  const { count, error } = await s
    .from('rate_limit_events')
    .select('id', { count: 'exact', head: true })
    .eq('actor_profile_id', actor)
    .eq('action_key', actionKey)
    .gt('occurred_at', since);
  if (error) throw error;
  return (count ?? 0) > limit.max;
}

type LimitDecision = 'allowed' | 'limited' | 'unavailable';

/**
 * Rolling-window limit per client IP and action. If the limiter fails, the
 * actions that create data or test a secret (FAIL_CLOSED_ACTIONS) are
 * refused; the read-only ones are allowed so a limiter fault does not take
 * the form offline.
 */
async function ipLimit(s: ReturnType<typeof db>, action: string, req: Request): Promise<LimitDecision> {
  const limit = RATE_LIMITS[action];
  if (!limit) return 'allowed';
  try {
    const { ip, source } = clientIp(req.headers);
    // Hosted Supabase should always supply cf-connecting-ip; anything else
    // means the limit may be keyed on a shared or client-chosen address.
    if (source !== 'cf-connecting-ip') console.warn('admissions-public client ip source', source);
    const actor = await hashedActorId(ip, rateLimitSalt);
    return (await overLimit(s, `admissions_public:${action}`, actor, limit)) ? 'limited' : 'allowed';
  } catch (err) {
    console.error('admissions-public rate limiter unavailable', err);
    return FAIL_CLOSED_ACTIONS.has(action) ? 'unavailable' : 'allowed';
  }
}

/**
 * A limit keyed on a value the request names (an application reference, an
 * email, a school) rather than on the client, so changing IP address does
 * not reset it (audit 2026-10-23, S-3). Fails closed.
 */
async function keyedLimit(s: ReturnType<typeof db>, name: string, value: string): Promise<LimitDecision> {
  try {
    const actor = await hashedActorId(`${name}:${value}`, rateLimitSalt);
    return (await overLimit(s, `admissions_public:${name}`, actor, KEYED_LIMITS[name]!))
      ? 'limited'
      : 'allowed';
  } catch (err) {
    console.error('admissions-public keyed limiter unavailable', name, err);
    return 'unavailable';
  }
}

function limitResponse(decision: Exclude<LimitDecision, 'allowed'>): Response {
  return decision === 'limited'
    ? json({ error: 'rate_limited' }, 429)
    : json({ error: 'request_failed' }, 503);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_request' }, 400);
  }
  const action = String(body.action ?? '');
  const s = db();

  const ipDecision = await ipLimit(s, action, req);
  if (ipDecision !== 'allowed') return limitResponse(ipDecision);

  try {
    if (action === 'config') {
      const schoolId = String(body.schoolId ?? '');
      const { data: school, error: schoolError } = await s
        .from('schools')
        .select('id, name, status')
        .eq('id', schoolId)
        .maybeSingle();
      if (schoolError) return dbError(action, schoolError);
      if (!school || school.status !== 'active') return json({ error: 'not_found' }, 404);
      const [{ data: years }, { data: grades }, { data: requirements }] = await Promise.all([
        s.from('academic_years').select('id, name, start_date, is_active').eq('school_id', schoolId).order(
          'start_date',
          { ascending: false },
        ),
        s.from('grades').select('id, name, sort_order').eq('school_id', schoolId).eq('active', true).order(
          'sort_order',
        ),
        s.from('admission_document_requirements').select('id, label, description, required, grade_id').eq(
          'school_id',
          schoolId,
        ).eq('active', true).order('sort_order'),
      ]);
      return json({
        school: { id: school.id, name: school.name },
        academicYears: years ?? [],
        grades: grades ?? [],
        requirements: requirements ?? [],
      });
    }

    if (action === 'start') {
      const email = String(body.applicantEmail ?? '').trim().toLowerCase();
      const { count: recent } = await s
        .from('admission_applications')
        .select('id', { count: 'exact', head: true })
        .ilike('applicant_email', email.replace(/[%_\\]/g, (c) => `\\${c}`))
        .gt('created_at', new Date(Date.now() - 60 * 60_000).toISOString());
      if ((recent ?? 0) >= 5) return json({ error: 'rate_limited' }, 429);
      const schoolDecision = await keyedLimit(s, 'start_school', limitKey(body.schoolId));
      if (schoolDecision !== 'allowed') return limitResponse(schoolDecision);
      const { data, error } = await s.rpc('public_start_admission_application', {
        p_school_id: String(body.schoolId ?? ''),
        p_applicant_email: String(body.applicantEmail ?? ''),
        p_payload: body.payload ?? {},
      });
      if (error) return dbError(action, error);
      return json({ applicationId: data.application_id, resumeToken: data.resume_token });
    }

    if (action === 'save') {
      const { error } = await s.rpc('public_save_admission_application', {
        p_resume_token: String(body.resumeToken ?? ''),
        p_payload: body.payload ?? {},
      });
      if (error) return dbError(action, error);
      return json({ ok: true });
    }

    if (action === 'submit') {
      const { data, error } = await s.rpc('public_submit_admission_application', {
        p_resume_token: String(body.resumeToken ?? ''),
      });
      if (error) return dbError(action, error);
      return json({ referenceNumber: data.reference_number });
    }

    if (action === 'get') {
      const { data, error } = await s.rpc('public_get_admission_application', {
        p_resume_token: String(body.resumeToken ?? ''),
      });
      if (error) return dbError(action, error);
      return json(data);
    }

    if (action === 'resume') {
      const dateOfBirth = normaliseDate(body.dateOfBirth);
      if (!dateOfBirth) return json({ error: 'invalid_request' }, 400);
      // Date-of-birth guesses are capped per reference and per email, not
      // only per IP, so rotating addresses does not buy more guesses.
      for (
        const [name, value] of [['resume_reference', body.reference], ['resume_email', body.email]] as const
      ) {
        const decision = await keyedLimit(s, name, limitKey(value));
        if (decision !== 'allowed') return limitResponse(decision);
      }
      const { data, error } = await s.rpc('public_resume_admission_application', {
        p_email: String(body.email ?? ''),
        p_reference: String(body.reference ?? ''),
      });
      if (error) return dbError(action, error);
      const result = (data ?? {}) as {
        found?: boolean;
        status?: string;
        reference_number?: string;
        resume_token?: string | null;
        application?: { learner_first_name?: string | null; learner_date_of_birth?: string | null };
      };
      // References issued before 20260930121000 are sequential and guessable
      // (newer ones carry a random suffix), so the learner's date of birth is
      // required too, and a mismatch looks
      // exactly like "not found". Only the first name is returned, to confirm
      // the right application — never the full record.
      if (!result.found || normaliseDate(result.application?.learner_date_of_birth) !== dateOfBirth) {
        return json({ found: false });
      }
      return json({
        found: true,
        status: result.status,
        reference_number: result.reference_number,
        learner_first_name: result.application?.learner_first_name ?? null,
        resume_token: result.resume_token ?? null,
      });
    }

    if (action === 'upload-url') {
      const token = String(body.resumeToken ?? '');
      const { data: app, error: appError } = await s
        .from('admission_applications')
        .select('id, school_id, status')
        .eq('resume_token', token)
        .maybeSingle();
      if (appError) return dbError(action, appError);
      if (!app) return json({ error: 'not_found' }, 404);
      if (!['draft', 'incomplete', 'submitted', 'under_review'].includes(app.status)) {
        return json({ error: 'documents_closed' }, 409);
      }
      if (!isAcceptableDocument(body.mimeType, body.sizeBytes)) {
        return json({ error: 'invalid_request' }, 400);
      }
      const safeName = String(body.fileName ?? 'file').replace(/[^\w.\-]+/g, '_').slice(0, 120);
      const path = `${app.school_id}/${app.id}/${crypto.randomUUID()}-${safeName}`;
      const { data: signed, error } = await s.storage.from('admission-documents').createSignedUploadUrl(path);
      if (error) return dbError(action, error);
      return json({ uploadUrl: signed.signedUrl, path, token: signed.token });
    }

    if (action === 'register-doc') {
      const token = String(body.resumeToken ?? '');
      const { data: app, error: appError } = await s
        .from('admission_applications')
        .select('id, school_id')
        .eq('resume_token', token)
        .maybeSingle();
      if (appError) return dbError(action, appError);
      if (!app) return json({ error: 'not_found' }, 404);
      if (
        !isOwnDocumentPath(String(body.path ?? ''), app.school_id, app.id) ||
        !isAcceptableDocument(body.mimeType, body.sizeBytes)
      ) {
        return json({ error: 'invalid_request' }, 400);
      }
      const { data, error } = await s.rpc('public_register_admission_document', {
        p_resume_token: String(body.resumeToken ?? ''),
        p_label: String(body.label ?? 'Document'),
        p_storage_path: String(body.path ?? ''),
        p_mime_type: body.mimeType ? String(body.mimeType) : null,
        p_size_bytes: body.sizeBytes ? Number(body.sizeBytes) : null,
        p_requirement_id: body.requirementId ? String(body.requirementId) : null,
      });
      if (error) return dbError(action, error);
      return json({ documentId: data.document_id });
    }

    return json({ error: 'unknown_action' }, 400);
  } catch (err) {
    return dbError(action, err);
  }
});
