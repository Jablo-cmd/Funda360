-- Platform Owner — ultimate Funda360 platform authority
-- Distinct from operational Super Administrator.
--
-- Platform Owner is the highest application-level role and is global
-- (tenant_id remains NULL). Super Administrator remains the senior
-- operational administrator below it.
--
-- This migration intentionally does not create a separate database owner:
-- Postgres/Supabase infrastructure ownership remains outside application RBAC.
-- It establishes the application's sovereign control-plane role.

alter type public.user_role add value if not exists 'platform_owner';

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') in (
    'platform_owner',
    'super_administrator',
    'platform_administrator'
  )
$$;

comment on function public.is_platform_admin() is
  'True for global platform roles: platform_owner, super_administrator, or platform_administrator.';

create or replace function public.can_manage_profiles(target_tenant_id uuid)
returns boolean
language sql
stable
as $$
  select
    (
      target_tenant_id = public.current_tenant_id()
      and coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') in ('school_owner', 'principal', 'hr_manager')
    )
    or public.is_platform_admin()
$$;

create or replace function public.can_assign_role(
  p_new_role public.user_role,
  p_target_current_role public.user_role
)
returns boolean
language sql
stable
as $$
  select case
    when public.is_platform_admin() then true
    when coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'school_owner' then
      p_new_role in ('school_owner', 'principal', 'teacher')
      and (p_target_current_role is null or p_target_current_role in ('school_owner', 'principal', 'teacher'))
    when coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'principal' then
      p_new_role = 'teacher'
      and (p_target_current_role is null or p_target_current_role = 'teacher')
    else false
  end
$$;

comment on function public.can_assign_role(public.user_role, public.user_role) is
  'Platform roles, including platform_owner, may assign any application role. School owner and principal follow the school-level assignment ladder.';
