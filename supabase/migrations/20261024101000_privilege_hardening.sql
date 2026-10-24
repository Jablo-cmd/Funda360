-- Privilege hardening (audit 2026-10-23, findings S-9 and S-10).
--
-- S-9  Supabase's default privileges give anon and authenticated every table
--      privilege on every public table: SELECT/INSERT/UPDATE/DELETE plus
--      TRUNCATE, TRIGGER and REFERENCES. Forced RLS stops the four row
--      operations, but TRUNCATE is not subject to RLS. PostgREST cannot issue
--      TRUNCATE today, so this is defence in depth:
--        * anon has no RLS policy on any public table (public pages go
--          through Edge Functions), so anon loses every table privilege;
--        * authenticated loses TRUNCATE, TRIGGER and REFERENCES;
--        * the same applies to tables created later by postgres.
-- S-10 32 SECURITY INVOKER functions had no fixed search_path (Supabase
--      advisor function_search_path_mutable). They get search_path = public.

do $$
declare
  r record;
begin
  for r in select tablename from pg_tables where schemaname = 'public' loop
    execute format('revoke all on table public.%I from anon', r.tablename);
    execute format('revoke truncate, trigger, references on table public.%I from authenticated', r.tablename);
  end loop;
end $$;

alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke truncate, trigger, references on tables from authenticated;

do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as fn
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and not p.prosecdef
      and p.proconfig is null
      and p.prolang in (select oid from pg_language where lanname in ('sql', 'plpgsql'))
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  loop
    execute format('alter function %s set search_path = public', r.fn);
  end loop;
end $$;
