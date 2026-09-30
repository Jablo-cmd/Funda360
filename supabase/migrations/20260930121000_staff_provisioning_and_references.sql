-- Staff provisioning roles + unguessable admission references (audit P2).

-- ---------------------------------------------------------------------------
-- 1. Staff logins a school can provision itself.
--
-- provision_employee_login() is callable by can_manage_employees() (school
-- owner, HR manager). Its role allow-list omitted finance_manager,
-- vice_principal, class/subject teacher, the coordinators, auditor and the
-- operations roles, so only a platform administrator could create those
-- accounts. Governance roles (school_owner, principal) still go through
-- Users & Roles (admin_create_user / can_assign_role), never through
-- employee onboarding, and platform, family and guest roles are never
-- provisionable here.
-- ---------------------------------------------------------------------------

create or replace function public.can_assign_employee_role(p_role public.user_role)
returns boolean
language sql
stable
set search_path = public
as $$
  select p_role in (
    'hr_manager', 'finance_manager', 'vice_principal',
    'teacher', 'class_teacher', 'subject_teacher', 'department_head',
    'receptionist', 'accountant', 'librarian', 'admissions_officer', 'medical_officer',
    'transport_coordinator', 'sports_coordinator', 'auditor',
    'asset_manager', 'boarding_manager', 'events_coordinator', 'governance_officer', 'procurement_officer'
  )
$$;

comment on function public.can_assign_employee_role(public.user_role) is
  'Staff roles an employee login may be provisioned with (provision_employee_login). Mirrors PROVISIONABLE_ROLES in src/features/employees/types/employee.types.ts. Excludes governance (school_owner, principal), platform, family and guest roles.';

-- ---------------------------------------------------------------------------
-- 2. Unguessable admission references.
--
-- References were APP-<year>-<5-digit counter>, so knowing one applicant's
-- email was enough to enumerate references. They keep the readable,
-- ordered prefix and gain a random 6-character suffix from an unambiguous
-- alphabet (no 0/O/1/I/L): 31^6 ≈ 887 million values per counter slot.
-- Existing references are unchanged. The public resume flow also requires
-- the learner's date of birth and is rate limited (admissions-public).
-- ---------------------------------------------------------------------------

create or replace function public.next_admission_reference(p_school_id uuid)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_next bigint;
  v_year text := to_char(now() at time zone 'Africa/Johannesburg', 'YYYY');
  v_alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  v_bytes bytea := gen_random_bytes(6);
  v_suffix text := '';
  i int;
begin
  insert into public.admission_counters (school_id, next_value) values (p_school_id, 1)
  on conflict (school_id) do nothing;
  update public.admission_counters set next_value = next_value + 1
    where school_id = p_school_id
    returning next_value - 1 into v_next;
  for i in 0..5 loop
    v_suffix := v_suffix || substr(v_alphabet, 1 + (get_byte(v_bytes, i) % length(v_alphabet)), 1);
  end loop;
  return 'APP-' || v_year || '-' || lpad(v_next::text, 5, '0') || '-' || v_suffix;
end;
$$;

revoke execute on function public.next_admission_reference(uuid) from public, anon, authenticated;
