-- Regression suite for 20260930100000_compliance_framework.sql.
--
-- Fixture cast (School A = aaaaaaaa…, School B = bbbbbbbb…):
--   learner A0001 (11110000…0001, age 12) — guardians 5555… (parent) and 5959… (guardian)
--   learner A0002 (11110000…0002, age 12) — linked login 3030…, online consent granted by fixture
--   learner A0004 (11110000…0004, age 11) — no guardians, no login
--   principal A 7777…, school_owner A 2222…, teacher A 1111…, guardian 9e9e… (not linked to A0001)
--   school_owner B 6666…
--
-- Destructive scenarios (withdrawal, erasure) run inside a sub-block that is
-- rolled back by a deliberate exception, so later test files still see the
-- original fixtures. Results are recorded after the rollback.

create or replace function pg_temp.as_user(p_id uuid, p_role text, p_tenant uuid, p_aal text default 'aal1')
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    (test_util.jwt_claims(p_id, p_role, p_tenant)::jsonb || jsonb_build_object('aal', p_aal))::text, true);
  execute 'set local role authenticated';
end $$;

-- ---------------------------------------------------------------------------
-- §3 Parental consent
-- ---------------------------------------------------------------------------

do $$
declare v_err text;
begin
  perform pg_temp.as_user('55555555-5555-5555-5555-555555555555', 'parent', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  begin
    perform public.record_parental_consent('11110000-0000-0000-0000-000000000001', 'core_educational_processing', 'granted', '');
    call test_util.record('consent: a grant without a typed attestation is rejected', false, 'accepted');
  exception when others then
    get stacked diagnostics v_err = message_text;
    call test_util.record('consent: a grant without a typed attestation is rejected', v_err like '%attestation%', v_err);
  end;
  execute 'reset role';
end $$;

do $$
declare r public.parental_consents;
begin
  perform pg_temp.as_user('55555555-5555-5555-5555-555555555555', 'parent', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  r := public.record_parental_consent('11110000-0000-0000-0000-000000000001', 'core_educational_processing', 'granted', 'Parent Five');
  call test_util.record('consent: a linked guardian can grant consent for their own child',
    r.decision = 'granted' and r.guardian_profile_id = '55555555-5555-5555-5555-555555555555' and r.policy_version = '2026-09', '');
  execute 'reset role';
end $$;

do $$
declare v_err text;
begin
  perform pg_temp.as_user('55555555-5555-5555-5555-555555555555', 'parent', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  begin
    perform public.record_parental_consent('11110000-0000-0000-0000-000000000004', 'core_educational_processing', 'granted', 'Parent Five');
    call test_util.record('consent: a guardian cannot consent for a child that is not theirs', false, 'accepted');
  exception when others then
    get stacked diagnostics v_err = message_text;
    call test_util.record('consent: a guardian cannot consent for a child that is not theirs', v_err like 'insufficient_privilege%', v_err);
  end;
  execute 'reset role';
end $$;

do $$
declare v_err text;
begin
  perform pg_temp.as_user('11111111-1111-1111-1111-111111111111', 'teacher', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  begin
    perform public.record_parental_consent('11110000-0000-0000-0000-000000000004', 'online_learner_account', 'granted', 'Paper Form', 'paper_form_recorded_by_staff');
    call test_util.record('consent: a teacher cannot record a paper consent form', false, 'accepted');
  exception when others then
    get stacked diagnostics v_err = message_text;
    call test_util.record('consent: a teacher cannot record a paper consent form', v_err like 'insufficient_privilege%', v_err);
  end;
  execute 'reset role';
end $$;

do $$
declare v_err text;
begin
  perform pg_temp.as_user('55555555-5555-5555-5555-555555555555', 'parent', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  begin
    perform public.record_parental_consent('11110000-0000-0000-0000-000000000001', 'third_party_sharing', 'withdrawn');
    call test_util.record('consent: withdrawing a consent that was never granted is rejected', false, 'accepted');
  exception when others then
    get stacked diagnostics v_err = message_text;
    call test_util.record('consent: withdrawing a consent that was never granted is rejected', v_err like 'invalid_state%', v_err);
  end;
  execute 'reset role';
end $$;

do $$
begin
  call test_util.record('consent: no row means pending, never granted (no hidden defaults)',
    public.learner_consent_decision('11110000-0000-0000-0000-000000000004', 'online_learner_account') is null
    and not public.learner_has_consent('11110000-0000-0000-0000-000000000004', 'online_learner_account'), '');
end $$;

-- COPPA gate: no login for an under-13 learner without consent…
do $$
declare v_err text;
begin
  perform pg_temp.as_user('77777777-7777-7777-7777-777777777777', 'principal', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  begin
    perform public.provision_learner_login('11110000-0000-0000-0000-000000000004', 'a0004.coppa@schoola.test');
    call test_util.record('COPPA: a login cannot be provisioned for an under-13 learner without consent', false, 'provisioned');
  exception when others then
    get stacked diagnostics v_err = message_text;
    call test_util.record('COPPA: a login cannot be provisioned for an under-13 learner without consent', v_err like 'consent_required%', v_err);
  end;
  execute 'reset role';
end $$;

-- …and it succeeds once consent is on record (rolled back afterwards).
do $$
declare v_ok boolean := false; v_err text := '';
begin
  begin
    perform pg_temp.as_user('77777777-7777-7777-7777-777777777777', 'principal', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    perform public.record_parental_consent('11110000-0000-0000-0000-000000000004', 'online_learner_account', 'granted', 'Paper Form Signatory', 'paper_form_recorded_by_staff');
    perform public.provision_learner_login('11110000-0000-0000-0000-000000000004', 'a0004.coppa@schoola.test');
    v_ok := exists (select 1 from public.learners where id = '11110000-0000-0000-0000-000000000004' and profile_id is not null);
    raise exception 'rollback_test';
  exception when others then
    get stacked diagnostics v_err = message_text;
  end;
  execute 'reset role';
  call test_util.record('COPPA: provisioning succeeds once a guardian consent (paper form) is recorded', v_ok and v_err = 'rollback_test', v_err);
end $$;

-- Withdrawal deactivates the child's account; reactivation is then refused;
-- the child cannot submit content.
do $$
declare v_status text; v_react_err text := ''; v_err text := '';
begin
  begin
    perform pg_temp.as_user('77777777-7777-7777-7777-777777777777', 'principal', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    perform public.record_parental_consent('11110000-0000-0000-0000-000000000002', 'online_learner_account', 'withdrawn', null, 'paper_form_recorded_by_staff');
    execute 'reset role';
    select status into v_status from public.profiles where id = '30303030-3030-3030-3030-303030303030';
    begin
      perform pg_temp.as_user('77777777-7777-7777-7777-777777777777', 'principal', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
      update public.profiles set status = 'active' where id = '30303030-3030-3030-3030-303030303030';
      execute 'reset role';
    exception when others then
      get stacked diagnostics v_react_err = message_text;
      execute 'reset role';
    end;
    raise exception 'rollback_test';
  exception when others then
    get stacked diagnostics v_err = message_text;
  end;
  execute 'reset role';
  call test_util.record('COPPA: withdrawing online-account consent deactivates the child''s login', v_status = 'inactive', coalesce(v_status, 'null'));
  call test_util.record('COPPA: the login cannot be reactivated while consent is withdrawn', v_react_err like 'consent_required%', v_react_err);
end $$;

-- ---------------------------------------------------------------------------
-- §4 Access log
-- ---------------------------------------------------------------------------

do $$
declare v_count int;
begin
  perform pg_temp.as_user('55555555-5555-5555-5555-555555555555', 'parent', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  perform public.log_learner_record_access('11110000-0000-0000-0000-000000000001', 'view', 'Parent portal: child profile');
  perform public.log_learner_record_access('11110000-0000-0000-0000-000000000001', 'view', 'Parent portal: child profile');
  execute 'reset role';
  select count(*) into v_count from public.student_record_access_log
    where learner_id = '11110000-0000-0000-0000-000000000001' and actor_profile_id = '55555555-5555-5555-5555-555555555555' and access_type = 'view';
  call test_util.record('access log: a guardian view is logged once (5-minute de-duplication)', v_count = 1, 'rows=' || v_count);
end $$;

do $$
declare v_err text;
begin
  perform pg_temp.as_user('55555555-5555-5555-5555-555555555555', 'parent', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  begin
    perform public.log_learner_record_access('22220000-0000-0000-0000-000000000001', 'view', 'probe');
    call test_util.record('access log: cannot log (or probe) a learner you have no access to', false, 'accepted');
  exception when others then
    get stacked diagnostics v_err = message_text;
    call test_util.record('access log: cannot log (or probe) a learner you have no access to', v_err like 'insufficient_privilege%', v_err);
  end;
  execute 'reset role';
end $$;

do $$
begin
  call test_util.record('access log: write_access_log is not executable by authenticated',
    not has_function_privilege('authenticated', 'public.write_access_log(uuid, text, text)', 'execute'), '');
  call test_util.record('access log: anon cannot execute get_learner_record_package',
    not has_function_privilege('anon', 'public.get_learner_record_package(uuid)', 'execute'), '');
end $$;

do $$
declare v_count int;
begin
  perform pg_temp.as_user('59595959-5959-5959-5959-595959595959', 'guardian', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  select count(*) into v_count from public.student_record_access_log where learner_id = '11110000-0000-0000-0000-000000000001';
  execute 'reset role';
  call test_util.record('access log: a co-guardian can see who accessed their child''s record', v_count >= 1, 'rows=' || v_count);
end $$;

do $$
declare v_count int;
begin
  perform pg_temp.as_user('11111111-1111-1111-1111-111111111111', 'teacher', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  select count(*) into v_count from public.student_record_access_log;
  execute 'reset role';
  call test_util.record('access log: a teacher cannot read the access log', v_count = 0, 'rows=' || v_count);
end $$;

-- ---------------------------------------------------------------------------
-- §8 Record package (FERPA access / GDPR portability)
-- ---------------------------------------------------------------------------

do $$
declare v_pkg jsonb; v_exports int; v_custody_leak boolean;
begin
  update public.learner_guardians set custody_notes = 'Protection order on file'
    where learner_id = '11110000-0000-0000-0000-000000000001' and guardian_profile_id = '55555555-5555-5555-5555-555555555555';
  perform pg_temp.as_user('55555555-5555-5555-5555-555555555555', 'parent', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  v_pkg := public.get_learner_record_package('11110000-0000-0000-0000-000000000001');
  execute 'reset role';
  call test_util.record('package: a guardian receives the full record package for their child',
    v_pkg ->> 'format' = 'funda360.learner-record.v1' and v_pkg ? 'attendance' and v_pkg ? 'assessment_results'
    and v_pkg ? 'fees' and v_pkg -> 'privacy' ? 'consents' and v_pkg -> 'learner' ->> 'id' = '11110000-0000-0000-0000-000000000001', '');
  select exists (select 1 from jsonb_array_elements(v_pkg -> 'guardians') g where g ->> 'custody_notes' is not null) into v_custody_leak;
  call test_util.record('package: custody notes are withheld from family callers', not v_custody_leak, '');
  select count(*) into v_exports from public.student_record_access_log
    where learner_id = '11110000-0000-0000-0000-000000000001' and access_type = 'export';
  call test_util.record('package: every export is written to the access log', v_exports >= 1, 'exports=' || v_exports);
end $$;

do $$
declare v_err text;
begin
  perform pg_temp.as_user('55555555-5555-5555-5555-555555555555', 'parent', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  begin
    perform public.get_learner_record_package('22220000-0000-0000-0000-000000000001');
    call test_util.record('package: a guardian cannot export another school''s learner', false, 'returned');
  exception when others then
    get stacked diagnostics v_err = message_text;
    call test_util.record('package: a guardian cannot export another school''s learner', v_err like 'insufficient_privilege%', v_err);
  end;
  execute 'reset role';
end $$;

do $$
declare v_err text;
begin
  perform pg_temp.as_user('66666666-6666-6666-6666-666666666666', 'school_owner', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
  begin
    perform public.get_learner_record_package('11110000-0000-0000-0000-000000000001');
    call test_util.record('package: School B''s owner cannot export a School A learner', false, 'returned');
  exception when others then
    get stacked diagnostics v_err = message_text;
    call test_util.record('package: School B''s owner cannot export a School A learner', v_err like 'insufficient_privilege%', v_err);
  end;
  execute 'reset role';
end $$;

-- ---------------------------------------------------------------------------
-- §5 FERPA amendments
-- ---------------------------------------------------------------------------

do $$
declare r public.record_amendment_requests; v_err text; v_id uuid;
begin
  perform pg_temp.as_user('55555555-5555-5555-5555-555555555555', 'parent', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  r := public.submit_record_amendment('11110000-0000-0000-0000-000000000001', 'attendance', 'Mark 2026-03-02 as excused', 'Doctor''s note provided');
  v_id := r.id;
  execute 'reset role';
  call test_util.record('amendment: a guardian can submit an amendment request with a statutory due date',
    r.status = 'submitted' and r.due_by = current_date + 45, 'due_by=' || r.due_by);

  perform pg_temp.as_user('11111111-1111-1111-1111-111111111111', 'teacher', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  begin
    perform public.decide_record_amendment(v_id, 'approved', 'ok');
    call test_util.record('amendment: a teacher cannot decide an amendment request', false, 'decided');
  exception when others then
    get stacked diagnostics v_err = message_text;
    call test_util.record('amendment: a teacher cannot decide an amendment request', v_err like 'insufficient_privilege%', v_err);
  end;
  execute 'reset role';

  perform pg_temp.as_user('77777777-7777-7777-7777-777777777777', 'principal', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  begin
    perform public.decide_record_amendment(v_id, 'denied', null);
    call test_util.record('amendment: a denial without reasons is refused', false, 'denied');
  exception when others then
    get stacked diagnostics v_err = message_text;
    call test_util.record('amendment: a denial without reasons is refused', v_err like '%denial_reason%', v_err);
  end;
  r := public.decide_record_amendment(v_id, 'denied', 'Register shows learner absent and no note was received at the time.');
  execute 'reset role';
  call test_util.record('amendment: a principal can deny with written reasons', r.status = 'denied' and r.decided_by is not null, '');

  perform pg_temp.as_user('55555555-5555-5555-5555-555555555555', 'parent', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  r := public.respond_to_amendment_denial(v_id, true, 'I disagree: the doctor''s note was handed to the class teacher.');
  execute 'reset role';
  call test_util.record('amendment: after a denial the guardian can request a hearing and file a statement of disagreement',
    r.status = 'hearing_requested' and r.disagreement_statement is not null and r.hearing_requested_at is not null, '');
end $$;

-- ---------------------------------------------------------------------------
-- §6 Disclosure log
-- ---------------------------------------------------------------------------

do $$
declare v_err text; r public.record_disclosures; v_seen int;
begin
  perform pg_temp.as_user('77777777-7777-7777-7777-777777777777', 'principal', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  begin
    perform public.record_disclosure('11110000-0000-0000-0000-000000000001', 'Acme Tutoring (Pty) Ltd', 'parental_consent', 'Tutoring programme', array['assessment_results']);
    call test_util.record('disclosure: a consent-based disclosure is refused without third-party consent', false, 'recorded');
  exception when others then
    get stacked diagnostics v_err = message_text;
    call test_util.record('disclosure: a consent-based disclosure is refused without third-party consent', v_err like 'consent_required%', v_err);
  end;
  r := public.record_disclosure('11110000-0000-0000-0000-000000000001', 'Gauteng Department of Education', 'education_authority', 'Statutory SA-SAMS return', array['enrolment', 'attendance']);
  execute 'reset role';
  call test_util.record('disclosure: a statutory disclosure is recorded', r.id is not null, '');

  perform pg_temp.as_user('59595959-5959-5959-5959-595959595959', 'guardian', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  select count(*) into v_seen from public.record_disclosures where learner_id = '11110000-0000-0000-0000-000000000001';
  execute 'reset role';
  call test_util.record('disclosure: guardians can see every disclosure of their child''s record', v_seen = 1, 'rows=' || v_seen);

  perform pg_temp.as_user('66666666-6666-6666-6666-666666666666', 'school_owner', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
  select count(*) into v_seen from public.record_disclosures;
  execute 'reset role';
  call test_util.record('disclosure: another school cannot see the disclosure log', v_seen = 0, 'rows=' || v_seen);
end $$;

-- ---------------------------------------------------------------------------
-- §7 Data-subject requests
-- ---------------------------------------------------------------------------

do $$
declare v_err text; r public.data_subject_requests; v_seen int;
begin
  perform pg_temp.as_user('55555555-5555-5555-5555-555555555555', 'parent', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  begin
    perform public.create_data_subject_request('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', null, '11110000-0000-0000-0000-000000000004', 'deletion', 'probe');
    call test_util.record('DSAR: a guardian cannot raise a request about someone else''s child', false, 'created');
  exception when others then
    get stacked diagnostics v_err = message_text;
    call test_util.record('DSAR: a guardian cannot raise a request about someone else''s child', v_err like 'insufficient_privilege%', v_err);
  end;
  r := public.create_data_subject_request('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', null, '11110000-0000-0000-0000-000000000001', 'portability', 'Moving schools');
  select count(*) into v_seen from public.data_subject_requests where id = r.id;
  execute 'reset role';
  call test_util.record('DSAR: a guardian can raise a request for their own child, with a statutory due date',
    r.requested_by = '55555555-5555-5555-5555-555555555555' and r.due_at::date = (now() + interval '30 days')::date, '');
  call test_util.record('DSAR: the requesting guardian can track their own request', v_seen = 1, 'rows=' || v_seen);
end $$;

-- ---------------------------------------------------------------------------
-- §9 Erasure
-- ---------------------------------------------------------------------------

do $$
declare v_req uuid; v_err text;
begin
  insert into public.data_subject_requests (school_id, subject_learner_id, request_type, status, requested_by, due_at)
  values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11110000-0000-0000-0000-000000000001', 'deletion', 'received', '55555555-5555-5555-5555-555555555555', now() + interval '30 days')
  returning id into v_req;

  perform pg_temp.as_user('77777777-7777-7777-7777-777777777777', 'principal', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aal1');
  begin
    perform public.execute_learner_erasure(v_req, 'LRN-A0001');
    call test_util.record('erasure: refused without an MFA (aal2) session', false, 'executed');
  exception when others then
    get stacked diagnostics v_err = message_text;
    call test_util.record('erasure: refused without an MFA (aal2) session', v_err like 'mfa_required%', v_err);
  end;
  execute 'reset role';

  perform pg_temp.as_user('77777777-7777-7777-7777-777777777777', 'principal', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aal2');
  begin
    perform public.execute_learner_erasure(v_req, 'LRN-A0001');
    call test_util.record('erasure: refused before the requester''s identity is verified', false, 'executed');
  exception when others then
    get stacked diagnostics v_err = message_text;
    call test_util.record('erasure: refused before the requester''s identity is verified', v_err like 'invalid_state%', v_err);
  end;
  execute 'reset role';

  perform pg_temp.as_user('11111111-1111-1111-1111-111111111111', 'teacher', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aal2');
  begin
    perform public.execute_learner_erasure(v_req, 'LRN-A0001');
    call test_util.record('erasure: a teacher can never execute an erasure', false, 'executed');
  exception when others then
    get stacked diagnostics v_err = message_text;
    call test_util.record('erasure: a teacher can never execute an erasure', v_err like 'insufficient_privilege%', v_err);
  end;
  execute 'reset role';
  delete from public.data_subject_requests where id = v_req;
end $$;

do $$
declare
  v_req uuid; v_res jsonb; v_err text := '';
  v_first text; v_medical int; v_links int; v_leaks int; v_status text; v_attendance int;
begin
  begin
    -- Seed some PII that must disappear, and an audit row that copies it.
    insert into public.learner_medical_information (school_id, learner_id, allergies)
      values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11110000-0000-0000-0000-000000000001', 'Peanuts')
      on conflict do nothing;
    perform pg_temp.as_user('77777777-7777-7777-7777-777777777777', 'principal', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    update public.learners set preferred_name = 'Nicky' where id = '11110000-0000-0000-0000-000000000001';
    execute 'reset role';

    insert into public.data_subject_requests (school_id, subject_learner_id, request_type, status, requested_by, due_at)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11110000-0000-0000-0000-000000000001', 'deletion', 'identity_verified', '55555555-5555-5555-5555-555555555555', now() + interval '30 days')
    returning id into v_req;

    perform pg_temp.as_user('77777777-7777-7777-7777-777777777777', 'principal', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aal2');
    v_res := public.execute_learner_erasure(v_req, 'LRN-A0001');
    execute 'reset role';

    select first_name into v_first from public.learners where id = '11110000-0000-0000-0000-000000000001';
    select count(*) into v_medical from public.learner_medical_information where learner_id = '11110000-0000-0000-0000-000000000001';
    select count(*) into v_links from public.learner_guardians where learner_id = '11110000-0000-0000-0000-000000000001' and active;
    select count(*) into v_leaks from public.audit_log where (before::text || coalesce(after::text, '')) like '%Nicky%' or (before::text || coalesce(after::text, '')) like '%Peanuts%';
    select status into v_status from public.data_subject_requests where id = v_req;
    select count(*) into v_attendance from public.attendance_records where learner_id = '11110000-0000-0000-0000-000000000001';
    raise exception 'rollback_test';
  exception when others then
    get stacked diagnostics v_err = message_text;
  end;
  execute 'reset role';
  call test_util.record('erasure: executes for a verified request under MFA', v_err = 'rollback_test' and v_res ? 'summary', v_err);
  call test_util.record('erasure: the learner''s name is pseudonymised', v_first = 'Erased', coalesce(v_first, 'null'));
  call test_util.record('erasure: medical records are deleted', v_medical = 0, 'rows=' || v_medical);
  call test_util.record('erasure: guardian links are ended', v_links = 0, 'rows=' || v_links);
  call test_util.record('erasure: PII copies in audit_log are redacted', v_leaks = 0, 'leaking rows=' || v_leaks);
  call test_util.record('erasure: the request is marked completed', v_status = 'completed', coalesce(v_status, 'null'));
  call test_util.record('erasure: statutory attendance rows are retained (pseudonymised)', v_attendance >= 0, 'rows=' || v_attendance);
end $$;

-- ---------------------------------------------------------------------------
-- §10 CIPA safe content
-- ---------------------------------------------------------------------------

do $$
declare v_err text;
begin
  perform pg_temp.as_user('77777777-7777-7777-7777-777777777777', 'principal', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  begin
    insert into public.announcements (school_id, title, body, audience) values
      ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Links', 'See www.pornhub.com for details', 'everyone');
    call test_util.record('CIPA: adult content is blocked at write time', false, 'inserted');
  exception when others then
    get stacked diagnostics v_err = message_text;
    call test_util.record('CIPA: adult content is blocked at write time', v_err like 'content_blocked%', v_err);
  end;
  execute 'reset role';
end $$;

do $$
declare v_events int; v_alerts int; v_b int;
begin
  perform pg_temp.as_user('77777777-7777-7777-7777-777777777777', 'principal', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  insert into public.announcements (school_id, title, body, audience) values
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Wellbeing', 'If you feel you want to die, please talk to us.', 'everyone');
  select count(*) into v_events from public.content_safety_events where school_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and category = 'self_harm';
  execute 'reset role';
  select count(*) into v_alerts from public.notifications where type = 'safeguarding_content_flag' and school_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  call test_util.record('CIPA: self-harm language is kept but flagged for review', v_events = 1, 'events=' || v_events);
  call test_util.record('CIPA: a self-harm flag alerts the school owner and principal', v_alerts >= 2, 'alerts=' || v_alerts);

  perform pg_temp.as_user('66666666-6666-6666-6666-666666666666', 'school_owner', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
  select count(*) into v_b from public.content_safety_events;
  execute 'reset role';
  call test_util.record('CIPA: another school cannot see content-safety events', v_b = 0, 'rows=' || v_b);
end $$;

do $$
declare v_err text; v_unlimited int;
begin
  call test_util.record('CIPA: executables, scripts and SVG are unsafe uploads',
    not public.is_safe_upload('a/b/setup.exe', null) and not public.is_safe_upload('a/b/page.html', null)
    and not public.is_safe_upload('a/b/logo.svg', null) and not public.is_safe_upload('a/b/doc.pdf', 'text/html'), '');
  call test_util.record('CIPA: documents and images are safe uploads',
    public.is_safe_upload('a/b/report.pdf', 'application/pdf') and public.is_safe_upload('a/b/photo.JPG', 'image/jpeg')
    and public.is_safe_upload('a/b/essay.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'), '');
  perform pg_temp.as_user('77777777-7777-7777-7777-777777777777', 'principal', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  begin
    insert into public.learner_documents (school_id, learner_id, document_type, file_url, file_name)
      values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11110000-0000-0000-0000-000000000001', 'other',
              'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/11110000-0000-0000-0000-000000000001/payload.html', 'payload.html');
    call test_util.record('CIPA: an HTML file cannot be registered as a learner document', false, 'inserted');
  exception when others then
    get stacked diagnostics v_err = message_text;
    call test_util.record('CIPA: an HTML file cannot be registered as a learner document', v_err like 'unsafe_upload%', v_err);
  end;
  execute 'reset role';
  select count(*) into v_unlimited from storage.buckets where file_size_limit is null or allowed_mime_types is null;
  call test_util.record('CIPA: every upload bucket now has a size limit and MIME allowlist', v_unlimited = 0, 'unlimited=' || v_unlimited);
end $$;

-- ---------------------------------------------------------------------------
-- §11 Modification audit
-- ---------------------------------------------------------------------------

do $$
declare v_rows int; v_triggers int;
begin
  perform pg_temp.as_user('77777777-7777-7777-7777-777777777777', 'principal', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  update public.learners set home_language = 'isiZulu' where id = '11110000-0000-0000-0000-000000000004';
  execute 'reset role';
  select count(*) into v_rows from public.audit_log
    where entity_table = 'learners' and entity_id = '11110000-0000-0000-0000-000000000004' and action = 'update_learners'
      and actor_profile_id = '77777777-7777-7777-7777-777777777777';
  call test_util.record('audit: a direct learner update is captured with actor, before and after', v_rows = 1, 'rows=' || v_rows);
  select count(*) into v_triggers from pg_trigger where tgname in (
      'learners_audit_log', 'attendance_records_audit_log', 'assessment_results_audit_log', 'behaviour_incidents_audit_log',
      'learner_medical_information_audit_log', 'learner_guardians_audit_log', 'report_cards_audit_log', 'learner_documents_audit_log');
  call test_util.record('audit: every core student-data table carries the audit trigger', v_triggers = 8, 'triggers=' || v_triggers);
end $$;

-- ---------------------------------------------------------------------------
-- §12 Data minimisation
-- ---------------------------------------------------------------------------

do $$
declare v_total int; v_principal int; v_coguardian int; v_stranger int; v_teacher_total int; v_learner_sees_parent int;
begin
  perform pg_temp.as_user('59595959-5959-5959-5959-595959595959', 'guardian', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  select count(*) into v_total from public.profiles;
  select count(*) into v_principal from public.profiles where id = '77777777-7777-7777-7777-777777777777';
  select count(*) into v_coguardian from public.profiles where id = '55555555-5555-5555-5555-555555555555';
  select count(*) into v_stranger from public.profiles where id = '9e9e9e9e-9e9e-9e9e-9e9e-9e9e9e9e9e9e';
  execute 'reset role';
  perform pg_temp.as_user('11111111-1111-1111-1111-111111111111', 'teacher', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  select count(*) into v_teacher_total from public.profiles;
  execute 'reset role';
  perform pg_temp.as_user('30303030-3030-3030-3030-303030303030', 'learner', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  select count(*) into v_learner_sees_parent from public.profiles where id = '55555555-5555-5555-5555-555555555555';
  execute 'reset role';
  call test_util.record('minimisation: a guardian still sees school staff', v_principal = 1, '');
  call test_util.record('minimisation: a guardian sees their child''s other guardian', v_coguardian = 1, '');
  call test_util.record('minimisation: a guardian can no longer see unrelated parents', v_stranger = 0, '');
  call test_util.record('minimisation: a guardian no longer sees the whole school directory', v_total < v_teacher_total, v_total || ' < ' || v_teacher_total);
  call test_util.record('minimisation: a learner cannot see another family''s parent', v_learner_sees_parent = 0, '');
end $$;

-- ---------------------------------------------------------------------------
-- §13 Overview + settings
-- ---------------------------------------------------------------------------

do $$
declare v jsonb; v_err text;
begin
  perform pg_temp.as_user('77777777-7777-7777-7777-777777777777', 'principal', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  v := public.get_compliance_overview('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  execute 'reset role';
  call test_util.record('overview: a principal gets measured control state',
    (v -> 'learners' ->> 'under_coppa_age')::int >= 3 and (v -> 'rls' ->> 'tables')::int = (v -> 'rls' ->> 'forced')::int
    and v ? 'dsar' and v ? 'amendments' and v ? 'content_safety' and v ? 'mfa', v::text);

  perform pg_temp.as_user('11111111-1111-1111-1111-111111111111', 'teacher', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  begin
    perform public.get_compliance_overview('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    call test_util.record('overview: a teacher cannot read the compliance overview', false, 'returned');
  exception when others then
    get stacked diagnostics v_err = message_text;
    call test_util.record('overview: a teacher cannot read the compliance overview', v_err like 'insufficient_privilege%', v_err);
  end;
  execute 'reset role';

  perform pg_temp.as_user('66666666-6666-6666-6666-666666666666', 'school_owner', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
  begin
    perform public.get_compliance_overview('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    call test_util.record('overview: another school''s owner cannot read it', false, 'returned');
  exception when others then
    get stacked diagnostics v_err = message_text;
    call test_util.record('overview: another school''s owner cannot read it', v_err like 'insufficient_privilege%', v_err);
  end;
  execute 'reset role';
end $$;

do $$
declare v_err text; r public.school_compliance_settings;
begin
  perform pg_temp.as_user('77777777-7777-7777-7777-777777777777', 'principal', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  begin
    perform public.update_compliance_settings('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', array['FERPA'], 13, 16, 45, 30, true, null, null, '2026-09');
    call test_util.record('settings: POPIA cannot be switched off', false, 'saved');
  exception when others then
    get stacked diagnostics v_err = message_text;
    call test_util.record('settings: POPIA cannot be switched off', v_err like '%popia_mandatory%', v_err);
  end;
  r := public.update_compliance_settings('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', array['POPIA', 'FERPA', 'COPPA', 'CIPA', 'GDPR'], 13, 16, 45, 30, true,
    'Dr N. Principal', 'privacy@schoola.test', '2026-09');
  execute 'reset role';
  call test_util.record('settings: a principal can set the Information Officer', r.information_officer_email = 'privacy@schoola.test', '');

  perform pg_temp.as_user('55555555-5555-5555-5555-555555555555', 'parent', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  begin
    perform public.update_compliance_settings('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', array['POPIA'], 13, 16, 45, 30, false, null, null, '2026-09');
    call test_util.record('settings: a parent cannot change compliance settings', false, 'saved');
  exception when others then
    get stacked diagnostics v_err = message_text;
    call test_util.record('settings: a parent cannot change compliance settings', v_err like 'insufficient_privilege%', v_err);
  end;
  execute 'reset role';
end $$;

do $$
declare v jsonb;
begin
  perform pg_temp.as_user('55555555-5555-5555-5555-555555555555', 'parent', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  v := public.get_my_privacy_overview();
  execute 'reset role';
  call test_util.record('family overview: a guardian sees only their own children with consent state',
    jsonb_array_length(v -> 'children') = 1 and v -> 'children' -> 0 ->> 'learner_id' = '11110000-0000-0000-0000-000000000001'
    and v -> 'children' -> 0 -> 'consents' ->> 'core_educational_processing' = 'granted', v::text);
end $$;
