-- Regression suite for 20260930120000_operations_roles.sql and
-- 20260930121000_staff_provisioning_and_references.sql.

do $$
declare v_missing text;
begin
  select string_agg(r, ', ') into v_missing
  from unnest(array['asset_manager', 'boarding_manager', 'events_coordinator', 'governance_officer', 'procurement_officer']) r
  where r <> all (enum_range(null::public.user_role)::text[]);
  call test_util.record('operations roles exist in user_role', v_missing is null, coalesce(v_missing, ''));
end $$;

do $$
declare v_ok boolean; v_bad boolean;
begin
  select bool_and(public.can_assign_employee_role(r::public.user_role)) into v_ok
  from unnest(array['finance_manager', 'vice_principal', 'class_teacher', 'subject_teacher', 'transport_coordinator',
                    'sports_coordinator', 'auditor', 'asset_manager', 'boarding_manager', 'events_coordinator',
                    'governance_officer', 'procurement_officer', 'hr_manager', 'teacher']) r;
  call test_util.record('staff roles are provisionable through employee onboarding', v_ok, '');
  select bool_or(public.can_assign_employee_role(r::public.user_role)) into v_bad
  from unnest(array['school_owner', 'principal', 'platform_owner', 'super_administrator', 'platform_administrator',
                    'support_engineer', 'parent', 'guardian', 'learner', 'guest']) r;
  call test_util.record('governance, platform, family and guest roles are never provisionable as employees', not v_bad, '');
end $$;

-- A school owner can now provision a finance manager login for their own employee.
do $$
declare v_emp uuid; v_uid uuid; v_role text; v_err text := '';
begin
  insert into public.employees (school_id, employee_number, first_name, last_name, work_email, hire_date)
  values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'EMP-FIN-P2', 'Fiona', 'Finance', 'fiona.p2@schoola.test', current_date)
  returning id into v_emp;
  perform set_config('request.jwt.claims', test_util.jwt_claims('22222222-2222-2222-2222-222222222222', 'school_owner', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), true);
  execute 'set local role authenticated';
  begin
    select user_id into v_uid from public.provision_employee_login(v_emp, 'finance_manager', null);
  exception when others then
    get stacked diagnostics v_err = message_text;
  end;
  execute 'reset role';
  select role::text into v_role from public.profiles where id = v_uid;
  call test_util.record('a school owner can provision a finance_manager login', v_role = 'finance_manager', coalesce(v_role, v_err));
end $$;

-- …but a teacher still cannot provision anything.
do $$
declare v_emp uuid; v_err text := '';
begin
  select id into v_emp from public.employees where employee_number = 'EMP-FIN-P2';
  perform set_config('request.jwt.claims', test_util.jwt_claims('11111111-1111-1111-1111-111111111111', 'teacher', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), true);
  execute 'set local role authenticated';
  begin
    perform public.provision_employee_login(v_emp, 'boarding_manager', null);
  exception when others then
    get stacked diagnostics v_err = message_text;
  end;
  execute 'reset role';
  call test_util.record('a teacher cannot provision staff logins', v_err like 'insufficient_privilege%' or v_err like '%already%', v_err);
end $$;

-- An operations role now actually reaches its operations authorization path.
do $$
declare v_uid uuid := 'abababab-0000-0000-0000-000000000001'; v_allowed boolean;
begin
  insert into auth.users (id, email, raw_app_meta_data) values (v_uid, 'boarding.p2@schoola.test', '{"role":"boarding_manager"}');
  insert into public.profiles (id, tenant_id, first_name, last_name, email, role, status)
  values (v_uid, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Bo', 'Arding', 'boarding.p2@schoola.test', 'boarding_manager', 'active');
  perform set_config('request.jwt.claims', test_util.jwt_claims(v_uid, 'boarding_manager', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), true);
  execute 'set local role authenticated';
  v_allowed := public.can_manage_operations('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  execute 'reset role';
  call test_util.record('a boarding_manager can manage operations in their own school', v_allowed, '');
end $$;

-- Admission references: readable prefix + random suffix, unique, still internal.
do $$
declare v_a text; v_b text;
begin
  v_a := public.next_admission_reference('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  v_b := public.next_admission_reference('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  call test_util.record('admission references carry a random suffix',
    v_a ~ '^APP-\d{4}-\d{5}-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$', v_a);
  call test_util.record('consecutive admission references differ beyond the counter',
    split_part(v_a, '-', 4) <> split_part(v_b, '-', 4) or split_part(v_a, '-', 3) <> split_part(v_b, '-', 3), v_a || ' / ' || v_b);
  call test_util.record('next_admission_reference is not callable by clients',
    not has_function_privilege('authenticated', 'public.next_admission_reference(uuid)', 'execute')
    and not has_function_privilege('anon', 'public.next_admission_reference(uuid)', 'execute'), '');
end $$;
