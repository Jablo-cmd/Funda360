import { assert, assertEquals } from 'jsr:@std/assert@1';
import {
  apiPath,
  bearerToken,
  type GovApiArgs,
  handleGovernmentApi,
  MAX_BODY_BYTES,
  queryObject,
  requestIdFrom,
  type RpcResult,
} from './api.ts';

const TOKEN = 'f360g_0123abcd_' + 'a'.repeat(48);
const BASE = 'https://x.supabase.co/functions/v1/government-api';

function recordingRpc(result: RpcResult) {
  const calls: GovApiArgs[] = [];
  const rpc = (args: GovApiArgs) => {
    calls.push(args);
    return Promise.resolve(result);
  };
  return { calls, rpc };
}

const ok = (body: unknown, extra: Record<string, unknown> = {}): RpcResult => ({
  data: { status: 200, request_id: 'req-12345678', body, ...extra },
  error: null,
});

Deno.test('apiPath strips the function prefix in both URL shapes', () => {
  assertEquals(apiPath(new URL(`${BASE}/v1/schools`)), '/v1/schools');
  assertEquals(apiPath(new URL('http://localhost/government-api/v1/schools/abc')), '/v1/schools/abc');
  assertEquals(apiPath(new URL(BASE)), '/');
});

Deno.test('bearerToken accepts only a Bearer header', () => {
  assertEquals(bearerToken(new Headers({ authorization: `Bearer ${TOKEN}` })), TOKEN);
  assertEquals(bearerToken(new Headers({ authorization: `bearer ${TOKEN}` })), TOKEN);
  assertEquals(bearerToken(new Headers({ authorization: `Basic ${TOKEN}` })), null);
  assertEquals(bearerToken(new Headers({ authorization: `Bearer ${'x'.repeat(201)}` })), null);
  assertEquals(bearerToken(new Headers()), null);
});

Deno.test('requestIdFrom keeps a well-formed id and replaces anything else', () => {
  assertEquals(requestIdFrom(new Headers({ 'x-request-id': 'abc-12345' })), 'abc-12345');
  const generated = requestIdFrom(new Headers({ 'x-request-id': 'bad id <script>' }));
  assert(/^[0-9a-f-]{36}$/.test(generated));
});

Deno.test('queryObject refuses repeated keys (no parameter pollution)', () => {
  assertEquals(queryObject(new URLSearchParams('a=1&b=2')), { a: '1', b: '2' });
  assertEquals(queryObject(new URLSearchParams('district_id=1&district_id=2')), null);
  const many = new URLSearchParams(Array.from({ length: 31 }, (_, i) => [`k${i}`, 'v']));
  assertEquals(queryObject(many), null);
});

Deno.test('a GET is forwarded as one RPC call with token, path, query and request id', async () => {
  const { calls, rpc } = recordingRpc(ok({ data: [] }));
  const res = await handleGovernmentApi(
    new Request(`${BASE}/v1/schools?district_id=d1&limit=10`, {
      headers: { authorization: `Bearer ${TOKEN}`, 'x-request-id': 'client-req-1' },
    }),
    rpc,
  );
  assertEquals(res.status, 200);
  assertEquals(calls.length, 1);
  assertEquals(calls[0], {
    p_token: TOKEN,
    p_method: 'GET',
    p_path: '/v1/schools',
    p_query: { district_id: 'd1', limit: '10' },
    p_body: null,
    p_request_id: 'client-req-1',
  });
  assertEquals(res.headers.get('cache-control'), 'no-store');
  assertEquals(res.headers.get('x-request-id'), 'req-12345678');
  assertEquals(res.headers.get('access-control-allow-origin'), null, 'no CORS: server-to-server only');
});

Deno.test('the token is never echoed back', async () => {
  const { rpc } = recordingRpc({
    data: { status: 401, request_id: 'r-1234567', body: { error: { code: 'unauthenticated', message: 'x', request_id: 'r-1234567' } } },
    error: null,
  });
  const res = await handleGovernmentApi(new Request(`${BASE}/v1/schools`, { headers: { authorization: `Bearer ${TOKEN}` } }), rpc);
  const text = await res.text();
  assertEquals(res.status, 401);
  assert(!text.includes(TOKEN));
  assertEquals(res.headers.get('www-authenticate'), 'Bearer realm="funda360-government-api"');
});

Deno.test('rate-limit and method envelopes become Retry-After and Allow headers', async () => {
  const limited = recordingRpc({
    data: { status: 429, request_id: 'r-1234567', retry_after: 60, body: { error: { code: 'rate_limited' } } },
    error: null,
  });
  const res = await handleGovernmentApi(new Request(`${BASE}/v1/schools`), limited.rpc);
  assertEquals(res.status, 429);
  assertEquals(res.headers.get('retry-after'), '60');

  const wrong = recordingRpc({ data: { status: 405, allow: 'GET', body: { error: { code: 'method_not_allowed' } } }, error: null });
  const res2 = await handleGovernmentApi(new Request(`${BASE}/v1/schools`, { method: 'POST' }), wrong.rpc);
  assertEquals(res2.status, 405);
  assertEquals(res2.headers.get('allow'), 'GET');
});

Deno.test('unsupported HTTP methods are refused without calling the database', async () => {
  for (const method of ['PUT', 'PATCH', 'DELETE', 'OPTIONS']) {
    const { calls, rpc } = recordingRpc(ok({}));
    const res = await handleGovernmentApi(new Request(`${BASE}/v1/schools`, { method }), rpc);
    assertEquals(res.status, 405);
    assertEquals(calls.length, 0);
  }
});

Deno.test('malformed requests get 400/413/415 without calling the database', async () => {
  const cases: [Request, number, string][] = [
    [new Request(`${BASE}/v1/schools?a=1&a=2`), 400, 'malformed_request'],
    [
      new Request(`${BASE}/v1/imports`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{not json' }),
      400,
      'malformed_request',
    ],
    [new Request(`${BASE}/v1/imports`, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: '{}' }), 415, 'unsupported_media_type'],
    [
      new Request(`${BASE}/v1/imports`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ rows: 'x'.repeat(MAX_BODY_BYTES) }),
      }),
      413,
      'payload_too_large',
    ],
  ];
  for (const [req, status, code] of cases) {
    const { calls, rpc } = recordingRpc(ok({}));
    const res = await handleGovernmentApi(req, rpc);
    assertEquals(res.status, status);
    assertEquals((await res.json()).error.code, code);
    assertEquals(calls.length, 0);
  }
});

Deno.test('a JSON body is parsed and forwarded on POST', async () => {
  const { calls, rpc } = recordingRpc({ data: { status: 201, body: { data: { id: 'j1' } } }, error: null });
  const res = await handleGovernmentApi(
    new Request(`${BASE}/v1/imports`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({ kind: 'school_identifiers', dry_run: true, rows: [] }),
    }),
    rpc,
  );
  assertEquals(res.status, 201);
  assertEquals(calls[0].p_body, { kind: 'school_identifiers', dry_run: true, rows: [] });
});

Deno.test('database errors become a generic 500 without internals', async () => {
  const { rpc } = recordingRpc({ data: null, error: { message: 'relation "public.secret_table" does not exist', code: '42P01' } });
  const res = await handleGovernmentApi(new Request(`${BASE}/v1/schools`), rpc);
  const text = await res.text();
  assertEquals(res.status, 500);
  assert(!text.includes('secret_table'));
  assert(JSON.parse(text).error.request_id);

  const throwing = (_: GovApiArgs): Promise<RpcResult> => Promise.reject(new Error('connection refused to 10.0.0.5'));
  const res2 = await handleGovernmentApi(new Request(`${BASE}/v1/schools`), throwing);
  assertEquals(res2.status, 500);
  assert(!(await res2.text()).includes('10.0.0.5'));
});
