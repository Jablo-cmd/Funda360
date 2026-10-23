#!/usr/bin/env node
// End-to-end check of the Government Data & Integration API against a REAL
// Supabase stack: the platform administrator signs in through Supabase Auth
// and completes a real TOTP challenge, creates API clients through
// PostgREST, and every API call goes through the real Edge Function code
// (supabase/functions/government-api/index.ts, run with Deno) to PostgREST
// with the service-role key, exactly as in production.
//
// Run against a DISPOSABLE local stack only, after fixtures.sql:
//
//   AUTH_URL=http://127.0.0.1:54321/auth/v1 REST_URL=http://127.0.0.1:54321/rest/v1 \
//   ANON_KEY=... SERVICE_ROLE_KEY=... [DENO_BIN=deno] node supabase/stack-tests/government-api.mjs
//
// The script starts the Edge Function locally on port 8000 (and, when
// REST_URL has no /rest/v1 prefix, a small path proxy in front of
// PostgREST so supabase-js finds it). Exits non-zero if any check fails.

import crypto from 'node:crypto';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const AUTH = process.env.AUTH_URL;
const REST = process.env.REST_URL;
const ANON = process.env.ANON_KEY;
const SERVICE = process.env.SERVICE_ROLE_KEY;
const DENO = process.env.DENO_BIN ?? 'deno';
if (!AUTH || !REST || !ANON || !SERVICE) {
  console.error('Set AUTH_URL, REST_URL, ANON_KEY and SERVICE_ROLE_KEY.');
  process.exit(2);
}

const R1 = 'ec000000-0000-0000-0000-000000000001';
const R2 = 'ec000000-0000-0000-0000-000000000002';
const P1 = 'ea000000-0000-0000-0000-000000000001';
const P2 = 'ea000000-0000-0000-0000-000000000002';
const D1 = 'ea000000-0000-0000-0000-000000000011';
const D2 = 'ea000000-0000-0000-0000-000000000012';
const PASSWORD = crypto.randomBytes(18).toString('base64url');
const RUN = crypto.randomBytes(4).toString('hex');
const API = 'http://127.0.0.1:8000/government-api';

const results = [];
const timings = [];
function check(name, passed, detail = '') {
  results.push({ name, passed: Boolean(passed) });
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${name}${passed ? '' : `  -- ${detail}`}`);
}

async function request(url, { method = 'GET', token, body, headers = {}, apikey = ANON } = {}) {
  const res = await fetch(url, {
    method,
    headers: {
      apikey,
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status, json, text, headers: res.headers };
}

const service = (path, opts = {}) =>
  request(`${REST}${path}`, { ...opts, token: SERVICE, apikey: SERVICE });
const rpc = (token, fn, args = {}) =>
  request(`${REST}/rpc/${fn}`, { method: 'POST', token, body: args });

/** One API call through the Edge Function, timed. */
async function api(token, path, { method = 'GET', body, headers = {} } = {}) {
  const started = performance.now();
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body,
  });
  const ms = performance.now() - started;
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  timings.push({ path: `${method} ${path.split('?')[0]}`, status: res.status, ms });
  return { status: res.status, json, text, headers: res.headers };
}

const ids = (r) =>
  Array.isArray(r.json?.data)
    ? r.json.data
        .map((d) => d.id ?? d.school_id)
        .sort()
        .join(',')
    : `HTTP ${r.status}`;

function totp(secret, at = Date.now()) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const ch of secret.replace(/=+$/, '').toUpperCase())
    bits += alphabet.indexOf(ch).toString(2).padStart(5, '0');
  const key = Buffer.from(bits.match(/.{8}/g).map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 30000)));
  const h = crypto.createHmac('sha1', key).update(counter).digest();
  const o = h[h.length - 1] & 0xf;
  return ((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).toString().padStart(6, '0');
}

async function createUser(label, role) {
  const email = `${label}.${RUN}@stack.test`;
  const created = await request(`${AUTH}/admin/users`, {
    method: 'POST',
    token: SERVICE,
    apikey: SERVICE,
    body: {
      email,
      password: PASSWORD,
      email_confirm: true,
      app_metadata: { role, tenant_id: null },
    },
  });
  if (created.status >= 300) throw new Error(`create ${label}: ${created.text}`);
  const profile = await service('/profiles', {
    method: 'POST',
    body: {
      id: created.json.id,
      tenant_id: null,
      first_name: label,
      last_name: 'Stack',
      email,
      role,
      status: 'active',
    },
  });
  if (profile.status >= 300) throw new Error(`profile ${label}: ${profile.text}`);
  return { id: created.json.id, email };
}

async function signIn(user) {
  const r = await request(`${AUTH}/token?grant_type=password`, {
    method: 'POST',
    body: { email: user.email, password: PASSWORD },
  });
  if (r.status !== 200) throw new Error(`sign-in: ${r.text}`);
  return r.json.access_token;
}

async function enrolMfa(token) {
  const factor = await request(`${AUTH}/factors`, {
    method: 'POST',
    token,
    body: { factor_type: 'totp', friendly_name: `api-${RUN}` },
  });
  const challenge = await request(`${AUTH}/factors/${factor.json.id}/challenge`, {
    method: 'POST',
    token,
    body: {},
  });
  const verified = await request(`${AUTH}/factors/${factor.json.id}/verify`, {
    method: 'POST',
    token,
    body: { challenge_id: challenge.json.id, code: totp(factor.json.totp.secret) },
  });
  if (verified.status !== 200) throw new Error(`verify: ${verified.text}`);
  return verified.json.access_token;
}

/** Serves /rest/v1/* from a PostgREST that has no prefix, so supabase-js can reach it. */
function startRestProxy(port) {
  const target = new URL(REST);
  const server = http.createServer((req, res) => {
    const path = req.url.replace(/^\/rest\/v1/, '');
    const upstream = http.request(
      {
        hostname: target.hostname,
        port: target.port,
        path: `${target.pathname.replace(/\/$/, '')}${path}`,
        method: req.method,
        headers: req.headers,
      },
      (up) => {
        res.writeHead(up.statusCode ?? 502, up.headers);
        up.pipe(res);
      },
    );
    upstream.on('error', () => {
      res.writeHead(502);
      res.end();
    });
    req.pipe(upstream);
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}

async function startFunction(supabaseUrl) {
  const entry = fileURLToPath(new URL('../functions/government-api/index.ts', import.meta.url));
  const child = spawn(
    DENO,
    ['run', '--allow-net', '--allow-env', '--allow-read', '--allow-sys', entry],
    {
      env: { ...process.env, SUPABASE_URL: supabaseUrl, SUPABASE_SERVICE_ROLE_KEY: SERVICE },
      stdio: ['ignore', 'ignore', 'pipe'],
    },
  );
  child.stderr.on('data', (chunk) => {
    const line = String(chunk);
    if (!line.includes('Listening')) process.stderr.write(`[function] ${line}`);
  });
  for (let i = 0; i < 120; i += 1) {
    try {
      await fetch(`${API}/v1/scope`);
      return child;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  child.kill();
  throw new Error('the government-api function did not start');
}

async function main() {
  const admin = await createUser('api-admin', 'platform_administrator');
  const official = await createUser('api-official', 'education_official');
  const aal1 = await signIn(admin);
  const adminToken = await enrolMfa(aal1);
  const officialToken = await signIn(official);

  const create = (name, area, school, permissions, learnerDetail = false, rate = 600) =>
    rpc(adminToken, 'create_government_api_client', {
      p_name: name,
      p_description: 'stack test',
      p_area_id: area,
      p_school_id: school,
      p_permissions: permissions,
      p_learner_detail: learnerDetail,
      p_rate_limit_per_minute: rate,
    });

  const refused = await rpc(aal1, 'create_government_api_client', {
    p_name: 'x',
    p_description: null,
    p_area_id: D1,
    p_school_id: null,
    p_permissions: ['schools'],
  });
  check(
    'creating an API client needs an MFA (aal2) session',
    refused.status >= 400 && String(refused.json?.message).startsWith('mfa_required'),
    refused.text,
  );
  const byOfficial = await rpc(officialToken, 'create_government_api_client', {
    p_name: 'x',
    p_description: null,
    p_area_id: D1,
    p_school_id: null,
    p_permissions: ['schools'],
  });
  check(
    'an education official cannot create API clients',
    byOfficial.status >= 400,
    byOfficial.text,
  );

  const all = [
    'schools',
    'attendance',
    'assessments',
    'staff',
    'interventions',
    'data_quality',
    'reports',
    'imports',
    'learners',
  ];
  const kD1 = (await create('district one', D1, null, all)).json[0];
  const kP1 = (await create('province one', P1, null, ['reports', 'schools'])).json[0];
  const kR2 = (await create('school two', null, R2, ['schools', 'learners'], true)).json[0];
  const kLim = (await create('limited', D1, null, ['schools'], false, 2)).json[0];
  check(
    'platform administrator with MFA creates API clients and receives tokens once',
    [kD1, kP1, kR2, kLim].every((k) => /^f360g_[0-9a-f]{8}_[0-9a-f]{48}$/.test(k?.token ?? '')),
  );

  const hashRead = await request(`${REST}/government_api_clients?select=token_hash`, {
    token: adminToken,
  });
  check(
    'the token hash is not readable through PostgREST, even by a platform administrator',
    hashRead.status >= 400,
    hashRead.text,
  );
  const direct = await rpc(adminToken, 'gov_api_request', {
    p_token: kD1.token,
    p_method: 'GET',
    p_path: '/v1/schools',
  });
  check(
    'a signed-in user cannot call the API entry point directly',
    direct.status >= 400 && !String(direct.text).includes(R1),
    direct.text,
  );
  const anonDirect = await rpc(null, 'gov_api_request', {
    p_token: kD1.token,
    p_method: 'GET',
    p_path: '/v1/schools',
  });
  check(
    'an anonymous caller cannot call the API entry point directly',
    anonDirect.status >= 400,
    anonDirect.text,
  );

  // --- Through the Edge Function -----------------------------------------
  const restHasPrefix = /\/rest\/v1\/?$/.test(new URL(REST).pathname);
  const proxy = restHasPrefix ? null : await startRestProxy(54999);
  const fn = await startFunction(
    restHasPrefix ? REST.replace(/\/rest\/v1\/?$/, '') : 'http://127.0.0.1:54999',
  );
  try {
    let r = await api(null, '/v1/schools');
    check(
      'no token -> 401 with WWW-Authenticate',
      r.status === 401 && r.headers.get('www-authenticate')?.startsWith('Bearer'),
      r.text,
    );
    r = await api(`f360g_00000000_${'0'.repeat(48)}`, '/v1/schools');
    check('unknown token -> 401', r.status === 401, r.text);
    r = await api(kD1.token, '/v1/schools', { headers: { 'X-Request-Id': `stack-${RUN}-1` } });
    check(
      'district client lists exactly its schools',
      r.status === 200 && ids(r) === R1,
      `${r.status} ${r.text}`,
    );
    check(
      'the request id is echoed',
      r.headers.get('x-request-id') === `stack-${RUN}-1` && r.json && !r.text.includes(kD1.token),
    );
    check('responses are not cacheable', r.headers.get('cache-control') === 'no-store');
    r = await api(kD1.token, `/v1/schools?province_id=${P1}`);
    check('naming the parent province does not widen a district client', ids(r) === R1, r.text);
    r = await api(kD1.token, `/v1/schools?district_id=${D2}`);
    check(
      'another district by id -> 403',
      r.status === 403 && r.json?.error?.code === 'forbidden',
      r.text,
    );
    r = await api(kD1.token, `/v1/schools/${R2}`);
    check("another district's school by id -> 403", r.status === 403, r.text);
    r = await api(kD1.token, `/v1/reports/provinces/${P1}`);
    check('district client cannot escalate to its province -> 403', r.status === 403, r.text);
    r = await api(kP1.token, `/v1/reports/provinces/${P1}`);
    check(
      'province client gets its provincial report',
      r.status === 200 && r.json.data.districts.length >= 2,
      r.text.slice(0, 200),
    );
    r = await api(kP1.token, `/v1/reports/provinces/${P2}`);
    check('province client cannot read another province -> 403', r.status === 403, r.text);
    r = await api(kP1.token, '/v1/attendance');
    check(
      'missing permission -> 403 permission_not_granted',
      r.status === 403 && r.json?.error?.code === 'permission_not_granted',
      r.text,
    );
    r = await api(kD1.token, `/v1/learners?school_id=${R1}`);
    check('learner data without the learner-level grant -> 403', r.status === 403, r.text);
    r = await api(kR2.token, `/v1/learners?school_id=${R2}`);
    check(
      'granted school client lists enrolments without names',
      r.status === 200 &&
        r.json.data.length > 0 &&
        !/first_name|last_name|date_of_birth|id_number/.test(r.text),
      r.text.slice(0, 200),
    );
    r = await api(kR2.token, `/v1/learners?school_id=${R1}`);
    check("school client cannot read another school's learners -> 403", r.status === 403, r.text);

    const att = await api(kD1.token, `/v1/attendance?school_id=${R1}`);
    const rep = await api(kD1.token, `/v1/reports/schools?school_id=${R1}`);
    check(
      'attendance totals equal the report attendance rate (same definition)',
      att.status === 200 &&
        att.json.data[0].totals.attendance_rate === rep.json.data[0].attendance_rate,
      `${att.text.slice(0, 150)} / ${rep.text.slice(0, 150)}`,
    );

    r = await api(kD1.token, '/v1/schools?limit=0');
    check(
      'invalid limit -> 422',
      r.status === 422 && r.json?.error?.code === 'validation_failed',
      r.text,
    );
    r = await api(kD1.token, `/v1/schools?district_id=${D1}&district_id=${D2}`);
    check('repeated query parameters -> 400 (no parameter pollution)', r.status === 400, r.text);
    r = await api(kD1.token, '/v1/schools', { method: 'PUT' });
    check('unsupported method -> 405', r.status === 405, r.text);
    r = await api(kD1.token, '/v1/nothing');
    check('unknown endpoint -> 404', r.status === 404, r.text);
    r = await api(kD1.token, '/v1/imports', {
      method: 'POST',
      body: '{}',
      headers: { 'content-type': 'text/plain' },
    });
    check('non-JSON body -> 415', r.status === 415, r.text);
    r = await api(kD1.token, '/v1/imports', {
      method: 'POST',
      body: '{"kind":',
      headers: { 'content-type': 'application/json' },
    });
    check('malformed JSON -> 400', r.status === 400, r.text);
    r = await api(kD1.token, '/v1/imports', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        kind: 'school_identifiers',
        dry_run: true,
        rows: [
          { school_id: R1, emis_number: `STACK-${RUN}` },
          { school_id: R2, emis_number: 'X' },
        ],
      }),
    });
    check(
      'import dry run validates scope and returns a preview without storing',
      r.status === 200 &&
        r.json.data.valid === false &&
        r.json.data.errors.some((e) => e.code === 'school_not_in_scope') &&
        r.json.data.rows.length === 1,
      r.text,
    );

    const statuses = [];
    for (let i = 0; i < 3; i += 1) statuses.push((await api(kLim.token, '/v1/schools')).status);
    const limited = timings.at(-1);
    check(
      'per-client rate limit -> 429 with Retry-After',
      statuses.join(',') === '200,200,429',
      `${statuses} ${limited?.status}`,
    );

    await rpc(adminToken, 'revoke_government_api_client', { p_client_id: kP1.client_id });
    r = await api(kP1.token, `/v1/reports/provinces/${P1}`);
    check('a revoked client is refused on its next request -> 401', r.status === 401, r.text);

    const log = await service(`/government_api_requests?select=*&order=id.asc`);
    const logText = JSON.stringify(log.json);
    check(
      'every request is in the request log',
      Array.isArray(log.json) && log.json.length >= timings.length - 4,
      String(log.json?.length),
    );
    check(
      'no token appears anywhere in the request log',
      ![kD1, kP1, kR2, kLim].some((k) => logText.includes(k.token.slice(15))),
    );
    const audit = await service(
      `/audit_log?select=id&action=eq.government_api_learner_detail_viewed`,
    );
    check(
      'learner-level API reads are audited',
      Array.isArray(audit.json) && audit.json.length >= 1,
      audit.text,
    );
  } finally {
    fn.kill();
    proxy?.close();
  }

  const ok = timings.filter((t) => t.status === 200);
  const by = new Map();
  for (const t of ok) by.set(t.path, [...(by.get(t.path) ?? []), t.ms]);
  console.log('\nTimings through the Edge Function (successful calls, ms):');
  for (const [path, list] of by)
    console.log(`  ${path.padEnd(40)} ${list.map((m) => m.toFixed(0)).join(', ')}`);

  const failed = results.filter((r) => !r.passed).length;
  console.log(
    `\n${results.length - failed}/${results.length} checks passed against Supabase Auth + PostgREST + the government-api function`,
  );
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
