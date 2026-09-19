-- Production hardening: deactivated platform users must lose global RLS bypass.
--
-- The application role remains in auth.jwt() until the session/token is
-- refreshed, so role-only authorization cannot revoke access immediately.
-- Resolve platform authority against the authoritative profiles.status row
-- as well, using SECURITY DEFINER to avoid profiles-RLS recursion.

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') in (
      'platform_owner',
      'super_administrator',
      'platform_administrator'
    )
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.status = 'active'
    )
$$;

comment on function public.is_platform_admin() is
  'True for active global platform roles only. A deactivated or suspended profile loses the global RLS bypass immediately, even if the current JWT still contains the platform role.';

revoke execute on function public.is_platform_admin() from public;
grant execute on function public.is_platform_admin() to authenticated;
