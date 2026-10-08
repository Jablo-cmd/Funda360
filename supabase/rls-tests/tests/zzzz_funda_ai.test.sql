-- Regression suite for 20261011090000_funda_ai_foundation.sql.
--
-- Part 1 tests the AI control plane (policy gate, flags, rate limits,
-- budgets, audit rows, service-only writes, conversations, feedback, admin).
-- Part 2 runs the exact queries the funda-ai data tools issue, as each kind
-- of user, to prove the AI inherits RLS: cross-school, parent, learner and
-- safeguarding isolation. (supabase/stack-tests/funda-ai.test.ts runs the
-- real tool code through PostgREST for the same cases.)
--
-- Fixtures used: School A (aaaa…) and School B (bbbb…); teacher A 1111,
-- owner A 2222, teacher B 3333, platform admin 4444, parent 5555 for the
-- policy gate; dedicated learners and family accounts below for Part 2. Uses test_util.gr_call from
-- zz_government_reporting.test.sql.

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------

-- Dedicated learners and family accounts (earlier suites move the shared
-- fixture learners between classes and schools):
--   LA1 a1a1…01 School A, child of parent PA (a1a1…f1)
--   LA2 a1a1…02 School A, has its own learner login LS (a1a1…f2)
--   LB1 a1a1…03 School B
insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data) values
  ('00000000-0000-0000-0000-000000000000', 'a1a10000-0000-0000-0000-0000000000f1', 'authenticated', 'authenticated',
   'ai.parent@schoola.test', jsonb_build_object('role', 'parent', 'tenant_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')),
  ('00000000-0000-0000-0000-000000000000', 'a1a10000-0000-0000-0000-0000000000f2', 'authenticated', 'authenticated',
   'ai.learner@schoola.test', jsonb_build_object('role', 'learner', 'tenant_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'));
insert into public.profiles (id, tenant_id, first_name, last_name, email, role, status) values
  ('a1a10000-0000-0000-0000-0000000000f1', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'AI', 'Parent', 'ai.parent@schoola.test', 'parent', 'active'),
  ('a1a10000-0000-0000-0000-0000000000f2', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'AI', 'Learner', 'ai.learner@schoola.test', 'learner', 'active');

insert into public.learners (id, school_id, learner_number, admission_number, first_name, last_name, date_of_birth, status, admission_date) values
  ('a1a10000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'AI-A1', 'AI-ADM-A1', 'Ayanda', 'Aione', '2008-02-01', 'active', '2024-01-15'),
  ('a1a10000-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'AI-A2', 'AI-ADM-A2', 'Busi', 'Aitwo', '2008-03-01', 'active', '2024-01-15'),
  ('a1a10000-0000-0000-0000-000000000003', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'AI-B1', 'AI-ADM-B1', 'Cebo', 'Bione', '2008-04-01', 'active', '2024-01-15');
update public.learners set profile_id = 'a1a10000-0000-0000-0000-0000000000f2' where id = 'a1a10000-0000-0000-0000-000000000002';
insert into public.learner_guardians (school_id, learner_id, guardian_profile_id, relationship_type, is_primary) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a1a10000-0000-0000-0000-000000000001', 'a1a10000-0000-0000-0000-0000000000f1', 'mother', true);

insert into public.learner_enrollments (school_id, learner_id, academic_year_id, grade_id, class_id, enrollment_date) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a1a10000-0000-0000-0000-000000000001', 'aaaa1111-0000-0000-0000-000000000001',
   'aaaa2222-0000-0000-0000-000000000001', 'cccc1111-0000-0000-0000-000000000001', '2026-01-15'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a1a10000-0000-0000-0000-000000000002', 'aaaa1111-0000-0000-0000-000000000001',
   'aaaa2222-0000-0000-0000-000000000001', 'cccc1111-0000-0000-0000-000000000001', '2026-01-15'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'a1a10000-0000-0000-0000-000000000003', 'bbbb1111-0000-0000-0000-000000000001',
   'cafe2222-0000-0000-0000-000000000001', 'cccc2222-0000-0000-0000-000000000001', '2026-01-15');

insert into public.attendance_records (school_id, academic_year_id, class_id, learner_id, attendance_date, status) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaa1111-0000-0000-0000-000000000001', 'cccc1111-0000-0000-0000-000000000001',
   'a1a10000-0000-0000-0000-000000000001', '2026-03-02', 'present'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaa1111-0000-0000-0000-000000000001', 'cccc1111-0000-0000-0000-000000000001',
   'a1a10000-0000-0000-0000-000000000001', '2026-03-03', 'absent'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaa1111-0000-0000-0000-000000000001', 'cccc1111-0000-0000-0000-000000000001',
   'a1a10000-0000-0000-0000-000000000002', '2026-03-02', 'present'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'bbbb1111-0000-0000-0000-000000000001', 'cccc2222-0000-0000-0000-000000000001',
   'a1a10000-0000-0000-0000-000000000003', '2026-03-02', 'present');

insert into public.learner_fee_charges (school_id, learner_id, academic_year_id, description, amount) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a1a10000-0000-0000-0000-000000000001', 'aaaa1111-0000-0000-0000-000000000001', 'AI test fee A1', 100),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'a1a10000-0000-0000-0000-000000000003', 'bbbb1111-0000-0000-0000-000000000001', 'AI test fee B1', 200);

insert into public.safeguarding_concerns (school_id, learner_id, description) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a1a10000-0000-0000-0000-000000000001', 'AI test concern (restricted)');

-- Runs p_sql as the service role (the funda-ai Edge Function).
create or replace function test_util.ai_service(p_sql text)
returns jsonb
language plpgsql
as $$
declare
  v jsonb;
  v_err text;
begin
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  execute 'set local role service_role';
  begin
    execute p_sql into v;
  exception when others then
    get stacked diagnostics v_err = message_text;
    v := jsonb_build_object('error', v_err);
  end;
  execute 'reset role';
  return coalesce(v, 'null'::jsonb);
end;
$$;

create or replace function test_util.ai_authorize(p_uid uuid, p_role text, p_tenant uuid, p_chars integer default 50)
returns jsonb
language sql
as $$
  select test_util.gr_call(p_uid, p_role, p_tenant, format('select public.ai_authorize_request(''copilot'', %s)', p_chars))
$$;

-- ---------------------------------------------------------------------------
-- Part 1: control plane
-- ---------------------------------------------------------------------------

do $$
declare
  v jsonb;
  v_err text;
  v_reason text;
  v_blocked int;
begin
  -- Off by default.
  v := test_util.ai_authorize('11111111-1111-1111-1111-111111111111', 'teacher', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  call test_util.record('ai: Funda AI is off by default (feature_disabled)', v ->> 'reason' = 'feature_disabled', v::text);
  select count(*) into v_blocked from public.ai_requests where status = 'blocked' and block_reason = 'feature_disabled';
  call test_util.record('ai: blocked requests are audited', v_blocked = 1, v_blocked::text);

  perform set_config('request.jwt.claims', '{}', true);
  set local role anon;
  begin
    perform public.ai_authorize_request('copilot', 10);
    v_err := 'executed';
  exception when others then
    get stacked diagnostics v_err = message_text;
  end;
  reset role;
  call test_util.record('ai: anonymous callers cannot reach the AI gate', v_err like 'permission denied%', v_err);

  update public.ai_features set enabled = true where key = 'copilot';

  v := test_util.ai_authorize('11111111-1111-1111-1111-111111111111', 'teacher', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  call test_util.record('ai: a feature on globally still needs the school enabled', v ->> 'reason' = 'school_not_enabled', v::text);

  insert into public.ai_school_settings (school_id, enabled) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);

  v := test_util.ai_authorize('11111111-1111-1111-1111-111111111111', 'teacher', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  call test_util.record('ai: an allowed role in an enabled school is authorised with its own school and role',
    (v ->> 'allowed')::boolean and v -> 'principal' ->> 'school_id' = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
      and v -> 'principal' ->> 'role' = 'teacher' and v -> 'policy' -> 'allowed_tools' ? 'get_learner_attendance_summary',
    v::text);

  v := test_util.ai_authorize('33333333-3333-3333-3333-333333333333', 'teacher', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
  call test_util.record('ai: enabling school A does not enable school B', v ->> 'reason' = 'school_not_enabled', v::text);

  v := test_util.ai_authorize('55555555-5555-5555-5555-555555555555', 'parent', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  call test_util.record('ai: a role not in the feature policy is refused', v ->> 'reason' = 'role_not_allowed', v::text);

  -- A forged JWT role is not enough when the school does not match: the
  -- school always comes from the caller's own active profile.
  v := test_util.ai_authorize('33333333-3333-3333-3333-333333333333', 'teacher', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  call test_util.record('ai: the school comes from the profile, not from the token''s tenant claim',
    v ->> 'reason' = 'school_not_enabled', v::text);

  v := test_util.ai_authorize('44444444-4444-4444-4444-444444444444', 'platform_administrator', null);
  call test_util.record('ai: platform administrators are not allowed by default', v ->> 'reason' = 'role_not_allowed', v::text);
  update public.ai_features set allowed_roles = array_append(allowed_roles, 'platform_administrator') where key = 'copilot';
  v := test_util.ai_authorize('44444444-4444-4444-4444-444444444444', 'platform_administrator', null);
  call test_util.record('ai: a caller without a school is refused unless the feature allows it',
    v ->> 'reason' = 'school_context_required', v::text);
  update public.ai_features set allowed_roles = array_remove(allowed_roles, 'platform_administrator') where key = 'copilot';

  v := test_util.ai_authorize('e0000000-0000-0000-0000-000000000006', 'education_official', null);
  call test_util.record('ai: an inactive profile is refused', v ->> 'reason' = 'profile_inactive', v::text);

  v := test_util.ai_authorize('11111111-1111-1111-1111-111111111111', 'teacher', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 999999);
  call test_util.record('ai: input over the policy size is refused', v ->> 'reason' = 'input_too_large', v::text);

  v := test_util.gr_call('11111111-1111-1111-1111-111111111111', 'teacher', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'select public.ai_authorize_request(''no_such_feature'', 10)');
  call test_util.record('ai: unknown features are refused', v ->> 'reason' = 'feature_disabled', v::text);

  v := test_util.gr_call('11111111-1111-1111-1111-111111111111', 'teacher', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'select public.ai_my_features()');
  call test_util.record('ai: an enabled user sees the feature in their launcher list',
    jsonb_array_length(v) = 1 and v -> 0 ->> 'key' = 'copilot' and not (v -> 0 ? 'allowed_tools'), v::text);
  v := test_util.gr_call('33333333-3333-3333-3333-333333333333', 'teacher', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'select public.ai_my_features()');
  call test_util.record('ai: a user in a school without AI sees no features', v::text = '[]', v::text);
  v := test_util.gr_call('55555555-5555-5555-5555-555555555555', 'parent', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'select public.ai_my_features()');
  call test_util.record('ai: a role outside the policy sees no features', v::text = '[]', v::text);
end $$;

-- Rate limits and budgets.
do $$
declare
  v jsonb;
  v_reasons text := '';
begin
  delete from public.ai_requests;
  update public.ai_features set user_requests_per_minute = 3 where key = 'copilot';
  for i in 1..4 loop
    v := test_util.ai_authorize('11111111-1111-1111-1111-111111111111', 'teacher', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    v_reasons := v_reasons || coalesce(v ->> 'reason', 'ok') || ' ';
  end loop;
  call test_util.record('ai: the per-user rate limit is enforced in the database', v_reasons = 'ok ok ok rate_limited ', v_reasons);

  v := test_util.ai_authorize('22222222-2222-2222-2222-222222222222', 'school_owner', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  call test_util.record('ai: one user''s limit does not block another user', (v ->> 'allowed')::boolean, v::text);

  update public.ai_features set user_requests_per_minute = 60, school_requests_per_day = 4 where key = 'copilot';
  v := test_util.ai_authorize('22222222-2222-2222-2222-222222222222', 'school_owner', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  call test_util.record('ai: the per-school daily limit is enforced', v ->> 'reason' = 'rate_limited', v::text);

  delete from public.ai_requests;
  update public.ai_features set school_requests_per_day = 3000 where key = 'copilot';
  update public.ai_school_settings set monthly_token_budget = 100 where school_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  insert into public.ai_requests (user_id, school_id, role, feature, status, input_tokens, output_tokens)
  values ('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'school_owner', 'copilot', 'succeeded', 80, 40);
  v := test_util.ai_authorize('11111111-1111-1111-1111-111111111111', 'teacher', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  call test_util.record('ai: the school''s monthly token budget is enforced', v ->> 'reason' = 'budget_exhausted', v::text);
  update public.ai_school_settings set monthly_token_budget = null where school_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
end $$;

-- Audit rows, service-only writes, feedback, conversations.
do $$
declare
  v jsonb;
  v_req uuid;
  v_req_b uuid;
  v_conv uuid;
  v_err text;
  v_n int;
begin
  v := test_util.ai_authorize('11111111-1111-1111-1111-111111111111', 'teacher', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  v_req := (v ->> 'request_id')::uuid;

  v := test_util.gr_call('11111111-1111-1111-1111-111111111111', 'teacher', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'select to_jsonb(count(*)) from public.ai_requests where user_id <> ''11111111-1111-1111-1111-111111111111''');
  call test_util.record('ai: users see only their own AI request rows', v::text = '0', v::text);
  v := test_util.gr_call('33333333-3333-3333-3333-333333333333', 'teacher', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    format('select to_jsonb(count(*)) from public.ai_requests where id = %L', v_req));
  call test_util.record('ai: another school''s user cannot see the request', v::text = '0', v::text);
  v := test_util.gr_call('44444444-4444-4444-4444-444444444444', 'platform_administrator', null,
    format('select to_jsonb(count(*)) from public.ai_requests where id = %L', v_req));
  call test_util.record('ai: platform administrators can audit AI requests', v::text = '1', v::text);

  v := test_util.gr_call('11111111-1111-1111-1111-111111111111', 'teacher', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'with i as (insert into public.ai_requests (user_id, role, feature, status) values (''11111111-1111-1111-1111-111111111111'', ''teacher'', ''copilot'', ''succeeded'') returning 1) select to_jsonb(count(*)) from i');
  call test_util.record('ai: users cannot write AI audit rows directly', v ->> 'error' like 'permission denied%', v::text);

  v := test_util.gr_call('11111111-1111-1111-1111-111111111111', 'teacher', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    format('select to_jsonb(public.ai_complete_request(%L, ''succeeded'', ''x'', ''x'', null, 1, 0, 0, null, 1, null, null))', v_req));
  call test_util.record('ai: users cannot report their own usage (completion is service-only)', v ->> 'error' like 'permission denied%', v::text);
  v := test_util.gr_call('11111111-1111-1111-1111-111111111111', 'teacher', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    format('select to_jsonb(public.ai_record_tool_call(%L, ''x'', ''ok'', 1, 1))', v_req));
  call test_util.record('ai: users cannot record tool calls', v ->> 'error' like 'permission denied%', v::text);
  v := test_util.gr_call('11111111-1111-1111-1111-111111111111', 'teacher', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    format('select to_jsonb(public.ai_store_exchange(%L, null, ''q'', ''a'', null))', v_req));
  call test_util.record('ai: users cannot write conversation content directly', v ->> 'error' like 'permission denied%', v::text);

  perform test_util.ai_service(format('select to_jsonb(public.ai_record_tool_call(%L, ''get_learner_attendance_summary'', ''ok'', 12, 2))', v_req));
  perform test_util.ai_service(format(
    'select to_jsonb(public.ai_complete_request(%L, ''succeeded'', ''anthropic'', ''claude-opus-5-5'', ''school_copilot'', 1, 1200, 300, null, 2500, array[''prompt_injection_suspected''], null))', v_req));
  select count(*) into v_n from public.ai_requests
  where id = v_req and status = 'succeeded' and tool_calls = 1 and input_tokens = 1200 and prompt_version = 1
    and 'prompt_injection_suspected' = any (safety_flags);
  call test_util.record('ai: the service role records usage, tools, prompt version and safety flags', v_n = 1, v_n::text);
  perform test_util.ai_service(format(
    'select to_jsonb(public.ai_complete_request(%L, ''failed'', ''x'', ''x'', null, 1, 9, 9, null, 1, null, ''late''))', v_req));
  select count(*) into v_n from public.ai_requests where id = v_req and status = 'succeeded' and input_tokens = 1200;
  call test_util.record('ai: a completed request cannot be overwritten', v_n = 1, v_n::text);

  v := test_util.gr_call('11111111-1111-1111-1111-111111111111', 'teacher', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    format('select to_jsonb(public.ai_submit_feedback(%L, ''helpful''))', v_req));
  select count(*) into v_n from public.ai_feedback where request_id = v_req and rating = 'helpful';
  call test_util.record('ai: users can rate their own AI answers', v ->> 'error' is null and v_n = 1, v::text);
  v := test_util.gr_call('33333333-3333-3333-3333-333333333333', 'teacher', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    format('select to_jsonb(public.ai_submit_feedback(%L, ''problem''))', v_req));
  call test_util.record('ai: users cannot give feedback on someone else''s request', v ->> 'error' like 'insufficient_privilege%', v::text);

  -- Content storage is off by default.
  v := test_util.ai_service(format('select to_jsonb(public.ai_store_exchange(%L, null, ''How is Lerato doing?'', ''answer'', null))', v_req));
  select count(*) into v_n from public.ai_messages;
  call test_util.record('ai: conversation content is not stored unless the feature allows it', v::text = 'null' and v_n = 0, v::text);

  update public.ai_features set store_content = true, content_retention_days = 7 where key = 'copilot';
  v := test_util.ai_service(format('select to_jsonb(public.ai_store_exchange(%L, null, ''How is Lerato doing?'', ''answer'', ''{}''::jsonb))', v_req));
  v_conv := (v #>> '{}')::uuid;
  select count(*) into v_n from public.ai_conversations
  where id = v_conv and user_id = '11111111-1111-1111-1111-111111111111' and expires_at between now() + interval '6 days' and now() + interval '8 days';
  call test_util.record('ai: stored conversations belong to the user and expire per policy', v_n = 1, v::text);

  v := test_util.gr_call('11111111-1111-1111-1111-111111111111', 'teacher', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'select to_jsonb(count(*)) from public.ai_messages');
  call test_util.record('ai: the owner can read their conversation', v::text = '2', v::text);
  v := test_util.gr_call('22222222-2222-2222-2222-222222222222', 'school_owner', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'select to_jsonb((select count(*) from public.ai_messages) + (select count(*) from public.ai_conversations))');
  call test_util.record('ai: other users in the same school cannot read the conversation', v::text = '0', v::text);
  v := test_util.gr_call('44444444-4444-4444-4444-444444444444', 'platform_administrator', null,
    'select to_jsonb((select count(*) from public.ai_messages) + (select count(*) from public.ai_conversations))');
  call test_util.record('ai: platform administrators cannot read conversation content', v::text = '0', v::text);

  v := test_util.ai_authorize('22222222-2222-2222-2222-222222222222', 'school_owner', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  v_req_b := (v ->> 'request_id')::uuid;
  v := test_util.ai_service(format('select to_jsonb(public.ai_store_exchange(%L, %L, ''x'', ''y'', null))', v_req_b, v_conv));
  call test_util.record('ai: a request cannot append to another user''s conversation', v ->> 'error' like 'insufficient_privilege%', v::text);

  v := test_util.gr_call('22222222-2222-2222-2222-222222222222', 'school_owner', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    format('with d as (delete from public.ai_conversations where id = %L returning 1) select to_jsonb(count(*)) from d', v_conv));
  call test_util.record('ai: other users cannot delete the conversation', v::text = '0', v::text);
  v := test_util.gr_call('11111111-1111-1111-1111-111111111111', 'teacher', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    format('with d as (delete from public.ai_conversations where id = %L returning 1) select to_jsonb(count(*)) from d', v_conv));
  select count(*) into v_n from public.ai_messages;
  call test_util.record('ai: the owner can delete their conversation and its messages', v::text = '1' and v_n = 0, v::text);

  insert into public.ai_conversations (user_id, school_id, feature, expires_at)
  values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'copilot', now() - interval '1 day');
  v := test_util.ai_service('select public.ai_purge_expired()');
  call test_util.record('ai: retention purges expired conversations', (v ->> 'conversations')::int = 1, v::text);
  update public.ai_features set store_content = false where key = 'copilot';
end $$;

-- Administration and usage reporting.
do $$
declare
  v jsonb;
  v_n int;
begin
  v := test_util.gr_call('22222222-2222-2222-2222-222222222222', 'school_owner', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'select to_jsonb(public.ai_admin_set_school(''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'', true))');
  call test_util.record('ai: school owners cannot change AI enablement', v ->> 'error' like 'insufficient_privilege%', v::text);
  v := test_util.gr_call('44444444-4444-4444-4444-444444444444', 'platform_administrator', null,
    'select to_jsonb(public.ai_admin_set_school(''bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'', true))', 'aal1');
  call test_util.record('ai: configuring AI requires MFA', v ->> 'error' like 'mfa_required%', v::text);
  v := test_util.gr_call('44444444-4444-4444-4444-444444444444', 'platform_administrator', null,
    'select to_jsonb(public.ai_admin_update_feature(''copilot'', ''{"max_input_chars": 3000, "allowed_tools": ["get_learner_attendance_summary"]}''::jsonb))');
  select count(*) into v_n from public.ai_features where key = 'copilot' and max_input_chars = 3000
    and allowed_tools = array['get_learner_attendance_summary'];
  call test_util.record('ai: a platform administrator with MFA can change the policy', v ->> 'error' is null and v_n = 1, v::text);
  select count(*) into v_n from public.audit_log where action = 'ai_feature_updated';
  call test_util.record('ai: policy changes are audited', v_n >= 1, v_n::text);
  v := test_util.gr_call('44444444-4444-4444-4444-444444444444', 'platform_administrator', null,
    'select to_jsonb(public.ai_admin_update_feature(''copilot'', ''{"run_sql": true}''::jsonb))');
  call test_util.record('ai: unknown policy fields are rejected', v ->> 'error' like 'invalid_argument%', v::text);

  v := test_util.gr_call('11111111-1111-1111-1111-111111111111', 'teacher', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'select public.ai_usage_summary(current_date - 30, current_date)');
  call test_util.record('ai: teachers cannot see school AI usage', v ->> 'error' like 'insufficient_privilege%', v::text);
  v := test_util.gr_call('22222222-2222-2222-2222-222222222222', 'school_owner', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'select public.ai_usage_summary(current_date - 30, current_date, ''bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'')');
  call test_util.record('ai: a school owner cannot see another school''s AI usage', v ->> 'error' like 'insufficient_privilege%', v::text);
  v := test_util.gr_call('22222222-2222-2222-2222-222222222222', 'school_owner', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'select public.ai_usage_summary(current_date - 30, current_date)');
  call test_util.record('ai: a school owner sees usage for their own school only',
    jsonb_array_length(v) >= 1 and v::text not like '%bbbbbbbb%', left(v::text, 300));
end $$;

-- ---------------------------------------------------------------------------
-- Part 2: the tools' queries, as each identity (RLS is the boundary)
-- ---------------------------------------------------------------------------

do $$
declare
  v jsonb;
begin
  -- get_learner_attendance_summary: select status from attendance_records where learner_id = …
  v := test_util.gr_call('11111111-1111-1111-1111-111111111111', 'teacher', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'select to_jsonb(count(*)) from public.attendance_records where learner_id = ''a1a10000-0000-0000-0000-000000000001''');
  call test_util.record('ai tools: a teacher reads attendance for a learner in their school', (v #>> '{}')::int >= 2, v::text);
  v := test_util.gr_call('11111111-1111-1111-1111-111111111111', 'teacher', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'select to_jsonb(count(*)) from public.attendance_records where learner_id = ''a1a10000-0000-0000-0000-000000000003''');
  call test_util.record('ai tools: cross-school attendance lookup returns nothing', v::text = '0', v::text);

  v := test_util.gr_call('11111111-1111-1111-1111-111111111111', 'teacher', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'select to_jsonb(count(*)) from public.learners where id = ''a1a10000-0000-0000-0000-000000000003'' or last_name ilike ''%Bione%''');
  call test_util.record('ai tools: cross-school learner lookup returns nothing', v::text = '0', v::text);

  -- get_learner_fee_summary: learner_fee_charges where learner_id = … and active
  v := test_util.gr_call('22222222-2222-2222-2222-222222222222', 'school_owner', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'select to_jsonb(count(*)) from public.learner_fee_charges where learner_id = ''a1a10000-0000-0000-0000-000000000001'' and active');
  call test_util.record('ai tools: a school owner reads fees for their own learners', (v #>> '{}')::int >= 1, v::text);
  v := test_util.gr_call('22222222-2222-2222-2222-222222222222', 'school_owner', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'select to_jsonb(count(*)) from public.learner_fee_charges where learner_id = ''a1a10000-0000-0000-0000-000000000003''');
  call test_util.record('ai tools: cross-school fee lookup returns nothing', v::text = '0', v::text);
  v := test_util.gr_call('11111111-1111-1111-1111-111111111111', 'teacher', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'select to_jsonb(count(*)) from public.learner_fee_charges where learner_id = ''a1a10000-0000-0000-0000-000000000001''');
  call test_util.record('ai tools: a teacher without financial access reads no fees', v::text = '0', v::text);

  -- Parent and learner isolation.
  v := test_util.gr_call('a1a10000-0000-0000-0000-0000000000f1', 'parent', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'select to_jsonb(count(*)) from public.attendance_records where learner_id = ''a1a10000-0000-0000-0000-000000000001''');
  call test_util.record('ai tools: a parent reads their own child''s attendance', (v #>> '{}')::int >= 2, v::text);
  v := test_util.gr_call('a1a10000-0000-0000-0000-0000000000f1', 'parent', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'select to_jsonb(count(*)) from public.attendance_records where learner_id in (''a1a10000-0000-0000-0000-000000000002'', ''a1a10000-0000-0000-0000-000000000003'')');
  call test_util.record('ai tools: a parent cannot read another learner''s attendance', v::text = '0', v::text);
  v := test_util.gr_call('a1a10000-0000-0000-0000-0000000000f1', 'parent', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'select to_jsonb(count(*)) from public.learner_fee_charges where learner_id = ''a1a10000-0000-0000-0000-000000000003''');
  call test_util.record('ai tools: a parent cannot read another school''s fees', v::text = '0', v::text);

  v := test_util.gr_call('a1a10000-0000-0000-0000-0000000000f2', 'learner', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'select to_jsonb(count(*)) from public.attendance_records where learner_id = ''a1a10000-0000-0000-0000-000000000002''');
  call test_util.record('ai tools: a learner reads their own attendance', (v #>> '{}')::int >= 1, v::text);
  v := test_util.gr_call('a1a10000-0000-0000-0000-0000000000f2', 'learner', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'select to_jsonb(count(*)) from public.attendance_records where learner_id = ''a1a10000-0000-0000-0000-000000000001''');
  call test_util.record('ai tools: a learner cannot read another learner''s attendance', v::text = '0', v::text);

  -- Safeguarding stays restricted (and no AI tool reads it).
  v := test_util.gr_call('11111111-1111-1111-1111-111111111111', 'teacher', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'select to_jsonb(count(*)) from public.safeguarding_concerns');
  call test_util.record('ai tools: staff without safeguarding access read no safeguarding records', v::text = '0', v::text);

  -- get_reporting_summary: get_government_report as the caller.
  v := test_util.gr_call('11111111-1111-1111-1111-111111111111', 'teacher', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'select public.get_government_report(''{}''::jsonb)');
  call test_util.record('ai tools: a teacher gets no government-style report', v ->> 'error' like 'insufficient_privilege%', left(v::text, 200));
  v := test_util.gr_call('22222222-2222-2222-2222-222222222222', 'school_owner', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'select public.get_government_report(''{"district_id":"ea000000-0000-0000-0000-000000000012"}''::jsonb)');
  call test_util.record('ai tools: a school owner cannot widen the report to a district', v ->> 'error' like 'insufficient_privilege%', left(v::text, 200));
end $$;
