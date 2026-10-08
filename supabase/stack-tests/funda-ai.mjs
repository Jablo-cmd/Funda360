#!/usr/bin/env node
// End-to-end isolation test for Funda AI against a REAL Supabase stack:
// users sign in through Supabase Auth, the real funda-ai Edge Function code
// (run with Deno) authorises through ai_authorize_request() and runs every
// tool through PostgREST with the user's JWT, so RLS is the real one.
//
// The only stand-in is the model: a local mock of the Anthropic Messages API
// (ANTHROPIC_BASE_URL) that returns scripted turns and records the requests
// the real Anthropic adapter sends. The test therefore checks what DATA the
// gateway would hand a model for each user, not the model's wording.
//
// Run against a DISPOSABLE local stack only, after fixtures.sql and
// funda-ai-fixtures.sql:
//
//   AUTH_URL=http://127.0.0.1:54321/auth/v1 REST_URL=http://127.0.0.1:54321/rest/v1 \
//   ANON_KEY=... SERVICE_ROLE_KEY=... [DENO_BIN=deno] node supabase/stack-tests/funda-ai.mjs

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
const R3 = 'ec000000-0000-0000-0000-000000000003';
const L = (school, n) => `e1000000-0000-0000-0000-0000000000${school}${n}`;
const PASSWORD = crypto.randomBytes(18).toString('base64url');
const RUN = crypto.randomBytes(4).toString('hex');
const FN = 'http://127.0.0.1:8000/funda-ai';
const MOCK_PORT = 54998;
const FEB = { from: '2026-02-01', to: '2026-02-28' };
const YEAR = { from: '2026-01-01', to: '2026-10-08' };

const results = [];
function check(name, passed, detail = '') {
  results.push({ name, passed: Boolean(passed) });
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${name}${passed ? '' : `  -- ${String(detail).slice(0, 400)}`}`);
}

async function request(url, { method = 'GET', token, body, apikey = ANON, headers = {} } = {}) {
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
  return { status: res.status, json, text };
}
const service = (path, opts = {}) => request(`${REST}${path}`, { ...opts, token: SERVICE, apikey: SERVICE });
const asUser = (token, path) => request(`${REST}${path}`, { token });

async function createUser(label, role, tenantId) {
  const email = `${label}.${RUN}@stack.test`;
  const created = await request(`${AUTH}/admin/users`, {
    method: 'POST',
    token: SERVICE,
    apikey: SERVICE,
    body: { email, password: PASSWORD, email_confirm: true, app_metadata: { role, tenant_id: tenantId } },
  });
  if (created.status >= 300) throw new Error(`create ${label}: ${created.text}`);
  const profile = await service('/profiles', {
    method: 'POST',
    body: { id: created.json.id, tenant_id: tenantId, first_name: label, last_name: 'Stack', email, role, status: 'active' },
  });
  if (profile.status >= 300) throw new Error(`profile ${label}: ${profile.text}`);
  const token = await request(`${AUTH}/token?grant_type=password`, { method: 'POST', body: { email, password: PASSWORD } });
  if (token.status !== 200) throw new Error(`sign-in ${label}: ${token.text}`);
  return { id: created.json.id, token: token.json.access_token };
}

// --- Mock model -------------------------------------------------------------

const mock = { queue: [], requests: [] };
function startMockModel() {
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      const body = JSON.parse(raw || '{}');
      mock.requests.push({ path: req.url, headers: req.headers, body });
      const next = mock.queue.shift() ?? { content: [{ type: 'text', text: 'unscripted' }], stop_reason: 'end_turn' };
      res.writeHead(200, { 'Content-Type': 'application/json', 'request-id': `req_${RUN}` });
      res.end(
        JSON.stringify({
          id: `msg_${crypto.randomBytes(6).toString('hex')}`,
          type: 'message',
          role: 'assistant',
          model: body.model,
          content: next.content,
          stop_reason: next.stop_reason,
          stop_sequence: null,
          usage: { input_tokens: 120, output_tokens: 30, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
        }),
      );
    });
  });
  return new Promise((resolve) => server.listen(MOCK_PORT, '127.0.0.1', () => resolve(server)));
}

const toolUse = (name, input) => ({
  content: [{ type: 'tool_use', id: `toolu_${crypto.randomBytes(4).toString('hex')}`, name, input }],
  stop_reason: 'tool_use',
});
const final = (evidence = []) => ({
  content: [
    {
      type: 'text',
      text: JSON.stringify({
        answer: 'Summary of the data available to you.',
        evidence,
        limitations: [],
        confidence: 'medium',
        follow_up_questions: [],
        declined_actions: [],
      }),
    },
  ],
  stop_reason: 'end_turn',
});

/**
 * Asks the gateway one question while the mock model calls `tool` once.
 * Returns the gateway response and the tool result the model received.
 */
async function askWithTool(user, tool, input, feature = 'copilot') {
  const first = toolUse(tool, input);
  mock.queue = [first, final()];
  const before = mock.requests.length;
  const res = await callFunction(user.token, { feature, message: `Question ${RUN}` });
  const second = mock.requests[before + 1]?.body;
  const block = second?.messages?.at(-1)?.content?.find((b) => b.type === 'tool_result');
  const wrapped = block ? JSON.parse(typeof block.content === 'string' ? block.content : block.content[0].text) : null;
  return { res, wrapped, data: wrapped?.data ?? null, toolUseId: first.content[0].id, firstRequest: mock.requests[before]?.body };
}

async function callFunction(token, body) {
  const res = await fetch(FN, {
    method: 'POST',
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, json, text };
}

// --- Function process -------------------------------------------------------

function startRestProxy(port) {
  const target = new URL(REST);
  const server = http.createServer((req, res) => {
    const path = req.url.replace(/^\/rest\/v1/, '');
    const upstream = http.request(
      { hostname: target.hostname, port: target.port, path: `${target.pathname.replace(/\/$/, '')}${path}`, method: req.method, headers: req.headers },
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
  const entry = fileURLToPath(new URL('../functions/funda-ai/index.ts', import.meta.url));
  const child = spawn(DENO, ['run', '--allow-net', '--allow-env', '--allow-read', '--allow-sys', entry], {
    env: {
      ...process.env,
      SUPABASE_URL: supabaseUrl,
      SUPABASE_ANON_KEY: ANON,
      SUPABASE_SERVICE_ROLE_KEY: SERVICE,
      ANTHROPIC_API_KEY: 'stack-test-placeholder-not-a-real-key',
      ANTHROPIC_BASE_URL: `http://127.0.0.1:${MOCK_PORT}`,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const logs = [];
  child.stdout.on('data', (c) => logs.push(String(c)));
  child.stderr.on('data', (c) => {
    const line = String(c);
    if (!line.includes('Listening')) process.stderr.write(`[function] ${line}`);
  });
  for (let i = 0; i < 120; i += 1) {
    try {
      await fetch(FN, { method: 'OPTIONS' });
      return { child, logs };
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  child.kill();
  throw new Error('the funda-ai function did not start');
}

// --- Tests ------------------------------------------------------------------

async function main() {
  const principalA = await createUser('ai-principal-a', 'principal', R1);
  const teacherA = await createUser('ai-teacher-a', 'teacher', R1);
  const principalB = await createUser('ai-principal-b', 'principal', R2);
  const principalC = await createUser('ai-principal-c', 'principal', R3);
  const parentA = await createUser('ai-parent-a', 'parent', R1);
  const learnerA = await createUser('ai-learner-a', 'learner', R1);
  const official = await createUser('ai-official', 'education_official', null);

  // Family links: parentA is the guardian of learner 11; learnerA is learner 12.
  let r = await service('/learner_guardians', {
    method: 'POST',
    body: { school_id: R1, learner_id: L(1, 1), guardian_profile_id: parentA.id, relationship_type: 'mother', is_primary: true },
  });
  if (r.status >= 300) throw new Error(`guardian link: ${r.text}`);
  r = await service(`/learners?id=eq.${L(1, 2)}`, { method: 'PATCH', body: { profile_id: learnerA.id } });
  if (r.status >= 300) throw new Error(`learner link: ${r.text}`);

  // --- RLS baseline (direct PostgREST, no AI) -----------------------------
  r = await asUser(parentA.token, `/attendance_records?select=id&learner_id=eq.${L(1, 1)}`);
  check('baseline: a parent reads their own child\'s attendance', r.json?.length === 6, r.text);
  r = await asUser(parentA.token, `/attendance_records?select=id&learner_id=eq.${L(1, 2)}`);
  check('baseline: a parent reads nothing for another learner', Array.isArray(r.json) && r.json.length === 0, r.text);
  r = await asUser(learnerA.token, `/attendance_records?select=id&learner_id=eq.${L(1, 2)}`);
  check('baseline: a learner reads their own attendance', r.json?.length === 5, r.text);
  r = await asUser(learnerA.token, `/attendance_records?select=id&learner_id=eq.${L(1, 1)}`);
  check('baseline: a learner reads nothing for another learner', Array.isArray(r.json) && r.json.length === 0, r.text);
  r = await asUser(teacherA.token, '/safeguarding_concerns?select=id');
  check('baseline: a teacher reads no safeguarding concerns', Array.isArray(r.json) && r.json.length === 0, r.text);
  r = await asUser(principalA.token, '/safeguarding_concerns?select=id');
  check('baseline: the principal reads their school\'s safeguarding concern', r.json?.length === 1, r.text);

  // --- Through the gateway --------------------------------------------------
  const restHasPrefix = /\/rest\/v1\/?$/.test(new URL(REST).pathname);
  const proxy = restHasPrefix ? null : await startRestProxy(54999);
  const model = await startMockModel();
  const fn = await startFunction(restHasPrefix ? REST.replace(/\/rest\/v1\/?$/, '') : 'http://127.0.0.1:54999');
  try {
    r = await callFunction(null, { feature: 'copilot', message: 'hi' });
    check('no token -> 401', r.status === 401, r.text);
    r = await callFunction('not-a-jwt', { feature: 'copilot', message: 'hi' });
    check('invalid token -> 401', r.status === 401, r.text);

    // Policy gate.
    for (const [user, label, reason] of [
      [parentA, 'a parent', 'role_not_allowed'],
      [learnerA, 'a learner', 'role_not_allowed'],
      [official, 'an education official', 'role_not_allowed'],
      [principalC, 'a principal at a school without Funda AI', 'school_not_enabled'],
    ]) {
      const before = mock.requests.length;
      r = await callFunction(user.token, { feature: 'copilot', message: 'hi' });
      check(`${label} is refused (${reason}) before any model call`, r.status === 403 && r.json?.error === reason && mock.requests.length === before, r.text);
    }
    r = await callFunction(principalA.token, { feature: 'not_a_feature', message: 'hi' });
    check('an unknown feature is refused', r.status === 403 && r.json?.error === 'feature_disabled', r.text);

    // Adapter wiring: what the real Anthropic adapter sends.
    let t = await askWithTool(principalA, 'find_learners', { query: 'S1L1' });
    const sent = t.firstRequest;
    check(
      'the adapter sends model, effort, structured output and the refusal fallback',
      sent?.model === 'claude-opus-5-5' && sent?.output_config?.effort === 'medium' &&
        sent?.output_config?.format?.type === 'json_schema' && sent?.fallbacks === 'default' &&
        String(mock.requests.at(-2)?.headers['anthropic-beta']).includes('server-side-fallback-2026-07-01') &&
        sent?.thinking === undefined,
      JSON.stringify({ model: sent?.model, oc: sent?.output_config, fb: sent?.fallbacks }),
    );
    check('the user message is a user turn, never part of the system prompt',
      sent?.messages?.at(-1)?.content?.[0]?.text === `Question ${RUN}` && !JSON.stringify(sent?.system).includes(RUN), JSON.stringify(sent?.messages));
    check('the principal\'s tool list includes fees and reporting',
      ['get_learner_fee_summary', 'get_reporting_summary'].every((n) => sent?.tools?.some((x) => x.name === n)));
    check('tool output is labelled untrusted data', t.wrapped?.trust === 'untrusted_data', JSON.stringify(t.wrapped));
    check('find_learners: the principal finds their own learner',
      t.data?.learners?.some((l) => l.learner_id === L(1, 1)), JSON.stringify(t.data));
    check('find_learners returns no identity numbers or dates of birth', !/date_of_birth|id_number|2010-01-01/.test(JSON.stringify(t.data)));
    t = await askWithTool(principalA, 'find_learners', { query: 'S2L1' });
    check('find_learners: another school\'s learner is invisible', t.data?.count === 0, JSON.stringify(t.data));

    // Cross-school attendance, assessment and fee lookups.
    t = await askWithTool(principalA, 'get_learner_attendance_summary', { learner_id: L(1, 6), ...FEB });
    check('attendance: own learner (1 of 5 days present = 20%)', t.data?.records === 5 && t.data?.attendance_rate_percent === 20, JSON.stringify(t.data));
    t = await askWithTool(principalA, 'get_learner_attendance_summary', { learner_id: L(2, 1), ...FEB });
    check('attendance: a learner at another school returns no data', t.data?.data_available === false && t.data?.records === 0, JSON.stringify(t.data));
    t = await askWithTool(principalB, 'get_learner_attendance_summary', { learner_id: L(1, 1), ...FEB });
    check('attendance: school B cannot read school A', t.data?.data_available === false, JSON.stringify(t.data));

    t = await askWithTool(principalA, 'get_learner_assessment_summary', { learner_id: L(1, 6), ...YEAR });
    check('assessments: own learner (10/50 = 20%)', t.data?.overall_average_percent === 20, JSON.stringify(t.data));
    t = await askWithTool(principalB, 'get_learner_assessment_summary', { learner_id: L(1, 6), ...YEAR });
    check('assessments: school B cannot read school A', t.data?.data_available === false, JSON.stringify(t.data));

    t = await askWithTool(principalA, 'get_learner_fee_summary', { learner_id: L(1, 1) });
    check('fees: own learner (1000 charged, 250 paid, 750 outstanding, overdue)',
      t.data?.total_charged === 1000 && t.data?.outstanding_balance === 750 && t.data?.status === 'overdue', JSON.stringify(t.data));
    t = await askWithTool(principalA, 'get_learner_fee_summary', { learner_id: L(2, 1) });
    check('fees: a learner at another school returns no data', t.data?.data_available === false && t.data?.total_charged === 0, JSON.stringify(t.data));

    // Evidence verification end to end.
    const tid = toolUse('get_learner_attendance_summary', { learner_id: L(1, 6), ...FEB });
    mock.queue = [tid, final([
      { claim: 'Attendance rate', value: '20%', period: 'February 2026', source_tool_call: tid.content[0].id },
      { claim: 'Invented', value: '97%', period: 'February 2026', source_tool_call: tid.content[0].id },
    ])];
    r = await callFunction(principalA.token, { feature: 'copilot', message: 'attendance?' });
    check('evidence: a figure from the tool output is verified, an invented one is not',
      r.json?.evidence?.[0]?.verified === true && r.json?.evidence?.[1]?.verified === false && r.json?.confidence === 'low', r.text);

    // Government / reporting data.
    t = await askWithTool(principalA, 'get_reporting_summary', {});
    check('reporting: a principal sees only their own school',
      t.data?.schools?.length === 1 && t.data.schools[0].name === 'Reporting School One', JSON.stringify(t.data));
    t = await askWithTool(principalB, 'get_reporting_summary', {});
    check('reporting: school B sees only school B',
      t.data?.schools?.length === 1 && t.data.schools[0].name === 'Reporting School Two', JSON.stringify(t.data));
    t = await askWithTool(teacherA, 'get_reporting_summary', {});
    check('reporting: a teacher is refused government/reporting data', t.data?.error === 'role_not_allowed' && t.wrapped && !JSON.stringify(t.wrapped).includes('Reporting School'), JSON.stringify(t.wrapped));
    check('a teacher is not offered fee or reporting tools',
      !t.firstRequest?.tools?.some((x) => ['get_learner_fee_summary', 'get_reporting_summary'].includes(x.name)), JSON.stringify(t.firstRequest?.tools?.map((x) => x.name)));
    t = await askWithTool(teacherA, 'get_learner_fee_summary', { learner_id: L(1, 1) });
    check('fees: a teacher is refused', t.data?.error === 'role_not_allowed', JSON.stringify(t.wrapped));

    // Safeguarding.
    t = await askWithTool(teacherA, 'get_safeguarding_concerns', { learner_id: L(1, 1) });
    check('safeguarding: there is no safeguarding tool to call', t.data?.error === 'tool_not_allowed', JSON.stringify(t.wrapped));
    t = await askWithTool(principalA, 'get_safeguarding_concerns', { learner_id: L(1, 1) });
    check('safeguarding: not even a principal can reach concerns through Funda AI',
      t.data?.error === 'tool_not_allowed' && !JSON.stringify(mock.requests).includes('STACK-SAFEGUARDING-CONCERN-TEXT'), JSON.stringify(t.wrapped));

    // Family roles under a feature that admits them: tools still refuse.
    t = await askWithTool(parentA, 'get_learner_attendance_summary', { learner_id: L(1, 2), ...FEB }, 'stack_family_test');
    check('parent: no tool runs for another learner (or any learner) in Phase 1', t.data?.error === 'role_not_allowed', JSON.stringify(t.wrapped));
    check('parent: no tools are offered', (t.firstRequest?.tools ?? []).length === 0, JSON.stringify(t.firstRequest?.tools));
    t = await askWithTool(learnerA, 'get_learner_fee_summary', { learner_id: L(1, 1) }, 'stack_family_test');
    check('learner: no tool runs for another learner', t.data?.error === 'role_not_allowed', JSON.stringify(t.wrapped));

    // Prompt injection inside school data.
    t = await askWithTool(principalA, 'get_learner_assessment_summary', { learner_id: L(1, 5), ...YEAR });
    const injected = await service(`/ai_requests?select=safety_flags&user_id=eq.${principalA.id}&order=created_at.desc&limit=1`);
    check('injection text in school data is passed as data and flagged',
      JSON.stringify(t.data).includes('Ignore all previous instructions') && injected.json?.[0]?.safety_flags?.includes('injection_in_tool_data'), injected.text);

    // Safeguarding messages never reach the model.
    const before = mock.requests.length;
    r = await callFunction(teacherA.token, { feature: 'copilot', message: 'A learner told me she is being abused at home' });
    check('a safeguarding disclosure gets fixed guidance and no model call',
      r.status === 200 && r.json?.kind === 'safeguarding' && mock.requests.length === before, r.text);

    // Distributed rate limit (counted in the database, not in memory).
    const limited = await createUser('ai-rate', 'principal', R1);
    mock.queue = [final(), final()];
    const statuses = [];
    for (let i = 0; i < 3; i += 1) statuses.push((await callFunction(limited.token, { feature: 'stack_rate_test', message: 'hi' })).status);
    check('the per-user rate limit refuses the third request in a minute', statuses.join(',') === '200,200,429', statuses.join(','));

    // Audit and usage, without content.
    const reqs = await service(`/ai_requests?select=*&user_id=eq.${principalA.id}`);
    const calls = await service(`/ai_tool_calls?select=tool,status,request_id&order=created_at`);
    check('usage is recorded per request (tokens, model, prompt version)',
      reqs.json?.some((x) => x.status === 'succeeded' && x.input_tokens === 240 && x.model === 'claude-opus-5-5' && x.prompt_version === 1), reqs.text.slice(0, 400));
    check('tool calls are recorded with their outcome',
      calls.json?.some((c) => c.tool === 'get_reporting_summary' && c.status === 'denied') &&
        calls.json?.some((c) => c.tool === 'get_learner_fee_summary' && c.status === 'ok'), calls.text.slice(0, 400));
    const auditText = JSON.stringify(reqs.json) + JSON.stringify(calls.json);
    check('no question text or school data is stored in the audit tables', !auditText.includes(RUN) && !auditText.includes('Learner'), auditText.slice(0, 300));
    const conv = await service('/ai_messages?select=id');
    check('no conversation content is stored (store_content is off)', Array.isArray(conv.json) && conv.json.length === 0, conv.text);
    check('function logs carry no question text or data',
      !fn.logs.join('').includes(RUN) && !fn.logs.join('').includes('S1L1') && fn.logs.join('').includes('funda_ai.request'));

    // Users cannot forge audit rows or read others'.
    const reqId = reqs.json?.[0]?.id;
    r = await request(`${REST}/rpc/ai_complete_request`, {
      method: 'POST',
      token: principalA.token,
      body: { p_request_id: reqId, p_status: 'succeeded', p_provider: 'x', p_model: 'x', p_prompt_id: 'x', p_prompt_version: 1, p_input_tokens: 0, p_output_tokens: 0, p_estimated_cost_micros: 0, p_duration_ms: 0, p_safety_flags: [], p_error_code: null },
    });
    check('a user cannot call the service-only usage RPC', r.status >= 400, r.text);
    r = await asUser(principalB.token, `/ai_requests?select=id&user_id=eq.${principalA.id}`);
    check('a user cannot read another user\'s AI requests', Array.isArray(r.json) && r.json.length === 0, r.text);
    r = await request(`${REST}/rpc/ai_submit_feedback`, { method: 'POST', token: principalB.token, body: { p_request_id: reqId, p_rating: 'helpful' } });
    check('a user cannot give feedback on another user\'s request', r.status >= 400, r.text);
    r = await request(`${REST}/rpc/ai_submit_feedback`, { method: 'POST', token: principalA.token, body: { p_request_id: reqId, p_rating: 'problem', p_comment: 'stack test' } });
    check('a user can report a problem on their own request', r.status < 300, r.text);
  } finally {
    fn.child.kill();
    model.close();
    proxy?.close();
  }

  const failed = results.filter((x) => !x.passed).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed against Supabase Auth + PostgREST + the funda-ai function`);
  process.exit(failed ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
