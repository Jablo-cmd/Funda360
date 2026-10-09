#!/usr/bin/env node
// Funda AI model-quality evaluation with a REAL provider, on SYNTHETIC data.
//
// Opt-in only. It refuses to run unless ALL of these hold:
//   * FUNDA_AI_EVAL_ALLOW_REAL_PROVIDER=synthetic-only (an explicit, written
//     approval to spend provider credits on synthetic data);
//   * ANTHROPIC_API_KEY is set in the environment (never pass it on the
//     command line; it is never printed);
//   * AUTH_URL and REST_URL point at localhost / 127.0.0.1 (a disposable
//     local stack, never production);
//   * the database holds only the synthetic fixtures (fixtures.sql +
//     funda-ai-fixtures.sql): every profile e-mail ends in ".test".
//
//   node --experimental-strip-types supabase/stack-tests/funda-ai-eval.mjs
//
// Cases, grader and thresholds: supabase/functions/_shared/ai/eval/.
// Method and how to read the results: docs/FUNDA_AI_EVALUATION.md.

import crypto from 'node:crypto';
import http from 'node:http';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const { AUTH_URL: AUTH, REST_URL: REST, ANON_KEY: ANON, SERVICE_ROLE_KEY: SERVICE } = process.env;
const DENO = process.env.DENO_BIN ?? 'deno';

function refuse(reason) {
  console.error(`Refusing to run the real-provider evaluation: ${reason}`);
  process.exit(2);
}
if (process.env.FUNDA_AI_EVAL_ALLOW_REAL_PROVIDER !== 'synthetic-only') refuse('FUNDA_AI_EVAL_ALLOW_REAL_PROVIDER is not "synthetic-only".');
if (!process.env.ANTHROPIC_API_KEY) refuse('ANTHROPIC_API_KEY is not set.');
if (!AUTH || !REST || !ANON || !SERVICE) refuse('AUTH_URL, REST_URL, ANON_KEY and SERVICE_ROLE_KEY are required.');
for (const url of [AUTH, REST]) {
  const host = new URL(url).hostname;
  if (host !== 'localhost' && host !== '127.0.0.1') refuse(`${url} is not a local stack.`);
}

const { REFERENCE_CASES, THRESHOLDS } = await import('../functions/_shared/ai/eval/cases.ts');
const { gradeResponse } = await import('../functions/_shared/ai/eval/grader.ts');

const PASSWORD = crypto.randomBytes(18).toString('base64url');
const RUN = crypto.randomBytes(4).toString('hex');
const R1 = 'ec000000-0000-0000-0000-000000000001';
const FN = 'http://127.0.0.1:8000/funda-ai';

async function request(url, { method = 'GET', token, body, apikey = ANON } = {}) {
  const res = await fetch(url, {
    method,
    headers: { apikey, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status, json };
}
const service = (path, opts = {}) => request(`${REST}${path}`, { ...opts, token: SERVICE, apikey: SERVICE });

// Synthetic data only: every profile and every Auth user must be a test
// account. Counted on the server (no paging limit can hide a row).
const nonTest = await fetch(`${REST}/profiles?select=id&or=(email.is.null,email.not.like.*.test)`, {
  headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, Prefer: 'count=exact', Range: '0-0' },
});
const total = Number((nonTest.headers.get('content-range') ?? '').split('/')[1]);
if (!nonTest.ok || !Number.isFinite(total)) refuse('could not count profiles on the local stack.');
if (total > 0) refuse(`the database holds ${total} non-test profiles; load only the synthetic fixtures.`);
for (let page = 1; ; page += 1) {
  const users = await request(`${AUTH}/admin/users?page=${page}&per_page=500`, { token: SERVICE, apikey: SERVICE });
  const list = users.json?.users;
  if (!Array.isArray(list)) refuse('could not list Auth users on the local stack.');
  const realUsers = list.filter((u) => !String(u.email ?? '').endsWith('.test'));
  if (realUsers.length > 0) refuse(`Auth holds ${realUsers.length} non-test users; load only the synthetic fixtures.`);
  if (list.length < 500) break;
}

// The function is served on port 8000 (Deno.serve's default). If something
// else already listens there, the run would grade that server and send it
// the test users' tokens: refuse instead.
const portFree = await new Promise((resolve) => {
  const probe = net.createServer();
  probe.once('error', () => resolve(false));
  probe.listen(8000, '127.0.0.1', () => probe.close(() => resolve(true)));
});
if (!portFree) refuse('port 8000 is already in use; stop whatever listens there and run again.');

async function createUser(label, role) {
  const email = `${label}.${RUN}@eval.test`;
  const created = await request(`${AUTH}/admin/users`, {
    method: 'POST', token: SERVICE, apikey: SERVICE,
    body: { email, password: PASSWORD, email_confirm: true, app_metadata: { role, tenant_id: R1 } },
  });
  await service('/profiles', { method: 'POST', body: { id: created.json.id, tenant_id: R1, first_name: label, last_name: 'Eval', email, role, status: 'active' } });
  const t = await request(`${AUTH}/token?grant_type=password`, { method: 'POST', body: { email, password: PASSWORD } });
  return t.json.access_token;
}

function startRestProxy(port) {
  const target = new URL(REST);
  const server = http.createServer((req, res) => {
    const up = http.request(
      { hostname: target.hostname, port: target.port, path: req.url.replace(/^\/rest\/v1/, ''), method: req.method, headers: req.headers },
      (u) => {
        res.writeHead(u.statusCode ?? 502, u.headers);
        u.pipe(res);
      },
    );
    up.on('error', () => {
      res.writeHead(502);
      res.end();
    });
    req.pipe(up);
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}

const proxy = /\/rest\/v1\/?$/.test(new URL(REST).pathname) ? null : await startRestProxy(54999);
const entry = fileURLToPath(new URL('../functions/funda-ai/index.ts', import.meta.url));
const env = { ...process.env };
delete env.ANTHROPIC_BASE_URL; // never redirect the provider here
const fn = spawn(DENO, ['run', '--allow-net', '--allow-env', '--allow-read', '--allow-sys', entry], {
  env: { ...env, SUPABASE_URL: proxy ? 'http://127.0.0.1:54999' : REST.replace(/\/rest\/v1\/?$/, ''), SUPABASE_ANON_KEY: ANON, SUPABASE_SERVICE_ROLE_KEY: SERVICE },
  stdio: ['ignore', 'ignore', 'ignore'],
});
let ready = false;
for (let i = 0; i < 120 && fn.exitCode === null; i += 1) {
  try {
    await fetch(FN, { method: 'OPTIONS' });
    ready = true;
    break;
  } catch {
    await new Promise((r) => setTimeout(r, 500));
  }
}
if (!ready || fn.exitCode !== null) {
  fn.kill();
  proxy?.close();
  refuse('the local funda-ai function did not start.');
}

const tokens = { principal: await createUser('eval-principal', 'principal'), teacher: await createUser('eval-teacher', 'teacher') };
const results = [];
try {
  for (const c of REFERENCE_CASES) {
    const t0 = Date.now();
    const res = await fetch(FN, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokens[c.role]}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ feature: 'copilot', message: c.question }),
    });
    const body = await res.json().catch(() => ({}));
    const g = gradeResponse(c, res.status, body);
    results.push({ id: c.id, pass: g.pass, failures: g.failures, ms: Date.now() - t0, unsupported: g.unsupportedCount });
    console.log(`${g.pass ? 'PASS' : 'FAIL'}  ${c.id}${g.pass ? '' : `  -- ${g.failures.join('; ')}`}  (${Date.now() - t0} ms)`);
  }
} finally {
  fn.kill();
  proxy?.close();
}

const passRate = results.filter((r) => r.pass).length / results.length;
const ms = results.map((r) => r.ms).sort((a, b) => a - b);
const p95 = ms[Math.min(ms.length - 1, Math.ceil(ms.length * 0.95) - 1)];
const unsupportedRate = results.filter((r) => r.unsupported > 0).length / results.length;
console.log(`\npass rate ${(passRate * 100).toFixed(0)}% (threshold ${THRESHOLDS.referenceAccuracy * 100}%), unsupported-figure rate ${(unsupportedRate * 100).toFixed(0)}%, p95 latency ${p95} ms`);
console.log('Automated checks only. Human review of wording, tone and usefulness is still required (docs/FUNDA_AI_EVALUATION.md).');
process.exit(passRate >= THRESHOLDS.referenceAccuracy && unsupportedRate <= THRESHOLDS.maxUnsupportedFigureRate && p95 <= THRESHOLDS.p95LatencyMs ? 0 : 1);
