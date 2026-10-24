-- Regression suite for 20261024090000_platform_support_access.sql.
-- Platform roles have no standing access to safeguarding, medical,
-- behaviour or messages; a school-approved, time-limited, aal2-only,
-- personal, read-only support grant opens exactly the granted areas of
-- exactly one school.
--
-- Fixtures: School A owner 22222222, teacher 11111111, platform admin
-- 44444444 (02_fixtures); School A safeguarding concern and medical row
-- (safeguarding / learner_management tests); conversations and behaviour
-- incidents from the communication and behaviour tests. Added here: a School
-- B owner, a second platform user and one School B safeguarding concern.

create or replace function pg_temp.claims(p_uid uuid, p_role text, p_tenant uuid, p_aal text)
returns text language sql as $$
  select (test_util.jwt_claims(p_uid, p_role, p_tenant)::jsonb || jsonb_build_object('aal', p_aal))::text
$$;

create or replace function pg_temp.visible(p_table text, p_school uuid)
returns int language plpgsql as $$
declare n int;
begin
  execute format('select count(*) from public.%I where school_id = $1', p_table) into n using p_school;
  return n;
end $$;

do $$
begin
  insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data) values
    ('00000000-0000-0000-0000-000000000000', 'f5f50000-0000-0000-0000-0000000000b1', 'authenticated', 'authenticated',
     'support-owner-b@schoolb.test', jsonb_build_object('role', 'school_owner', 'tenant_id', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')),
    ('00000000-0000-0000-0000-000000000000', 'f5f50000-0000-0000-0000-0000000000e2', 'authenticated', 'authenticated',
     'support-owner@funda360.test', jsonb_build_object('role', 'platform_owner'));
  insert into public.profiles (id, tenant_id, first_name, last_name, email, role, status) values
    ('f5f50000-0000-0000-0000-0000000000b1', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Owner', 'B', 'support-owner-b@schoolb.test', 'school_owner', 'active'),
    ('f5f50000-0000-0000-0000-0000000000e2', null, 'Second', 'Platform', 'support-owner@funda360.test', null, 'active');
  insert into public.safeguarding_concerns (id, school_id, learner_id, description, severity)
    select 'f5f50000-0000-0000-0000-0000000000c1', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', l.id, 'School B concern', 'medium'
    from public.learners l where l.school_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' limit 1;
end $$;

-- ---------------------------------------------------------------------------
-- 0. Preconditions: School A has rows in every area, so "0 visible" below
-- means "hidden", not "empty".
do $$
declare v_sg int; v_med int; v_beh int; v_msg int; v_conv int; v_sg_b int;
begin
  v_sg := pg_temp.visible('safeguarding_concerns', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  v_med := pg_temp.visible('learner_medical_information', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  v_beh := pg_temp.visible('behaviour_incidents', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  v_msg := pg_temp.visible('messages', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  v_conv := pg_temp.visible('conversations', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  v_sg_b := pg_temp.visible('safeguarding_concerns', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
  call test_util.record('support: fixtures hold School A safeguarding, medical, behaviour and messages, and School B safeguarding',
    v_sg > 0 and v_med > 0 and v_beh > 0 and v_msg > 0 and v_conv > 0 and v_sg_b > 0,
    format('sg %s med %s beh %s msg %s conv %s sgB %s', v_sg, v_med, v_beh, v_msg, v_conv, v_sg_b));
end $$;

-- ---------------------------------------------------------------------------
-- 1. No standing access, even with MFA.
do $$
declare v_sg int; v_med int; v_beh int; v_msg int; v_conv int; v_part int; v_att int; v_error text;
begin
  perform set_config('request.jwt.claims',
    pg_temp.claims('44444444-4444-4444-4444-444444444444', 'platform_administrator', null, 'aal2'), true);
  execute 'set local role authenticated';
  select count(*) into v_sg from public.safeguarding_concerns;
  select count(*) into v_med from public.learner_medical_information;
  select count(*) into v_beh from public.behaviour_incidents;
  select count(*) into v_msg from public.messages;
  select count(*) into v_conv from public.conversations;
  select count(*) into v_part from public.conversation_participants;
  select count(*) into v_att from public.message_attachments;
  begin
    insert into public.safeguarding_concerns (school_id, learner_id, description, severity)
      values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11110000-0000-0000-0000-000000000001', 'platform write', 'low');
    v_error := 'insert succeeded';
  exception when others then
    v_error := null;
  end;
  execute 'reset role';
  call test_util.record('support: without a grant a platform admin sees no safeguarding, medical or behaviour rows',
    v_sg = 0 and v_med = 0 and v_beh = 0, format('sg %s med %s beh %s', v_sg, v_med, v_beh));
  call test_util.record('support: without a grant a platform admin sees no conversations, messages, participants or attachments',
    v_msg = 0 and v_conv = 0 and v_part = 0 and v_att = 0, format('msg %s conv %s part %s att %s', v_msg, v_conv, v_part, v_att));
  call test_util.record('support: a platform admin cannot write a safeguarding concern', v_error is null, coalesce(v_error, 'refused'));
end $$;

-- ---------------------------------------------------------------------------
-- 2. Request: validation, and a pending request opens nothing.
do $$
declare v_grant public.platform_support_grants; v_error text; v_sg int; v_audit int; v_notified int;
begin
  perform set_config('request.jwt.claims',
    pg_temp.claims('44444444-4444-4444-4444-444444444444', 'platform_administrator', null, 'aal2'), true);
  execute 'set local role authenticated';
  begin
    perform public.request_platform_support_access('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', array['finances'], 'Investigating a reported bug', 4);
    v_error := 'accepted an unknown area';
  exception when others then
    v_error := null;
  end;
  if v_error is null then
    begin
      perform public.request_platform_support_access('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', array['safeguarding'], 'Investigating a reported bug', 100);
      v_error := 'accepted 100 hours';
    exception when others then
      v_error := null;
    end;
  end if;
  select * into v_grant from public.request_platform_support_access(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', array['safeguarding', 'messages'], 'School reported missing concern history', 4);
  select count(*) into v_sg from public.safeguarding_concerns;
  execute 'reset role';

  select count(*) into v_audit from public.audit_log where action = 'platform_support_access_requested' and entity_id = v_grant.id;
  select count(*) into v_notified from public.notifications
    where related_entity_id = v_grant.id and recipient_profile_id = '22222222-2222-2222-2222-222222222222';
  call test_util.record('support: an unknown area or more than 72 hours is refused', v_error is null, coalesce(v_error, 'refused'));
  call test_util.record('support: a request starts pending, recorded in the audit log and notified to the school owner',
    v_grant.status = 'pending' and v_audit = 1 and v_notified = 1, format('status %s audit %s notified %s', v_grant.status, v_audit, v_notified));
  call test_util.record('support: a pending request opens nothing', v_sg = 0, 'rows: ' || v_sg);
end $$;

-- ---------------------------------------------------------------------------
-- 3. Who may decide: not the requester, not another school's owner.
do $$
declare v_id uuid; v_self text; v_other text;
begin
  select id into v_id from public.platform_support_grants where status = 'pending' order by created_at desc limit 1;

  perform set_config('request.jwt.claims',
    pg_temp.claims('44444444-4444-4444-4444-444444444444', 'platform_administrator', null, 'aal2'), true);
  execute 'set local role authenticated';
  begin
    perform public.decide_platform_support_access(v_id, true, null);
    v_self := 'approved own request';
  exception when others then
    v_self := null;
  end;
  execute 'reset role';

  perform set_config('request.jwt.claims',
    pg_temp.claims('f5f50000-0000-0000-0000-0000000000b1', 'school_owner', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'aal1'), true);
  execute 'set local role authenticated';
  begin
    perform public.decide_platform_support_access(v_id, true, null);
    v_other := 'another school approved it';
  exception when others then
    v_other := null;
  end;
  execute 'reset role';

  call test_util.record('support: a platform admin cannot approve their own request', v_self is null, coalesce(v_self, 'refused'));
  call test_util.record('support: another school''s owner cannot approve it', v_other is null, coalesce(v_other, 'refused'));
end $$;

-- ---------------------------------------------------------------------------
-- 4. The school approves: granted areas of that school only, aal2 only,
-- read-only, personal to the requester.
do $$
declare
  v_id uuid;
  v_grant public.platform_support_grants;
  v_seen_by_school int;
  v_aal1 int;
  v_sg_a int; v_sg_b int; v_med int; v_beh int; v_msg int; v_conv int; v_total_msg int;
  v_write text;
  v_other_platform int;
begin
  select id into v_id from public.platform_support_grants where status = 'pending' order by created_at desc limit 1;

  perform set_config('request.jwt.claims',
    pg_temp.claims('22222222-2222-2222-2222-222222222222', 'school_owner', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aal1'), true);
  execute 'set local role authenticated';
  select count(*) into v_seen_by_school from public.platform_support_grants where id = v_id;
  select * into v_grant from public.decide_platform_support_access(v_id, true, 'Approved for the investigation');
  execute 'reset role';

  call test_util.record('support: the school owner sees the request and can approve it',
    v_seen_by_school = 1 and v_grant.status = 'approved'
      and v_grant.expires_at between now() + interval '3 hours 59 minutes' and now() + interval '4 hours 1 minute',
    format('seen %s status %s expires %s', v_seen_by_school, v_grant.status, v_grant.expires_at));

  perform set_config('request.jwt.claims',
    pg_temp.claims('44444444-4444-4444-4444-444444444444', 'platform_administrator', null, 'aal1'), true);
  execute 'set local role authenticated';
  select count(*) into v_aal1 from public.safeguarding_concerns;
  execute 'reset role';
  call test_util.record('support: an approved grant is unusable without MFA (aal1)', v_aal1 = 0, 'rows: ' || v_aal1);

  select count(*) into v_total_msg from public.messages where school_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  perform set_config('request.jwt.claims',
    pg_temp.claims('44444444-4444-4444-4444-444444444444', 'platform_administrator', null, 'aal2'), true);
  execute 'set local role authenticated';
  select count(*) into v_sg_a from public.safeguarding_concerns where school_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  select count(*) into v_sg_b from public.safeguarding_concerns where school_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  select count(*) into v_med from public.learner_medical_information;
  select count(*) into v_beh from public.behaviour_incidents;
  select count(*) into v_msg from public.messages;
  select count(*) into v_conv from public.conversations where school_id <> 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  begin
    update public.safeguarding_concerns set description = 'edited by platform' where school_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    get diagnostics v_sg_b = row_count;
    v_write := case when v_sg_b > 0 then 'updated ' || v_sg_b || ' rows' end;
  exception when others then
    v_write := null;
  end;
  select count(*) into v_sg_b from public.safeguarding_concerns where school_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  execute 'reset role';

  call test_util.record('support: with MFA the grant opens School A safeguarding and messages',
    v_sg_a > 0 and v_msg = v_total_msg and v_msg > 0, format('sg %s msg %s of %s', v_sg_a, v_msg, v_total_msg));
  call test_util.record('support: the grant does not open another school, or areas it does not name',
    v_sg_b = 0 and v_med = 0 and v_beh = 0 and v_conv = 0, format('sgB %s med %s beh %s other conv %s', v_sg_b, v_med, v_beh, v_conv));
  call test_util.record('support: the grant is read-only', v_write is null, coalesce(v_write, 'no rows changed'));

  perform set_config('request.jwt.claims',
    pg_temp.claims('f5f50000-0000-0000-0000-0000000000e2', 'platform_owner', null, 'aal2'), true);
  execute 'set local role authenticated';
  select count(*) into v_other_platform from public.safeguarding_concerns;
  execute 'reset role';
  call test_util.record('support: the grant is personal; another platform user sees nothing', v_other_platform = 0, 'rows: ' || v_other_platform);
end $$;

-- ---------------------------------------------------------------------------
-- 5. Revocation by the school and expiry both close access.
do $$
declare v_id uuid; v_after_revoke int; v_after_expiry int; v_grant2 public.platform_support_grants; v_audit int;
begin
  select id into v_id from public.platform_support_grants where status = 'approved' order by created_at desc limit 1;

  perform set_config('request.jwt.claims',
    pg_temp.claims('22222222-2222-2222-2222-222222222222', 'school_owner', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aal1'), true);
  execute 'set local role authenticated';
  perform public.revoke_platform_support_access(v_id);
  execute 'reset role';

  perform set_config('request.jwt.claims',
    pg_temp.claims('44444444-4444-4444-4444-444444444444', 'platform_administrator', null, 'aal2'), true);
  execute 'set local role authenticated';
  select count(*) into v_after_revoke from public.safeguarding_concerns;
  select * into v_grant2 from public.request_platform_support_access(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', array['safeguarding'], 'Second look at the same issue', 1);
  execute 'reset role';

  perform set_config('request.jwt.claims',
    pg_temp.claims('22222222-2222-2222-2222-222222222222', 'school_owner', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aal1'), true);
  execute 'set local role authenticated';
  perform public.decide_platform_support_access(v_grant2.id, true, null);
  execute 'reset role';
  -- Move the window into the past (as the fixture superuser).
  update public.platform_support_grants
    set starts_at = now() - interval '3 hours', expires_at = now() - interval '2 hours'
    where id = v_grant2.id;

  perform set_config('request.jwt.claims',
    pg_temp.claims('44444444-4444-4444-4444-444444444444', 'platform_administrator', null, 'aal2'), true);
  execute 'set local role authenticated';
  select count(*) into v_after_expiry from public.safeguarding_concerns;
  execute 'reset role';

  select count(*) into v_audit from public.audit_log
    where entity_id in (v_id, v_grant2.id)
      and action in ('platform_support_access_requested', 'platform_support_access_approved', 'platform_support_access_revoked');
  call test_util.record('support: revocation by the school closes access', v_after_revoke = 0, 'rows: ' || v_after_revoke);
  call test_util.record('support: an expired grant opens nothing', v_after_expiry = 0, 'rows: ' || v_after_expiry);
  call test_util.record('support: requests, approvals and revocation are all in the audit log', v_audit = 5, 'entries: ' || v_audit);
end $$;

-- ---------------------------------------------------------------------------
-- 6. The learner record package gives medical and behaviour only to callers
-- who may read them. An admissions officer can view learners but not their
-- medical information or behaviour (impersonated on the School A teacher
-- profile, which supplies the tenant).
do $$
declare v_staff jsonb; v_owner jsonb;
begin
  perform set_config('request.jwt.claims',
    pg_temp.claims('11111111-1111-1111-1111-111111111111', 'admissions_officer', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aal1'), true);
  execute 'set local role authenticated';
  v_staff := public.get_learner_record_package('11110000-0000-0000-0000-000000000001');
  execute 'reset role';

  perform set_config('request.jwt.claims',
    pg_temp.claims('22222222-2222-2222-2222-222222222222', 'school_owner', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aal1'), true);
  execute 'set local role authenticated';
  v_owner := public.get_learner_record_package('11110000-0000-0000-0000-000000000001');
  execute 'reset role';

  call test_util.record('record package: staff who cannot read medical information get none',
    v_staff -> 'medical' is null or v_staff -> 'medical' = 'null'::jsonb, coalesce((v_staff -> 'medical')::text, 'null'));
  call test_util.record('record package: staff who cannot read behaviour get only guardian-visible incidents (none, as staff)',
    jsonb_array_length(v_staff -> 'behaviour') = 0 and jsonb_array_length(v_owner -> 'behaviour') > 0,
    format('staff %s owner %s', jsonb_array_length(v_staff -> 'behaviour'), jsonb_array_length(v_owner -> 'behaviour')));
  call test_util.record('record package: the school owner still gets medical information',
    jsonb_typeof(v_owner -> 'medical') = 'object', coalesce((v_owner -> 'medical')::text, 'null'));
end $$;
