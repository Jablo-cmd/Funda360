#!/usr/bin/env node
// End-to-end security check of government reporting against a REAL Supabase
// stack: Supabase Auth issues the sessions (including the MFA "aal" claim)
// and every call goes through PostgREST exactly as the app's calls do.
//
// Run against a DISPOSABLE local stack only (it creates users, enrols MFA
// factors, revokes access and deactivates a profile):
//
//   supabase start                                    # or any throwaway project
//   psql "$DB_URL" -f supabase/stack-tests/fixtures.sql   # as a superuser
//   AUTH_URL=http://127.0.0.1:54321/auth/v1 REST_URL=http://127.0.0.1:54321/rest/v1 \
//   ANON_KEY=... SERVICE_ROLE_KEY=... node supabase/stack-tests/government-reporting.mjs
//
// Exits non-zero if any check fails. Never point it at production.

import crypto from 'node:crypto';

const AUTH = process.env.AUTH_URL;
const REST = process.env.REST_URL;
const ANON = process.env.ANON_KEY;
const SERVICE = process.env.SERVICE_ROLE_KEY;
if (!AUTH || !REST || !ANON || !SERVICE) {
  console.error('Set AUTH_URL, REST_URL, ANON_KEY and SERVICE_ROLE_KEY.');
  process.exit(2);
}

const R1 = 'ec000000-0000-0000-0000-000000000001';
const R2 = 'ec000000-0000-0000-0000-000000000002';
const R3 = 'ec000000-0000-0000-0000-000000000003';
const P1 = 'ea000000-0000-0000-0000-000000000001';
const P2 = 'ea000000-0000-0000-0000-000000000002';
const D1 = 'ea000000-0000-0000-0000-000000000011';
const D2 = 'ea000000-0000-0000-0000-000000000012';
const CLASS_R1 = 'ef000000-0000-0000-0000-000000000001';
const CLASS_R2 = 'ef000000-0000-0000-0000-000000000002';
const PASSWORD = crypto.randomBytes(18).toString('base64url');
const RUN = crypto.randomBytes(4).toString('hex');

const results = [];
function check(name, passed, detail = '') {
  results.push({ name, passed: Boolean(passed) });
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${name}${passed ? '' : `  -- ${detail}`}`);
}

async function http(url, { method = 'GET', token, body, headers = {} } = {}) {
  const res = await fetch(url, {
    method,
    headers: {
      apikey: ANON,
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
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

const service = (path, opts = {}) =>
  http(`${REST}${path}`, {
    ...opts,
    token: SERVICE,
    headers: { apikey: SERVICE, ...(opts.headers ?? {}) },
  });
const rpc = (token, fn, args = {}) =>
  http(`${REST}/rpc/${fn}`, { method: 'POST', token, body: args });
const errorOf = (r) => (r.status >= 400 ? String(r.json?.message ?? r.json) : '');
const schoolIds = (r) =>
  r.status === 200
    ? r.json.schools
        .map((s) => s.id)
        .sort()
        .join(',')
    : `HTTP ${r.status} ${errorOf(r)}`;
const claims = (token) => JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());

// RFC 6238 TOTP (SHA-1, 30 s, 6 digits) from a base32 secret.
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
  const code = ((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).toString().padStart(6, '0');
  return code;
}

async function createUser(label, role, tenantId = null) {
  const email = `${label}.${RUN}@stack.test`;
  const created = await http(`${AUTH}/admin/users`, {
    method: 'POST',
    token: SERVICE,
    headers: { apikey: SERVICE },
    body: {
      email,
      password: PASSWORD,
      email_confirm: true,
      app_metadata: { role, tenant_id: tenantId },
    },
  });
  if (created.status >= 300) throw new Error(`create ${label}: ${JSON.stringify(created.json)}`);
  const id = created.json.id;
  const profile = await service('/profiles', {
    method: 'POST',
    body: {
      id,
      tenant_id: tenantId,
      first_name: label,
      last_name: 'Stack',
      email,
      role,
      status: 'active',
    },
  });
  if (profile.status >= 300) throw new Error(`profile ${label}: ${JSON.stringify(profile.json)}`);
  return { id, email };
}

async function signIn(user) {
  const r = await http(`${AUTH}/token?grant_type=password`, {
    method: 'POST',
    body: { email: user.email, password: PASSWORD },
  });
  if (r.status !== 200) throw new Error(`sign-in ${user.email}: ${JSON.stringify(r.json)}`);
  return r.json.access_token;
}

/** Enrols a TOTP factor through Supabase Auth and returns an aal2 access token. */
async function enrolMfa(token) {
  const factor = await http(`${AUTH}/factors`, {
    method: 'POST',
    token,
    body: { factor_type: 'totp', friendly_name: `stack-${RUN}` },
  });
  if (factor.status !== 200) throw new Error(`enrol: ${JSON.stringify(factor.json)}`);
  const challenge = await http(`${AUTH}/factors/${factor.json.id}/challenge`, {
    method: 'POST',
    token,
    body: {},
  });
  const verified = await http(`${AUTH}/factors/${factor.json.id}/verify`, {
    method: 'POST',
    token,
    body: { challenge_id: challenge.json.id, code: totp(factor.json.totp.secret) },
  });
  if (verified.status !== 200) throw new Error(`verify: ${JSON.stringify(verified.json)}`);
  return verified.json.access_token;
}

async function auditCount(action, actorId) {
  const r = await service(
    `/audit_log?select=id&action=eq.${action}&actor_profile_id=eq.${actorId}`,
  );
  return Array.isArray(r.json) ? r.json.length : -1;
}

async function main() {
  // --- Accounts -----------------------------------------------------------
  const admin = await createUser('platform', 'platform_administrator');
  const offD1 = await createUser('official-d1', 'education_official');
  const offD2 = await createUser('official-d2', 'education_official');
  const offP1 = await createUser('official-p1', 'education_official');
  const owner = await createUser('owner-r1', 'school_owner', R1);
  const teacher = await createUser('teacher-r1', 'teacher', R1);
  const guardian = await createUser('guardian-r1', 'guardian', R1);

  // --- Anonymous ------------------------------------------------------------
  const anonCalls = [
    ['get_government_report', { p_filters: {} }],
    ['get_reporting_scope', {}],
    ['get_school_report', { p_school_id: R1, p_filters: {} }],
    ['get_class_learner_report', { p_class_id: CLASS_R1, p_filters: {} }],
    [
      'record_government_report_export',
      { p_report: 'school_summary', p_format: 'csv', p_filters: {} },
    ],
  ];
  for (const [fn, args] of anonCalls) {
    const r = await http(`${REST}/rpc/${fn}`, { method: 'POST', body: args });
    check(
      `anonymous caller is refused by ${fn}`,
      r.status === 401 || r.json?.code === '42501',
      `${r.status} ${errorOf(r)}`,
    );
  }

  // --- MFA ------------------------------------------------------------------
  let adminToken = await signIn(admin);
  check(
    'Supabase Auth issues an aal1 session after a password sign-in',
    claims(adminToken).aal === 'aal1',
    claims(adminToken).aal,
  );
  let r = await rpc(adminToken, 'get_government_report', { p_filters: {} });
  check(
    'platform administrator without MFA cannot read reports',
    /^mfa_required/.test(errorOf(r)),
    errorOf(r),
  );
  r = await rpc(adminToken, 'grant_education_official_access', {
    p_profile_id: offD1.id,
    p_area_id: D1,
    p_learner_detail: false,
  });
  check(
    'platform administrator without MFA cannot grant access',
    /^mfa_required/.test(errorOf(r)),
    errorOf(r),
  );
  adminToken = await enrolMfa(adminToken);
  check(
    'Supabase Auth issues an aal2 session after TOTP verification',
    claims(adminToken).aal === 'aal2',
    claims(adminToken).aal,
  );

  for (const [user, area, detail] of [
    [offD1, D1, false],
    [offD2, D2, true],
    [offP1, P1, false],
  ]) {
    r = await rpc(adminToken, 'grant_education_official_access', {
      p_profile_id: user.id,
      p_area_id: area,
      p_learner_detail: detail,
    });
    check(
      `platform administrator with MFA grants ${user.email.split('.')[0]} access`,
      r.status === 200,
      errorOf(r),
    );
  }
  r = await rpc(adminToken, 'get_government_report', { p_filters: {} });
  check(
    'platform administrator with MFA reports on every school',
    [R1, R2, R3].every((id) => schoolIds(r).includes(id)),
    schoolIds(r),
  );

  let d1 = await signIn(offD1);
  r = await rpc(d1, 'get_government_report', { p_filters: {} });
  check(
    'official without MFA cannot read the district report',
    /^mfa_required/.test(errorOf(r)),
    errorOf(r),
  );
  r = await rpc(d1, 'get_reporting_scope');
  check(
    'official without MFA cannot read their reporting scope',
    /^mfa_required/.test(errorOf(r)),
    errorOf(r),
  );
  d1 = await enrolMfa(d1);

  // --- District scoping and ID manipulation ---------------------------------
  r = await rpc(d1, 'get_government_report', { p_filters: {} });
  check(
    'district official sees only the schools in their district',
    schoolIds(r) === R1,
    schoolIds(r),
  );
  r = await rpc(d1, 'get_government_report', { p_filters: { district_id: D2 } });
  check(
    'district official cannot request an unassigned district',
    /^insufficient_privilege/.test(errorOf(r)),
    errorOf(r),
  );
  r = await rpc(d1, 'get_government_report', { p_filters: { school_id: R2 } });
  check(
    "district official cannot request another district's school id",
    /^insufficient_privilege/.test(errorOf(r)),
    errorOf(r),
  );
  r = await rpc(d1, 'get_government_report', { p_filters: { province_id: P2 } });
  check(
    'district official cannot request another province',
    /^insufficient_privilege/.test(errorOf(r)),
    errorOf(r),
  );
  r = await rpc(d1, 'get_government_report', { p_filters: { province_id: P1 } });
  check('naming the parent province does not widen access', schoolIds(r) === R1, schoolIds(r));
  r = await rpc(d1, 'get_government_report', { p_filters: { school_id: R2, district_id: D1 } });
  check(
    'mixing an allowed area with a foreign school id is refused',
    /^insufficient_privilege/.test(errorOf(r)),
    errorOf(r),
  );
  r = await rpc(d1, 'get_school_report', { p_school_id: R2, p_filters: {} });
  check(
    'school drill-down with a foreign school id is refused',
    /^insufficient_privilege/.test(errorOf(r)),
    errorOf(r),
  );
  r = await rpc(d1, 'get_class_learner_report', { p_class_id: CLASS_R2, p_filters: {} });
  check(
    'learner list with a foreign class id is refused',
    /^insufficient_privilege/.test(errorOf(r)),
    errorOf(r),
  );
  r = await rpc(d1, 'get_class_learner_report', { p_class_id: crypto.randomUUID(), p_filters: {} });
  check(
    'an unknown class id gets the same refusal',
    /^insufficient_privilege/.test(errorOf(r)),
    errorOf(r),
  );
  for (const table of [
    'learners',
    'attendance_records',
    'assessment_results',
    'schools',
    'learner_enrollments',
  ]) {
    r = await http(`${REST}/${table}?select=id&limit=5`, { token: d1 });
    check(
      `official reads no ${table} rows directly`,
      r.status === 200 && r.json.length === 0,
      `${r.status} ${JSON.stringify(r.json).slice(0, 80)}`,
    );
  }

  // --- Learner-level grant and auditing --------------------------------------
  r = await rpc(d1, 'get_class_learner_report', { p_class_id: CLASS_R1, p_filters: {} });
  check(
    'learner names need the learner-detail grant',
    /^insufficient_privilege/.test(errorOf(r)),
    errorOf(r),
  );
  let d2 = await enrolMfa(await signIn(offD2));
  const viewsBefore = await auditCount('government_report_learner_detail_viewed', offD2.id);
  r = await rpc(d2, 'get_class_learner_report', { p_class_id: CLASS_R2, p_filters: {} });
  check(
    "official with the learner-detail grant sees their own district's learners",
    r.status === 200 && r.json.learners.length === 2,
    errorOf(r),
  );
  check(
    'the learner-level view is written to the audit log',
    (await auditCount('government_report_learner_detail_viewed', offD2.id)) === viewsBefore + 1,
  );

  // --- Exports ---------------------------------------------------------------
  const exportsBefore = await auditCount('government_report_exported', offD1.id);
  r = await rpc(d1, 'record_government_report_export', {
    p_report: 'school_summary',
    p_format: 'csv',
    p_filters: { school_id: R2 },
  });
  check(
    "an export outside the official's scope is refused",
    /^insufficient_privilege/.test(errorOf(r)),
    errorOf(r),
  );
  r = await rpc(d1, 'record_government_report_export', {
    p_report: 'school_summary',
    p_format: 'pdf',
    p_filters: { district_id: D1 },
  });
  check(
    "an export inside the official's scope is accepted",
    r.status === 200 || r.status === 204,
    errorOf(r),
  );
  check(
    'exactly one export audit row was written (the refused one wrote none)',
    (await auditCount('government_report_exported', offD1.id)) === exportsBefore + 1,
  );

  // --- Province official -----------------------------------------------------
  const p1 = await enrolMfa(await signIn(offP1));
  r = await rpc(p1, 'get_government_report', { p_filters: {} });
  check(
    'province official sees every district in the province only',
    schoolIds(r) === [R1, R2].sort().join(','),
    schoolIds(r),
  );

  // --- Other roles -------------------------------------------------------------
  const ownerToken = await signIn(owner);
  r = await rpc(ownerToken, 'get_government_report', { p_filters: {} });
  check('school owner sees only their own school', schoolIds(r) === R1, schoolIds(r));
  r = await rpc(ownerToken, 'get_government_report', { p_filters: { district_id: D2 } });
  check(
    'school owner cannot request a district report',
    /^insufficient_privilege/.test(errorOf(r)),
    errorOf(r),
  );
  r = await rpc(ownerToken, 'get_government_report', { p_filters: { school_id: R2 } });
  check(
    'school owner cannot request another school',
    /^insufficient_privilege/.test(errorOf(r)),
    errorOf(r),
  );
  r = await rpc(await signIn(teacher), 'get_government_report', { p_filters: {} });
  check(
    'teacher cannot access government reports',
    /^insufficient_privilege/.test(errorOf(r)),
    errorOf(r),
  );
  r = await rpc(await signIn(guardian), 'get_government_report', { p_filters: {} });
  check(
    'guardian cannot access government reports',
    /^insufficient_privilege/.test(errorOf(r)),
    errorOf(r),
  );
  r = await rpc(await signIn(teacher), 'grant_education_official_access', {
    p_profile_id: offD1.id,
    p_area_id: D2,
    p_learner_detail: true,
  });
  check(
    'teacher cannot grant reporting access',
    /^insufficient_privilege/.test(errorOf(r)),
    errorOf(r),
  );
  r = await http(`${REST}/education_official_assignments`, {
    method: 'POST',
    token: d1,
    body: { profile_id: offD1.id, area_id: D2 },
  });
  check('official cannot write an access grant directly', r.status >= 400, `${r.status}`);

  // --- Revocation and deactivation take effect immediately --------------------
  const grants = await service(
    `/education_official_assignments?select=id&profile_id=eq.${offD2.id}&active=eq.true`,
  );
  r = await rpc(adminToken, 'revoke_education_official_access', {
    p_assignment_id: grants.json[0].id,
  });
  check(
    'platform administrator revokes an assignment',
    r.status === 200 || r.status === 204,
    errorOf(r),
  );
  r = await rpc(d2, 'get_government_report', { p_filters: {} });
  check(
    'revoked access disappears on the same session, without signing out',
    r.status === 200 && r.json.schools.length === 0,
    schoolIds(r),
  );
  r = await rpc(d2, 'get_class_learner_report', { p_class_id: CLASS_R2, p_filters: {} });
  check(
    'revoked access removes learner-level access too',
    /^insufficient_privilege/.test(errorOf(r)),
    errorOf(r),
  );

  await service(`/profiles?id=eq.${offD1.id}`, { method: 'PATCH', body: { status: 'inactive' } });
  r = await rpc(d1, 'get_government_report', { p_filters: {} });
  check(
    'deactivated official loses access on the same session',
    /^insufficient_privilege/.test(errorOf(r)),
    errorOf(r),
  );

  const failed = results.filter((x) => !x.passed).length;
  console.log(
    `\n${results.length - failed}/${results.length} checks passed against Supabase Auth + PostgREST`,
  );
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
