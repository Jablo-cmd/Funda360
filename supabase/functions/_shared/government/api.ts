// HTTP adapter for the Government Data & Integration API (v1).
//
// Everything that matters for security happens in the database:
// gov_api_request() authenticates the token (SHA-256 hash lookup), checks
// revocation, expiry and the per-client rate limit, applies the client's
// scope through the same reporting functions as the dashboards, and logs the
// request. This module only turns an HTTP request into that one RPC call and
// the RPC's envelope back into an HTTP response, with a fixed error model.
//
// It never logs or echoes the bearer token, and never returns raw database
// error text.

export const MAX_BODY_BYTES = 1_048_576;
const MAX_QUERY_KEYS = 30;
const MAX_TOKEN_LENGTH = 200;
const REQUEST_ID = /^[A-Za-z0-9._:-]{8,64}$/;

export interface GovApiArgs {
  p_token: string | null;
  p_method: string;
  p_path: string;
  p_query: Record<string, string>;
  p_body: unknown;
  p_request_id: string;
}

export interface RpcResult {
  data: unknown;
  error: { message?: string; code?: string } | null;
}

export type GovApiRpc = (args: GovApiArgs) => Promise<RpcResult>;

interface Envelope {
  status: number;
  request_id?: string;
  body?: unknown;
  retry_after?: number;
  allow?: string;
}

function respond(status: number, body: unknown, requestId: string, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'x-request-id': requestId,
      ...extra,
    },
  });
}

export function errorResponse(
  status: number,
  code: string,
  message: string,
  requestId: string,
  extra: Record<string, string> = {},
): Response {
  return respond(status, { error: { code, message, request_id: requestId } }, requestId, extra);
}

/** The caller's X-Request-Id when well-formed, otherwise a fresh UUID. */
export function requestIdFrom(headers: Headers): string {
  const given = headers.get('x-request-id');
  return given && REQUEST_ID.test(given) ? given : crypto.randomUUID();
}

/** The bearer token, or null. Tokens in query strings are never accepted. */
export function bearerToken(headers: Headers): string | null {
  const value = headers.get('authorization');
  if (!value) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(value.trim());
  if (!match || match[1].length > MAX_TOKEN_LENGTH) return null;
  return match[1];
}

/**
 * The API path after the function name: "/functions/v1/government-api/v1/schools"
 * and "/government-api/v1/schools" both become "/v1/schools".
 */
export function apiPath(url: URL): string {
  const marker = '/government-api';
  const at = url.pathname.indexOf(marker);
  const rest = at >= 0 ? url.pathname.slice(at + marker.length) : url.pathname;
  return rest === '' ? '/' : rest;
}

/** Query parameters as a flat object; repeated keys or too many keys are refused. */
export function queryObject(params: URLSearchParams): Record<string, string> | null {
  const out: Record<string, string> = {};
  let count = 0;
  for (const [key, value] of params) {
    if (Object.prototype.hasOwnProperty.call(out, key)) return null;
    out[key] = value;
    count += 1;
    if (count > MAX_QUERY_KEYS) return null;
  }
  return out;
}

async function readJsonBody(req: Request): Promise<{ ok: true; body: unknown } | { ok: false; status: number; code: string; message: string }> {
  const declared = Number(req.headers.get('content-length') ?? '0');
  if (declared > MAX_BODY_BYTES) {
    return { ok: false, status: 413, code: 'payload_too_large', message: 'The request body is larger than 1 MB.' };
  }
  const text = await req.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) {
    return { ok: false, status: 413, code: 'payload_too_large', message: 'The request body is larger than 1 MB.' };
  }
  if (text.trim() === '') return { ok: true, body: null };
  const type = req.headers.get('content-type') ?? '';
  if (!/^application\/json\b/i.test(type)) {
    return { ok: false, status: 415, code: 'unsupported_media_type', message: 'Send the body as application/json.' };
  }
  try {
    return { ok: true, body: JSON.parse(text) };
  } catch {
    return { ok: false, status: 400, code: 'malformed_request', message: 'The request body is not valid JSON.' };
  }
}

export async function handleGovernmentApi(req: Request, rpc: GovApiRpc): Promise<Response> {
  const requestId = requestIdFrom(req.headers);
  const method = req.method.toUpperCase();
  if (method !== 'GET' && method !== 'POST') {
    return errorResponse(405, 'method_not_allowed', 'Only GET and POST are supported.', requestId, { allow: 'GET, POST' });
  }

  const url = new URL(req.url);
  const path = apiPath(url);
  const query = queryObject(url.searchParams);
  if (query === null) {
    return errorResponse(400, 'malformed_request', 'Query parameters may not repeat and are limited to 30.', requestId);
  }

  let body: unknown = null;
  if (method === 'POST') {
    const parsed = await readJsonBody(req);
    if (!parsed.ok) return errorResponse(parsed.status, parsed.code, parsed.message, requestId);
    body = parsed.body;
  }

  let result: RpcResult;
  try {
    result = await rpc({
      p_token: bearerToken(req.headers),
      p_method: method,
      p_path: path,
      p_query: query,
      p_body: body,
      p_request_id: requestId,
    });
  } catch (err) {
    console.error('government-api rpc failed', requestId, err instanceof Error ? err.name : 'unknown');
    return errorResponse(500, 'internal_error', 'An internal error occurred. Quote the request id when reporting it.', requestId);
  }

  const envelope = result.data as Envelope | null;
  if (result.error || !envelope || typeof envelope.status !== 'number') {
    console.error('government-api rpc error', requestId, result.error?.code ?? 'no-envelope');
    return errorResponse(500, 'internal_error', 'An internal error occurred. Quote the request id when reporting it.', requestId);
  }

  const extra: Record<string, string> = {};
  if (envelope.retry_after) extra['retry-after'] = String(envelope.retry_after);
  if (envelope.allow) extra['allow'] = envelope.allow;
  if (envelope.status === 401) extra['www-authenticate'] = 'Bearer realm="funda360-government-api"';
  return respond(envelope.status, envelope.body ?? null, envelope.request_id ?? requestId, extra);
}
