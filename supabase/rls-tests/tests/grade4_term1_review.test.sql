-- Curriculum review workflow (20261004090000) exercised on the real Grade 4 Term 1 pack ZA-G4-MATH-2026-T1.
-- run.sh loads the pack just before this file and this file removes it again. Everything it records (sources verified, reviews,
-- answers) is TEST DATA created here for the test universe only. Nothing in this file touches the repository's pack data, and the
-- pack as shipped stays DRAFT, NOT VERIFIED.

create or replace function test_util.become(p_uid uuid, p_role text, p_tenant uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', test_util.jwt_claims(p_uid, p_role, p_tenant), true);
  execute 'set local role authenticated';
end $$;

create or replace function test_util.err_of(p_sql text) returns text language plpgsql as $$
declare v_msg text;
begin
  begin
    execute p_sql;
    return 'ok';
  exception when others then
    get stacked diagnostics v_msg = message_text;
    return v_msg;
  end;
end $$;
grant execute on function test_util.err_of(text) to authenticated, anon;

-- test_util.ok(): the same as `call test_util.record(...)`, but usable with subqueries in the arguments (a CALL cannot take them).
create or replace function test_util.ok(p_name text, p_passed boolean, p_detail text default '') returns void language plpgsql as $$
begin
  call test_util.record(p_name, coalesce(p_passed, false), coalesce(p_detail, 'null'));
end $$;

create or replace function test_util.admin_a() returns void language sql as $$
  select test_util.become('44444444-4444-4444-4444-444444444444', 'platform_administrator', null)
$$;
create or replace function test_util.admin_b() returns void language sql as $$
  select test_util.become('99999999-0000-0000-0000-000000000001', 'platform_administrator', null)
$$;
create or replace function test_util.rec(p_url text, p_sha text default null) returns text language sql as $$
  select concat_ws(E'\t', 'RECORD', '1', 'retrieved', '200', '0', '4096', coalesce(p_sha, repeat('ab', 32)), 'application/pdf', p_url, p_url)
$$;

create table test_util.rv (k text primary key, v uuid);
grant select, insert on test_util.rv to authenticated;
create or replace function test_util.rv(p_k text) returns uuid language sql stable as $$ select v from test_util.rv where k = p_k $$;
grant execute on function test_util.rv(text) to authenticated;

insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data) values
  ('00000000-0000-0000-0000-000000000000', '99999999-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'second.reviewer@funda360.test',
   jsonb_build_object('role', 'platform_administrator'));
insert into public.profiles (id, tenant_id, first_name, last_name, email, role, status) values
  ('99999999-0000-0000-0000-000000000001', null, 'Second', 'Reviewer', 'second.reviewer@funda360.test', null, 'active');

insert into test_util.rv
  select 'v', id from public.curriculum_versions where code = 'ZA-G4-MATH-2026-T1'
  union all select 'caps', id from public.curriculum_sources where title like 'Curriculum and Assessment Policy Statement%'
  union all select 'atp', id from public.curriculum_sources where title like '2026 Annual Teaching Plan%'
  union all select 'obj_wn01', id from public.curriculum_objectives where version_id = (select id from public.curriculum_versions where code = 'ZA-G4-MATH-2026-T1') and code = 'G4.MATH.2026.T1.WN.01'
  union all select 'obj_wn02', id from public.curriculum_objectives where version_id = (select id from public.curriculum_versions where code = 'ZA-G4-MATH-2026-T1') and code = 'G4.MATH.2026.T1.WN.02'
  union all select 'obj_fa', id from public.curriculum_objectives where version_id = (select id from public.curriculum_versions where code = 'ZA-G4-MATH-2026-T1') and code = 'G4.MATH.2026.T1.FA.01'
  union all (select 'topic', tp.id from public.curriculum_topics tp join public.curriculum_objectives ob on ob.topic_id = tp.id
             where tp.version_id = (select id from public.curriculum_versions where code = 'ZA-G4-MATH-2026-T1') and ob.code = 'G4.MATH.2026.T1.WN.01');

-- ---------------------------------------------------------------------------
-- 1. Starting state: everything pending, from the database
-- ---------------------------------------------------------------------------
do $$
declare
  v uuid := test_util.rv('v'); s jsonb; n int; wf boolean;
begin
  select review_workflow into wf from public.curriculum_versions where id = v;
  perform test_util.ok('a new version is in the review workflow by default', wf, 'review_workflow=' || wf);
  perform test_util.admin_a();
  s := public.curriculum_review_summary(v);
  execute 'reset role';
  perform test_util.ok('summary: 27 objectives, none verified, 27 pending', (s #>> '{objective,total}')::int = 27 and (s #>> '{objective,positive}')::int = 0 and (s #>> '{objective,pending}')::int = 27, s #>> '{objective}');
  perform test_util.ok('summary: 17 lessons, 112 resources, 6 practice checks and 60 questions, all pending',
    (s #>> '{lesson,total}')::int = 17 and (s #>> '{lesson,pending}')::int = 17 and (s #>> '{resource,total}')::int = 112 and (s #>> '{resource,pending}')::int = 112
    and (s #>> '{assessment,total}')::int = 6 and (s #>> '{assessment,pending}')::int = 6 and (s #>> '{question,total}')::int = 60 and (s #>> '{question,pending}')::int = 60,
    s::text);
  perform test_util.ok('summary: nine open questions, all open', (s #>> '{open_questions,total}')::int = 9 and (s #>> '{open_questions,open}')::int = 9, s #>> '{open_questions}');
  perform test_util.ok('summary: one formal assessment, details not recorded, not verified', (s #>> '{formal_assessment,total}')::int = 1 and (s #>> '{formal_assessment,details_recorded}')::int = 0
    and (s #>> '{formal_assessment,verified}')::int = 0, s #>> '{formal_assessment}');
  perform test_util.ok('summary: both sources are indexed only', jsonb_array_length(s -> 'sources') = 2
    and not exists (select 1 from jsonb_array_elements(s -> 'sources') e where e ->> 'evidence_level' <> 'indexed'), (s -> 'sources')::text);
  perform test_util.ok('summary: not ready, overall DRAFT — NOT VERIFIED', not (s ->> 'ready')::boolean and s ->> 'overall' = 'DRAFT — NOT VERIFIED' and jsonb_array_length(s -> 'blockers') > 5, s ->> 'overall');
  select count(*) into n from public.curriculum_reviews where version_id = v;
  perform test_util.ok('the pack as shipped contains no review decisions at all', n = 0, 'rows: ' || n);
  select count(*) into n from public.curriculum_versions where id = v and status = 'draft' and approved_by is null and published_at is null;
  perform test_util.ok('the pack as shipped is a draft: not approved, not published', n = 1, 'draft rows: ' || n);
end $$;

-- ---------------------------------------------------------------------------
-- 2. Authorization
-- ---------------------------------------------------------------------------
do $$
declare
  v uuid := test_util.rv('v'); e text; n int;
begin
  perform test_util.become('11111111-1111-1111-1111-111111111111', 'teacher', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  e := test_util.err_of(format('select public.record_curriculum_review(%L, ''objective'', %L, ''verified'', ''checked ok'', %L, ''3.3.1'', ''35'')', v, test_util.rv('obj_wn01'), test_util.rv('caps')));
  perform test_util.ok('a teacher cannot verify an objective', e like 'insufficient_privilege%', e);
  e := test_util.err_of(format('select public.record_curriculum_review(%L, ''lesson'', %L, ''accepted'', ''checked ok'')', v, (select id from public.lessons limit 1)));
  perform test_util.ok('a teacher cannot accept a lesson', e like 'insufficient_privilege%', e);
  e := test_util.err_of(format('select public.resolve_open_question(%L, ''deferred'', null, null, null, null, ''later'')', (select id from public.curriculum_open_questions limit 1)));
  perform test_util.ok('a teacher cannot answer an open question', e like 'insufficient_privilege%', e);
  e := test_util.err_of(format('select public.record_formal_assessment_details(%L, %L, ''x y z'', ''assignment'', ''scope'', 180, null, null, null, null, %L, ''1'', ''2'', ''notes'')', v, test_util.rv('obj_fa'), test_util.rv('caps')));
  perform test_util.ok('a teacher cannot record formal assessment details', e like 'insufficient_privilege%', e);
  e := test_util.err_of(format('select public.raise_review_finding(%L, ''lesson'', %L, ''other'', ''something'')', v, (select id from public.lessons limit 1)));
  perform test_util.ok('a teacher cannot raise or alter review findings', e like 'insufficient_privilege%', e);
  e := test_util.err_of(format('select public.curriculum_review_summary(%L)', v));
  perform test_util.ok('a teacher cannot read the review summary', e like 'insufficient_privilege%', e);
  e := test_util.err_of(format('select public.curriculum_review_items(%L, ''question'')', v));
  perform test_util.ok('a teacher cannot read the review items (which include answer keys)', e like 'insufficient_privilege%', e);
  e := test_util.err_of(format('select public.record_source_retrieval(%L, %L)', test_util.rv('caps'), test_util.rec('https://x.example/a.pdf')));
  perform test_util.ok('a teacher cannot record source retrieval', e like 'insufficient_privilege%', e);
  e := test_util.err_of(format('select public.record_source_review(%L, ''identity'', ''verified'', ''checked ok'')', test_util.rv('caps')));
  perform test_util.ok('a teacher cannot verify a source', e like 'insufficient_privilege%', e);
  e := test_util.err_of(format('select public.correct_source_evidence(%L, ''a long enough reason'')', test_util.rv('caps')));
  perform test_util.ok('a teacher cannot correct source evidence', e like 'insufficient_privilege%', e);
  e := test_util.err_of(format('select public.require_curriculum_review(%L)', v));
  perform test_util.ok('a teacher cannot change the workflow flag', e like 'insufficient_privilege%', e);
  select (select count(*) from public.curriculum_reviews) + (select count(*) from public.curriculum_review_findings) + (select count(*) from public.curriculum_open_questions)
       + (select count(*) from public.curriculum_formal_assessment_details) + (select count(*) from public.curriculum_source_reviews) into n;
  perform test_util.ok('a teacher cannot read any review table', n = 0, 'visible rows: ' || n);
  e := test_util.err_of(format('update public.curriculum_open_questions set status = ''resolved'' where version_id = %L', v));
  perform test_util.ok('a teacher cannot write a review table directly', e <> 'ok' or not exists (select 1 from public.curriculum_open_questions where status = 'resolved'), e);
  e := test_util.err_of(format('insert into public.curriculum_reviews (version_id, entity_type, entity_id, decision, notes, content_fingerprint, reviewer) values (%L, ''lesson'', %L, ''accepted'', ''forged'', ''x'', ''11111111-1111-1111-1111-111111111111'')', v, (select id from public.lessons limit 1)));
  perform test_util.ok('a teacher cannot forge a review row', e like '%permission denied%' or e like '%row-level security%', e);

  perform test_util.become('22222222-2222-2222-2222-222222222222', 'school_owner', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  e := test_util.err_of(format('select public.record_curriculum_review(%L, ''objective'', %L, ''verified'', ''checked ok'', %L, ''3.3.1'', ''35'')', v, test_util.rv('obj_wn01'), test_util.rv('caps')));
  perform test_util.ok('a school owner (an administrator, but not a platform one) cannot verify', e like 'insufficient_privilege%', e);
  perform test_util.become('11111111-1111-1111-1111-111111111111', 'anon', null);
  execute 'reset role';
  perform test_util.ok('anonymous users cannot call any review function',
    not has_function_privilege('anon', 'public.record_curriculum_review(uuid, text, uuid, text, text, uuid, text, text, text)', 'execute')
    and not has_function_privilege('anon', 'public.resolve_open_question(uuid, text, text, uuid, text, text, text)', 'execute')
    and not has_function_privilege('anon', 'public.curriculum_review_summary(uuid)', 'execute')
    and not has_function_privilege('anon', 'public.curriculum_review_items(uuid, text)', 'execute')
    and not has_function_privilege('anon', 'public.record_formal_assessment_details(uuid, uuid, text, text, text, integer, text, integer, text, text, uuid, text, text, text)', 'execute'), 'anon execute');
  perform test_util.ok('the review internals are not callable by clients',
    not has_function_privilege('authenticated', 'public.curriculum_review_compute(uuid)', 'execute')
    and not has_function_privilege('authenticated', 'public.review_current(uuid, text)', 'execute')
    and not has_function_privilege('authenticated', 'public.review_fingerprint(text, uuid)', 'execute')
    and not has_function_privilege('authenticated', 'public.review_workflow_version_gate()', 'execute'), 'authenticated execute');
  select count(*) into n from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
   where ns.nspname = 'public' and c.relname in ('curriculum_reviews', 'curriculum_review_findings', 'curriculum_open_questions', 'curriculum_formal_assessment_details', 'curriculum_source_reviews')
     and not (c.relrowsecurity and c.relforcerowsecurity);
  perform test_util.ok('row level security is enabled and forced on every review table', n = 0, 'unprotected: ' || n);
  select count(*) into n from pg_policies where schemaname = 'public' and tablename in ('curriculum_reviews', 'curriculum_review_findings', 'curriculum_open_questions', 'curriculum_formal_assessment_details', 'curriculum_source_reviews')
     and cmd <> 'SELECT';
  perform test_util.ok('no review table has a client write policy', n = 0, 'write policies: ' || n);
  select count(*) into n from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.prosecdef and p.proname in ('record_curriculum_review', 'raise_review_finding', 'resolve_review_finding', 'resolve_open_question', 'record_formal_assessment_details',
     'curriculum_review_summary', 'curriculum_review_items', 'curriculum_review_compute', 'review_current', 'review_fingerprint', 'require_curriculum_review', 'record_source_retrieval',
     'record_source_review', 'correct_source_evidence', 'review_workflow_version_gate', 'review_workflow_content_gate')
     and not exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%');
  perform test_util.ok('every new SECURITY DEFINER function pins its search_path', n = 0, 'unpinned: ' || n);
end $$;

-- ---------------------------------------------------------------------------
-- 3. Cannot verify without a real source; negative decisions need notes and create findings
-- ---------------------------------------------------------------------------
do $$
declare
  v uuid := test_util.rv('v'); o uuid := test_util.rv('obj_wn01'); e text; n int; s jsonb; v_rev uuid;
begin
  perform test_util.admin_a();
  e := test_util.err_of(format('select public.record_curriculum_review(%L, ''objective'', %L, ''verified'', ''looks fine here'')', v, o));
  perform test_util.ok('an objective cannot be verified without a source', e like 'invalid_argument%source%', e);
  e := test_util.err_of(format('select public.record_curriculum_review(%L, ''objective'', %L, ''verified'', ''looks fine here'', %L)', v, o, test_util.rv('caps')));
  perform test_util.ok('an objective cannot be verified without a source section', e like 'invalid_argument%section%', e);
  e := test_util.err_of(format('select public.record_curriculum_review(%L, ''objective'', %L, ''verified'', ''looks fine here'', %L, ''3.3.1'')', v, o, test_util.rv('caps')));
  perform test_util.ok('an objective cannot be verified without a page or reference', e like 'invalid_argument%page%', e);
  e := test_util.err_of(format('select public.record_curriculum_review(%L, ''objective'', %L, ''verified'', '''', %L, ''3.3.1'', ''35'')', v, o, test_util.rv('caps')));
  perform test_util.ok('a review without notes is refused', e like 'invalid_argument%notes%', e);
  e := test_util.err_of(format('select public.record_curriculum_review(%L, ''objective'', %L, ''verified'', ''checked'', %L, ''3.3.1'', ''35'')', v, o, test_util.rv('caps')));
  perform test_util.ok('nothing can be verified against a source whose identity is not verified (CAPS is indexed only)', e like 'invalid_state%identity%verified%', e);
  e := test_util.err_of(format('select public.record_curriculum_review(%L, ''objective'', %L, ''accepted'', ''checked'')', v, o));
  perform test_util.ok('"accepted" is not a decision for an objective', e like 'invalid_argument%verified%', e);
  e := test_util.err_of(format('select public.record_curriculum_review(%L, ''lesson'', %L, ''verified'', ''checked'')', v, (select id from public.lessons where curriculum_version_id = v limit 1)));
  perform test_util.ok('"verified" is not a decision for a lesson', e like 'invalid_argument%accepted%', e);
  e := test_util.err_of(format('select public.record_curriculum_review(%L, ''objective'', %L, ''rejected'', '''')', v, o));
  perform test_util.ok('a rejection needs notes', e like 'invalid_argument%notes%', e);
  e := test_util.err_of(format('select public.record_curriculum_review(%L, ''lesson'', %L, ''accepted'', ''checked ok'')', v, o));
  perform test_util.ok('a unit from another entity cannot be reviewed as a lesson', e like 'invalid_reference%', e);
  e := test_util.err_of(format('select public.record_curriculum_review(%L, ''objective'', %L, ''verified'', ''checked ok'', %L, ''3.3.1'', ''35'')', v, test_util.rv('v'), test_util.rv('caps')));
  perform test_util.ok('an id that is not an objective of this version is refused', e like 'invalid_reference%', e);
  select count(*) into n from public.curriculum_reviews where version_id = v;
  perform test_util.ok('none of the refused attempts left a review row', n = 0, 'rows: ' || n);

  -- Rejecting records a finding, a review row, and an audit entry; the objective itself is untouched.
  v_rev := public.record_curriculum_review(v, 'objective', o, 'needs_correction', 'The range wording should say "at least 10 000" for every item.', null, null, null, 'curriculum_mismatch');
  execute 'reset role';
  select count(*) into n from public.curriculum_reviews r where r.id = v_rev and r.reviewer = '44444444-4444-4444-4444-444444444444' and r.reviewed_at is not null
    and r.decision = 'needs_correction' and r.previous_decision is null and r.version_id = v;
  perform test_util.ok('a decision records reviewer, timestamp, decision and notes', n = 1, 'rows: ' || n);
  select count(*) into n from public.curriculum_review_findings f where f.review_id = v_rev and f.status = 'open' and f.category = 'curriculum_mismatch' and f.entity_id = o and f.raised_by = '44444444-4444-4444-4444-444444444444';
  perform test_util.ok('a negative decision creates an open finding instead of editing the content', n = 1, 'findings: ' || n);
  select count(*) into n from public.audit_log a where a.entity_id = v_rev and a.action = 'curriculum_review_needs_correction' and a.actor_profile_id = '44444444-4444-4444-4444-444444444444'
    and a.after ->> 'notes' like 'The range wording%' and a.after ->> 'entity_id' = o::text;
  perform test_util.ok('the decision is audited with user, entity and notes', n = 1, 'audit rows: ' || n);
  select count(*) into n from public.curriculum_objectives where id = o and description = 'Count forwards and backwards in 2s, 3s, 5s, 10s, 25s, 50s and 100s with whole numbers between 0 and at least 10 000.';
  perform test_util.ok('the objective text was not changed by the review', n = 1, 'unchanged rows: ' || n);
  perform test_util.admin_a();
  s := public.curriculum_review_summary(v);
  execute 'reset role';
  perform test_util.ok('the dashboard counts it as needs correction and keeps the pack not ready', (s #>> '{objective,needs_correction}')::int = 1 and (s #>> '{objective,pending}')::int = 26 and (s #>> '{open_findings}')::int = 1, s #>> '{objective}');

  e := test_util.err_of(format('update public.curriculum_reviews set decision = ''rejected'' where id = %L', v_rev));
  perform test_util.ok('review decisions are append-only (update refused)', e like 'invalid_state%append-only%', e);
  e := test_util.err_of(format('delete from public.curriculum_reviews where id = %L', v_rev));
  perform test_util.ok('review decisions are append-only (delete refused)', e like 'invalid_state%append-only%', e);

  perform test_util.admin_a();
  v_rev := public.record_curriculum_review(v, 'objective', test_util.rv('obj_wn02'), 'rejected', 'Not found in the ATP bullet as recorded.', null, null, null, 'scope_question');
  perform public.record_curriculum_review(v, 'objective', test_util.rv('obj_wn02'), 'needs_correction', 'Reconsidered: reword rather than remove.');
  execute 'reset role';
  select count(*) into n from public.curriculum_reviews where entity_id = test_util.rv('obj_wn02') and previous_decision = 'rejected' and decision = 'needs_correction';
  perform test_util.ok('a later decision records the previous one, and the latest decision is the current one', n = 1, 'rows: ' || n);
end $$;

-- ---------------------------------------------------------------------------
-- 4. Open questions: no resolution without evidence; deferral is allowed but never means verified
-- ---------------------------------------------------------------------------
do $$
declare
  v uuid := test_util.rv('v'); q1 uuid; q4 uuid; e text; s jsonb; n int;
begin
  select id into q1 from public.curriculum_open_questions where version_id = v and code = 'Q1';
  select id into q4 from public.curriculum_open_questions where version_id = v and code = 'Q4';
  perform test_util.admin_a();
  e := test_util.err_of(format('select public.resolve_open_question(%L, ''resolved'', ''Division is not required'', null, null, null, ''checked'')', q1));
  perform test_util.ok('a question cannot be resolved without a source', e like 'invalid_argument%source%', e);
  e := test_util.err_of(format('select public.resolve_open_question(%L, ''resolved'', ''Division is not required'', %L, null, null, ''checked'')', q1, test_util.rv('caps')));
  perform test_util.ok('a question cannot be resolved without section and page', e like 'invalid_argument%section%', e);
  e := test_util.err_of(format('select public.resolve_open_question(%L, ''resolved'', '''', %L, ''3.3.1'', ''35'', ''checked'')', q1, test_util.rv('caps')));
  perform test_util.ok('a question cannot be resolved without an answer', e like 'invalid_argument%answer%', e);
  e := test_util.err_of(format('select public.resolve_open_question(%L, ''resolved'', ''Division is not required'', %L, ''3.3.1'', ''35'', '''')', q1, test_util.rv('caps')));
  perform test_util.ok('a question cannot be resolved without an explanation', e like 'invalid_argument%explanation%', e);
  e := test_util.err_of(format('select public.resolve_open_question(%L, ''resolved'', ''Division is not required'', %L, ''3.3.1'', ''35'', ''read the section'')', q1, test_util.rv('caps')));
  perform test_util.ok('a question cannot be resolved with evidence from a source whose identity is not verified', e like 'invalid_state%identity is verified%', e);
  e := test_util.err_of(format('select public.resolve_open_question(%L, ''deferred'', null, null, null, null, '''')', q1));
  perform test_util.ok('a question cannot be deferred without a reason', e like 'invalid_argument%explanation%', e);
  e := test_util.err_of(format('select public.resolve_open_question(%L, ''banana'', null, null, null, null, ''x y z'')', q1));
  perform test_util.ok('an unknown question status is refused', e like 'invalid_argument%', e);

  perform public.resolve_open_question(q1, 'deferred', null, null, null, null, 'Requires further curriculum review: the ATP PDF could not be read.');
  perform public.resolve_open_question(q4, 'deferred', null, null, null, null, 'Weeks and hours need the ATP PDF; pacing only.');
  s := public.curriculum_review_summary(v);
  execute 'reset role';
  perform test_util.ok('deferred is recorded with who and when, and is not resolved',
    (select status = 'deferred' and resolved_by = '44444444-4444-4444-4444-444444444444' and resolved_at is not null and answer is null and source_id is null from public.curriculum_open_questions where id = q1), 'deferred');
  perform test_util.ok('summary counts deferred separately; a deferred question that affects scope still blocks',
    (s #>> '{open_questions,deferred}')::int = 2 and (s #>> '{open_questions,deferred_material}')::int = 1 and (s #>> '{open_questions,open}')::int = 7
    and s -> 'blockers' @> to_jsonb('1 deferred question(s) materially affect scope and need an answer with evidence'::text), s #>> '{open_questions}');
  select count(*) into n from public.audit_log where entity_id in (q1, q4) and action = 'curriculum_question_deferred' and actor_profile_id = '44444444-4444-4444-4444-444444444444';
  perform test_util.ok('deferrals are audited', n = 2, 'rows: ' || n);
  e := test_util.err_of(format('update public.curriculum_open_questions set status = ''resolved'' where id = %L', q1));
  perform test_util.ok('even direct SQL cannot mark a question resolved without its evidence', e like '%curriculum_open_questions_resolved_needs_evidence%', e);
end $$;

-- ---------------------------------------------------------------------------
-- 5. Formal assessment: nothing invented
-- ---------------------------------------------------------------------------
do $$
declare v uuid := test_util.rv('v'); fa uuid := test_util.rv('obj_fa'); e text; n int; d public.curriculum_formal_assessment_details;
begin
  select * into d from public.curriculum_formal_assessment_details where version_id = v and objective_id = fa;
  perform test_util.ok('the formal assessment starts pending with no marks, weighting, name or duration',
    d.status = 'pending' and d.marks is null and d.weighting is null and d.assessment_name is null and d.duration_minutes is null and d.source_id is null, d.status);
  perform test_util.admin_a();
  e := test_util.err_of(format('select public.record_curriculum_review(%L, ''formal_assessment'', %L, ''verified'', ''checked ok'', %L, ''3.3.1'', ''35'')', v, fa, test_util.rv('caps')));
  perform test_util.ok('the formal assessment cannot be verified before its official details are recorded (or from an unverified source)', e like 'invalid_state%', e);
  e := test_util.err_of(format('select public.record_formal_assessment_details(%L, %L, ''Term 1 assignment'', ''assignment'', ''whole numbers'', 180, null, null, null, null, %L, ''Term 1'', ''12'', ''checked'')', v, fa, test_util.rv('atp')));
  perform test_util.ok('official details cannot be recorded from a source whose identity is not verified', e like 'invalid_state%identity is verified%', e);
  e := test_util.err_of(format('select public.record_formal_assessment_details(%L, %L, ''Term 1 assignment'', ''assignment'', ''whole numbers'', 180, null, null, null, null, %L, '''', '''', ''checked'')', v, fa, test_util.rv('atp')));
  perform test_util.ok('official details need a section and page', e like 'invalid_argument%section%' or e like 'invalid_state%', e);
  e := test_util.err_of(format('select public.record_formal_assessment_details(%L, %L, ''Term 1 assignment'', ''assignment'', ''whole numbers'', 180, null, null, null, null, %L, ''Term 1'', ''12'', ''checked'')', v, test_util.rv('obj_wn01'), test_util.rv('atp')));
  perform test_util.ok('only a registered formal assessment takes official details', e like 'not_found%', e);
  execute 'reset role';
  select * into d from public.curriculum_formal_assessment_details where version_id = v and objective_id = fa;
  perform test_util.ok('the refused attempts changed nothing', d.status = 'pending' and d.marks is null, d.status);
  e := test_util.err_of(format('update public.curriculum_formal_assessment_details set status = ''recorded'' where id = %L', d.id));
  perform test_util.ok('even direct SQL cannot mark details recorded without a name, scope and source', e like '%curriculum_formal_details_recorded%', e);
end $$;

-- ---------------------------------------------------------------------------
-- 6. Approval, content approval and AI drafting are all closed while the review is incomplete
-- ---------------------------------------------------------------------------
do $$
declare
  v uuid := test_util.rv('v'); e text; l uuid; t uuid := test_util.rv('topic'); o uuid := test_util.rv('obj_wn01');
begin
  select id into l from public.lessons where curriculum_version_id = v order by sort_order, title limit 1;
  perform test_util.admin_a();
  perform public.content_transition('curriculum_version', v, 'review');
  e := test_util.err_of(format('select public.content_transition(''curriculum_version'', %L, ''approved'')', v));
  perform test_util.ok('an incomplete curriculum review cannot be approved', e like 'invalid_state%curriculum review is not complete%', e);
  e := test_util.err_of(format('select public.content_transition(''curriculum_version'', %L, ''published'')', v));
  perform test_util.ok('an unreviewed curriculum cannot be published (it cannot skip approval)', e like 'invalid_state%', e);
  perform public.content_transition('lesson', l, 'review');
  e := test_util.err_of(format('select public.content_transition(''lesson'', %L, ''approved'')', l));
  perform test_util.ok('a lesson without an accepted review cannot be approved', e like 'invalid_state%no current accepted curriculum review%', e);
  e := test_util.err_of(format('select public.ai_begin_generation(%L, %L, array[%L]::uuid[], null, ''en'', ''mock'', ''mock-model'', ''p1'')', v, t, o));
  perform test_util.ok('AI drafting is refused while the objectives are not approved (and approval needs a complete review)', e like 'invalid_state%must belong to the topic and be approved%', e);
  execute 'reset role';
  perform test_util.ok('no AI generation record was created', not exists (select 1 from public.ai_generation_requests where curriculum_version_id = v), 'requests: 0');
  perform test_util.ok('the version and its objectives are still not approved',
    (select status::text from public.curriculum_versions where id = v) = 'review' and not exists (select 1 from public.curriculum_objectives where version_id = v and status in ('approved', 'published')), 'review');
end $$;

-- ---------------------------------------------------------------------------
-- 7. Sources: climb the ladder through the real RPCs (test data), then review everything
-- ---------------------------------------------------------------------------
do $$
declare
  v uuid := test_util.rv('v'); s uuid; u text; e text; n int; src_row public.curriculum_sources;
begin
  perform test_util.admin_a();
  for s in select unnest(array[test_util.rv('caps'), test_util.rv('atp')]) loop
    select url into u from public.curriculum_sources where id = s;
    perform public.record_source_retrieval(s, test_util.rec(u, case when s = test_util.rv('caps') then repeat('ab', 32) else repeat('cd', 32) end));
    perform public.record_source_review(s, 'identity', 'verified', 'TEST DATA: identity confirmed for the test universe');
  end loop;
  e := test_util.err_of(format('select public.record_curriculum_review(%L, ''objective'', %L, ''verified'', ''checked ok'', %L, ''3.3.1'', ''35'')', v, test_util.rv('obj_wn01'), test_util.rv('caps')));
  perform test_util.ok('identity-verified sources allow a verification', e = 'ok', e);
  perform test_util.admin_a();
  perform public.record_source_review(test_util.rv('caps'), 'document', 'reviewed', 'TEST DATA: read');
  perform public.record_source_review(test_util.rv('caps'), 'licence', 'restricted', 'TEST DATA: reference only');
  perform public.record_source_review(test_util.rv('atp'), 'document', 'reviewed', 'TEST DATA: read');
  e := test_util.err_of(format('select public.curriculum_review_summary(%L)', v));
  select count(*) into n from public.curriculum_sources where id in (test_util.rv('caps'), test_util.rv('atp')) and status = 'verified' and content_reviewed_at is not null;
  execute 'reset role';
  perform test_util.ok('both sources are now identity verified and document reviewed (the ATP licence is still unreviewed)', n = 2, 'sources: ' || n);
  perform test_util.ok('an unreviewed licence still blocks completion', (public.curriculum_review_compute(v) -> 'blockers') @> to_jsonb('source "2026 Annual Teaching Plan: Mathematics Grade 4 (English)": licence not reviewed'::text), 'blocker present');
  perform test_util.admin_a();
  perform public.record_source_review(test_util.rv('atp'), 'licence', 'not_permitted', 'TEST DATA: not permitted');
  execute 'reset role';
  perform test_util.ok('a licence that does not permit use blocks completion', (public.curriculum_review_compute(v) -> 'blockers') @> to_jsonb('source "2026 Annual Teaching Plan: Mathematics Grade 4 (English)": licence does not permit use'::text), 'blocker present');
  perform test_util.admin_a();
  perform public.record_source_review(test_util.rv('atp'), 'licence', 'permitted', 'TEST DATA: permitted');
  execute 'reset role';
end $$;

-- ---------------------------------------------------------------------------
-- 8. Review every unit; staleness; separation of duties
-- ---------------------------------------------------------------------------
do $$
declare
  v uuid := test_util.rv('v'); r record; n int; e text; s jsonb; q uuid; lesson_id uuid; res_last uuid; prompt_before text; a uuid;
begin
  -- an author cannot accept their own unit
  select id into lesson_id from public.lessons where curriculum_version_id = v order by sort_order, title limit 1;
  set session_replication_role = replica;   -- a lesson's created_by is normally immutable; this fixture needs a known author
  update public.lessons set created_by = '44444444-4444-4444-4444-444444444444' where id = lesson_id;
  set session_replication_role = origin;
  perform test_util.admin_a();
  e := test_util.err_of(format('select public.record_curriculum_review(%L, ''lesson'', %L, ''accepted'', ''my own lesson'')', v, lesson_id));
  perform test_util.ok('the author of a lesson cannot accept it', e like 'insufficient_privilege%author%', e);
  perform test_util.admin_b();
  perform public.record_curriculum_review(v, 'lesson', lesson_id, 'accepted', 'Reviewed by someone other than the author');
  execute 'reset role';
  set session_replication_role = replica;
  update public.lessons set created_by = null where id = lesson_id;
  set session_replication_role = origin;
  -- the review went stale when created_by changed? created_by is part of the row fingerprint, so the decision must be redone
  perform test_util.admin_a();

  -- objectives (the two already decided get a fresh positive decision, which supersedes the earlier negative ones)
  for r in select id from public.curriculum_objectives where version_id = v loop
    perform public.record_curriculum_review(v, 'objective', r.id, 'verified', 'TEST DATA: checked against section 3.3.1', test_util.rv('caps'), '3.3.1', '35');
  end loop;
  for r in select id from public.lessons where curriculum_version_id = v loop
    perform public.record_curriculum_review(v, 'lesson', r.id, 'accepted', 'TEST DATA: lesson accepted');
  end loop;
  for r in select id from public.learning_assessments where curriculum_version_id = v loop
    perform public.record_curriculum_review(v, 'assessment', r.id, 'accepted', 'TEST DATA: practice check accepted');
  end loop;
  s := public.curriculum_review_summary(v);
  execute 'reset role';
  perform test_util.ok('objectives, lessons and practice checks reviewed; the later positive decision supersedes the earlier negative one',
    (s #>> '{objective,positive}')::int = 27 and (s #>> '{objective,needs_correction}')::int = 0 and (s #>> '{lesson,positive}')::int = 17 and (s #>> '{assessment,positive}')::int = 6, s::text);

  -- an assessment cannot be approved while its questions are unreviewed
  select id into a from public.learning_assessments where curriculum_version_id = v order by title limit 1;
  perform test_util.admin_a();
  perform public.content_transition('learning_assessment', a, 'review');
  e := test_util.err_of(format('select public.content_transition(''learning_assessment'', %L, ''approved'')', a));
  perform test_util.ok('a practice check cannot be approved while any of its questions is unreviewed', e like 'invalid_state%question(s)%', e);

  -- resources: all but one
  for r in select id from public.teaching_resources where curriculum_version_id = v order by title loop
    res_last := r.id;
  end loop;
  for r in select id from public.teaching_resources where curriculum_version_id = v and id <> res_last loop
    perform public.record_curriculum_review(v, 'resource', r.id, 'accepted', 'TEST DATA: resource accepted');
  end loop;
  for r in select id from public.assessment_questions where curriculum_version_id = v loop
    perform public.record_curriculum_review(v, 'question', r.id, 'accepted', 'TEST DATA: question accepted');
  end loop;
  s := public.curriculum_review_summary(v);
  execute 'reset role';
  perform test_util.ok('with one resource unreviewed the review is not complete', not (s ->> 'ready')::boolean and (s #>> '{resource,pending}')::int = 1 and (s #>> '{question,positive}')::int = 60, s #>> '{resource}');

  -- content changed after review => the decision no longer counts
  select id, prompt into q, prompt_before from public.assessment_questions where curriculum_version_id = v order by assessment_id, position limit 1;
  update public.assessment_questions set prompt = prompt || ' (edited)' where id = q;
  perform test_util.admin_a();
  s := public.curriculum_review_summary(v);
  execute 'reset role';
  perform test_util.ok('a question edited after its review goes back to pending (a decision applies to the content it was made on)', (s #>> '{question,pending}')::int = 1 and (s #>> '{question,positive}')::int = 59, s #>> '{question}');
  update public.assessment_questions set prompt = prompt_before where id = q;
  perform test_util.admin_a();
  s := public.curriculum_review_summary(v);
  execute 'reset role';
  perform test_util.ok('restoring the exact content restores the decision', (s #>> '{question,positive}')::int = 60, s #>> '{question}');

  -- the last resource
  perform test_util.admin_a();
  perform public.record_curriculum_review(v, 'resource', res_last, 'needs_correction', 'TEST DATA: the answer in step 3 is unclear', null, null, null, 'unclear_instruction');
  s := public.curriculum_review_summary(v);
  execute 'reset role';
  perform test_util.ok('a resource that needs correction blocks completion, with a finding', not (s ->> 'ready')::boolean and (s #>> '{resource,needs_correction}')::int = 1 and (s #>> '{open_findings}')::int >= 1, s #>> '{open_findings}');
  perform test_util.admin_a();
  perform public.record_curriculum_review(v, 'resource', res_last, 'accepted', 'TEST DATA: wording fixed in the next draft and re-read');
  execute 'reset role';
end $$;

-- ---------------------------------------------------------------------------
-- 9. Findings, open questions and the formal assessment complete the picture
-- ---------------------------------------------------------------------------
do $$
declare
  v uuid := test_util.rv('v'); fa uuid := test_util.rv('obj_fa'); s jsonb; e text; f uuid; n int; r record;
begin
  perform test_util.admin_a();
  s := public.curriculum_review_summary(v);
  perform test_util.ok('open findings from earlier negative decisions still block, even though newer decisions are positive', not (s ->> 'ready')::boolean and (s #>> '{open_findings}')::int >= 1, s #>> '{open_findings}');
  e := test_util.err_of(format('select public.resolve_review_finding(%L, ''resolved'', '''')', (select id from public.curriculum_review_findings where version_id = v and status = 'open' limit 1)));
  perform test_util.ok('a finding cannot be resolved without saying how', e like 'invalid_argument%', e);
  for r in select id from public.curriculum_review_findings where version_id = v and status = 'open' loop
    perform public.resolve_review_finding(r.id, 'resolved', 'TEST DATA: addressed in the next draft and re-reviewed');
  end loop;
  select count(*) into n from public.curriculum_review_findings where version_id = v and status = 'resolved' and resolved_by = '44444444-4444-4444-4444-444444444444' and resolved_at is not null;
  perform test_util.ok('findings record who resolved them, when and how', n >= 3, 'resolved: ' || n);
  e := test_util.err_of(format('select public.resolve_review_finding(%L, ''resolved'', ''again again'')', (select id from public.curriculum_review_findings where version_id = v and status = 'resolved' limit 1)));
  perform test_util.ok('a resolved finding cannot be resolved twice', e like 'invalid_state%', e);

  f := public.raise_review_finding(v, 'resource', (select id from public.teaching_resources where curriculum_version_id = v limit 1), 'age_suitability', 'TEST DATA: the context may not suit a rural class');
  s := public.curriculum_review_summary(v);
  perform test_util.ok('a reviewer can flag a resource without editing it, and the flag blocks completion', not (s ->> 'ready')::boolean and (s #>> '{open_findings}')::int = 1, s #>> '{open_findings}');
  perform public.resolve_review_finding(f, 'dismissed', 'TEST DATA: judged suitable after discussion');

  for r in select id, code from public.curriculum_open_questions where version_id = v and status <> 'resolved' loop
    perform public.resolve_open_question(r.id, 'resolved', 'TEST DATA answer for ' || r.code, test_util.rv('caps'), '3.3.1', '35', 'TEST DATA: read the cited section');
  end loop;
  s := public.curriculum_review_summary(v);
  perform test_util.ok('all nine questions resolved with evidence', (s #>> '{open_questions,resolved}')::int = 9 and (s #>> '{open_questions,open}')::int = 0 and (s #>> '{open_questions,deferred}')::int = 0, s #>> '{open_questions}');
  perform test_util.ok('the formal assessment still blocks completion', not (s ->> 'ready')::boolean and s -> 'blockers' @> to_jsonb('formal assessment details not recorded and verified'::text), s #>> '{formal_assessment}');

  perform public.record_formal_assessment_details(v, fa, 'TEST DATA Term 1 assignment', 'assignment', 'whole numbers; number sentences; addition and subtraction', 180, 'in class', null, null, 'Complete in class', test_util.rv('atp'), 'Term 1', '12', 'TEST DATA: copied from the fixture');
  execute 'reset role';
  perform test_util.ok('details are recorded with source, who and when; marks and weighting stay null when not supplied',
    (select status = 'recorded' and marks is null and weighting is null and duration_minutes = 180 and recorded_by = '44444444-4444-4444-4444-444444444444' and source_page = '12' from public.curriculum_formal_assessment_details where objective_id = fa), 'recorded');
  perform test_util.admin_a();
  perform public.record_curriculum_review(v, 'formal_assessment', fa, 'verified', 'TEST DATA: details match the source', test_util.rv('atp'), 'Term 1', '12');
  s := public.curriculum_review_summary(v);
  execute 'reset role';
  perform test_util.ok('with everything reviewed the summary says REVIEW COMPLETE, NOT APPROVED, and the version is still not approved',
    (s ->> 'ready')::boolean and s ->> 'overall' = 'REVIEW COMPLETE — NOT APPROVED' and jsonb_array_length(s -> 'blockers') = 0
    and (select status::text from public.curriculum_versions where id = v) = 'review', s ->> 'overall' || ' ' || (s -> 'blockers')::text);
  perform test_util.admin_a();
  perform public.record_curriculum_review(v, 'formal_assessment', fa, 'needs_correction', 'TEST DATA: duration needs re-checking', null, null, null, 'scope_question');
  s := public.curriculum_review_summary(v);
  execute 'reset role';
  perform test_util.ok('changing the formal assessment decision to needs correction reopens the review', not (s ->> 'ready')::boolean, s ->> 'overall');
  perform test_util.admin_a();
  perform public.resolve_review_finding((select id from public.curriculum_review_findings where version_id = v and entity_id = fa and status = 'open'), 'resolved', 'TEST DATA: re-checked');
  perform public.record_curriculum_review(v, 'formal_assessment', fa, 'verified', 'TEST DATA: details match the source', test_util.rv('atp'), 'Term 1', '12');
  execute 'reset role';
end $$;

-- ---------------------------------------------------------------------------
-- 10. Approval by a different person; content approval; AI stays closed until the review is clean
-- ---------------------------------------------------------------------------
do $$
declare
  v uuid := test_util.rv('v'); e text; n int; a uuid; l uuid; s jsonb; t uuid := test_util.rv('topic'); o uuid := test_util.rv('obj_wn01'); f uuid; q_before int;
begin
  select id into l from public.lessons where curriculum_version_id = v order by sort_order, title limit 1;
  -- the version's author cannot approve it
  update public.curriculum_versions set created_by = '44444444-4444-4444-4444-444444444444' where id = v;
  perform test_util.admin_a();
  e := test_util.err_of(format('select public.content_transition(''curriculum_version'', %L, ''approved'')', v));
  perform test_util.ok('the author of a curriculum version cannot approve it', e like 'insufficient_privilege%authored%', e);
  execute 'reset role';
  perform test_util.ok('and it was not approved', (select status::text from public.curriculum_versions where id = v) = 'review', 'review');

  -- content authored by the approver cannot be approved by them either
  set session_replication_role = replica;
  update public.lessons set created_by = '44444444-4444-4444-4444-444444444444' where id = l;
  set session_replication_role = origin;
  perform test_util.admin_a();
  e := test_util.err_of(format('select public.content_transition(''lesson'', %L, ''approved'')', l));
  perform test_util.ok('the author of a lesson cannot approve it', e like 'insufficient_privilege%' or e like 'invalid_state%', e);
  execute 'reset role';
  set session_replication_role = replica;
  update public.lessons set created_by = null where id = l;
  set session_replication_role = origin;

  -- a different reviewer approves the version once the review is complete
  perform test_util.admin_b();
  perform public.content_transition('curriculum_version', v, 'approved');
  execute 'reset role';
  select count(*) into n from public.curriculum_versions where id = v and status = 'approved' and approved_by = '99999999-0000-0000-0000-000000000001';
  perform test_util.ok('a different person approves the complete review: approved, with the approver recorded', n = 1, 'rows: ' || n);
  select count(*) into n from public.curriculum_objectives where version_id = v and status = 'approved';
  perform test_util.ok('the objectives mirror the approval', n = 27, 'approved objectives: ' || n);
  select count(*) into n from public.audit_log where entity_id = v and action = 'content_approved' and actor_profile_id = '99999999-0000-0000-0000-000000000001';
  perform test_util.ok('the approval is audited', n = 1, 'rows: ' || n);
  perform test_util.admin_a();
  select status::text into e from public.curriculum_versions where id = v;
  perform test_util.admin_a();
  e := test_util.err_of(format('select public.record_curriculum_review(%L, ''lesson'', %L, ''accepted'', ''late change'')', v, l));
  perform test_util.ok('decisions cannot be recorded once the version is approved', e like 'invalid_state%approved%', e);
  e := test_util.err_of(format('select public.resolve_open_question((select id from public.curriculum_open_questions where version_id = %L limit 1), ''open'', null, null, null, null, ''reopen'')', v));
  perform test_util.ok('open questions cannot be changed once the version is approved', e like 'invalid_state%past review%', e);

  -- after approval, a new finding closes AI drafting again; resolving it reopens it. No provider is ever called here.
  f := public.raise_review_finding(v, 'lesson', l, 'factual_error', 'TEST DATA: a late-found error');
  e := test_util.err_of(format('select public.ai_begin_generation(%L, %L, array[%L]::uuid[], null, ''en'', ''mock'', ''mock-model'', ''p1'')', v, t, o));
  perform test_util.ok('AI drafting closes again when a new finding is raised after approval', e like 'invalid_state%AI drafting is closed%', e);
  perform public.resolve_review_finding(f, 'resolved', 'TEST DATA: corrected in a new version');
  e := test_util.err_of(format('select public.ai_begin_generation(%L, %L, array[%L]::uuid[], null, ''en'', ''mock'', ''mock-model'', ''p1'')', v, t, o));
  perform test_util.ok('with a clean, approved review the review gate no longer blocks (any further refusal is a different rule)', e not like '%AI drafting is closed%', e);
  execute 'reset role';
  delete from public.ai_generation_requests where curriculum_version_id = v;

  -- content approval: lesson accepted at its current content can now be approved by someone else
  perform test_util.admin_b();
  perform public.content_transition('lesson', l, 'approved');
  execute 'reset role';
  perform test_util.ok('a lesson with a current accepted review can be approved', (select status::text from public.lessons where id = l) = 'approved', 'approved');
  select id into a from public.learning_assessments where curriculum_version_id = v order by title limit 1;
  perform test_util.admin_b();
  perform public.content_transition('learning_assessment', a, 'approved');
  execute 'reset role';
  perform test_util.ok('a practice check whose questions are all accepted can be approved', (select status::text from public.learning_assessments where id = a) = 'approved', 'approved');
end $$;

-- ---------------------------------------------------------------------------
-- 11. Legacy versions and the workflow flag
-- ---------------------------------------------------------------------------
do $$
declare v_legacy uuid; e text; flag boolean;
begin
  insert into public.curriculum_versions (code, name, source, review_workflow) values ('REVIEW-LEGACY', 'Legacy fixture', 'test', false) returning id into v_legacy;
  perform test_util.ok('a version created without the workflow flag can be a legacy one (existing versions were set to false by the migration)', not (select review_workflow from public.curriculum_versions where id = v_legacy), 'legacy');
  perform test_util.become('11111111-1111-1111-1111-111111111111', 'teacher', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  e := test_util.err_of(format('select public.require_curriculum_review(%L)', v_legacy));
  perform test_util.ok('a teacher cannot put a version into the workflow', e like 'insufficient_privilege%', e);
  perform test_util.admin_a();
  perform public.require_curriculum_review(v_legacy);
  execute 'reset role';
  select review_workflow into flag from public.curriculum_versions where id = v_legacy;
  perform test_util.ok('a platform administrator can put a legacy version into the workflow', flag, 'switched on');
  perform test_util.ok('the switch is audited', exists (select 1 from public.audit_log where entity_id = v_legacy and action = 'curriculum_review_required'), 'audit');
  set session_replication_role = replica;
  delete from public.audit_log where entity_id = v_legacy;
  delete from public.curriculum_versions where id = v_legacy;
  set session_replication_role = origin;
end $$;

-- ---------------------------------------------------------------------------
-- 12. Teardown: leave the shared universe as found
-- ---------------------------------------------------------------------------
reset role;
set session_replication_role = replica;
do $$
declare v uuid := (select id from public.curriculum_versions where code = 'ZA-G4-MATH-2026-T1');
begin
  delete from public.audit_log where actor_profile_id = '99999999-0000-0000-0000-000000000001'
     or entity_id in (select id from public.curriculum_reviews where version_id = v union select id from public.curriculum_review_findings where version_id = v
                      union select id from public.curriculum_open_questions where version_id = v union select id from public.curriculum_formal_assessment_details where version_id = v
                      union select id from public.lessons where curriculum_version_id = v union select id from public.teaching_resources where curriculum_version_id = v
                      union select id from public.learning_assessments where curriculum_version_id = v union select v)
     or (entity_table = 'curriculum_sources' and entity_id in (test_util.rv('caps'), test_util.rv('atp')));
  delete from public.curriculum_review_findings where version_id = v;
  delete from public.curriculum_reviews where version_id = v;
  delete from public.curriculum_open_questions where version_id = v;
  delete from public.curriculum_formal_assessment_details where version_id = v;
  delete from public.curriculum_source_reviews where source_id in (test_util.rv('caps'), test_util.rv('atp'));
  delete from public.content_review_events where entity_id in (select id from public.lessons where curriculum_version_id = v union select id from public.learning_assessments where curriculum_version_id = v union select v);
  delete from public.content_validation_findings where run_id in (select id from public.content_validation_runs where entity_id in (
    select id from public.lessons where curriculum_version_id = v union select id from public.teaching_resources where curriculum_version_id = v union select id from public.learning_assessments where curriculum_version_id = v));
  delete from public.content_validation_runs where entity_id in (select id from public.lessons where curriculum_version_id = v union select id from public.teaching_resources where curriculum_version_id = v
    union select id from public.learning_assessments where curriculum_version_id = v);
  delete from public.content_source_references where entity_id in (select id from public.lessons where curriculum_version_id = v union select id from public.teaching_resources where curriculum_version_id = v
    union select id from public.learning_assessments where curriculum_version_id = v);
  delete from public.assessment_question_keys where assessment_id in (select id from public.learning_assessments where curriculum_version_id = v);
  delete from public.assessment_questions where curriculum_version_id = v;
  delete from public.assessment_objectives where curriculum_version_id = v;
  delete from public.learning_activities where curriculum_version_id = v;
  delete from public.lesson_resources where curriculum_version_id = v;
  delete from public.lesson_objectives where curriculum_version_id = v;
  delete from public.resource_objectives where curriculum_version_id = v;
  delete from public.learning_assessments where curriculum_version_id = v;
  delete from public.lessons where curriculum_version_id = v;
  delete from public.teaching_resources where curriculum_version_id = v;
  delete from public.curriculum_skills where version_id = v;
  delete from public.curriculum_objectives where version_id = v;
  delete from public.curriculum_subtopics where version_id = v;
  delete from public.curriculum_topics where version_id = v;
  delete from public.curriculum_terms where version_id = v;
  delete from public.curriculum_grade_subjects where version_id = v;
  delete from public.curriculum_subjects where version_id = v;
  delete from public.curriculum_grades where version_id = v;
  delete from public.curriculum_phases where version_id = v;
  delete from public.curriculum_versions where id = v;
  delete from public.curriculum_sources where id in (test_util.rv('caps'), test_util.rv('atp'));
  update public.curriculum_versions
     set name = replace(name, ' [SUPERSEDED DRAFT: not the 2026 ATP Term 1 scope]', ''),
         license_notes = regexp_replace(license_notes, '^SUPERSEDED DRAFT\. Kept for history\..*?\(also a draft\)\. ', '')
   where code = 'ZA-CAPS-G4-MATH-SLICE';
  delete from public.profiles where id = '99999999-0000-0000-0000-000000000001';
  delete from auth.users where id = '99999999-0000-0000-0000-000000000001';
end $$;
set session_replication_role = origin;
drop table test_util.rv;
drop function test_util.rv(text);
drop function test_util.rec(text, text);
drop function test_util.ok(text, boolean, text);
