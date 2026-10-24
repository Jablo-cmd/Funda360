-- Regression suite for 20261024101000_privilege_hardening.sql.

do $$
declare
  v_anon int;
  v_auth_dangerous int;
  v_auth_select int;
  v_mutable int;
  v_tables int;
begin
  select count(*) into v_tables from pg_tables where schemaname = 'public';
  select count(*) into v_anon from information_schema.role_table_grants
    where grantee = 'anon' and table_schema = 'public';
  select count(*) into v_auth_dangerous from information_schema.role_table_grants
    where grantee = 'authenticated' and table_schema = 'public' and privilege_type in ('TRUNCATE', 'TRIGGER', 'REFERENCES');
  select count(*) into v_auth_select from information_schema.role_table_grants
    where grantee = 'authenticated' and table_schema = 'public' and privilege_type = 'SELECT';
  select count(*) into v_mutable from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f' and p.proconfig is null
      and p.prolang in (select oid from pg_language where lanname in ('sql', 'plpgsql'));

  call test_util.record('privileges: anon holds no privilege on any public table', v_anon = 0, 'grants: ' || v_anon);
  call test_util.record('privileges: authenticated holds no TRUNCATE, TRIGGER or REFERENCES', v_auth_dangerous = 0, 'grants: ' || v_auth_dangerous);
  call test_util.record('privileges: authenticated still reads through RLS', v_auth_select > 0, format('SELECT on %s of %s tables', v_auth_select, v_tables));
  call test_util.record('privileges: every public SQL/plpgsql function has a fixed search_path', v_mutable = 0, 'without: ' || v_mutable);
end $$;

-- A table created after the migration inherits the tightened defaults.
do $$
declare v_anon int; v_trunc int;
begin
  create table public.zz_privilege_probe (id int primary key);
  select count(*) into v_anon from information_schema.role_table_grants where grantee = 'anon' and table_name = 'zz_privilege_probe';
  select count(*) into v_trunc from information_schema.role_table_grants
    where grantee = 'authenticated' and table_name = 'zz_privilege_probe' and privilege_type = 'TRUNCATE';
  drop table public.zz_privilege_probe;
  call test_util.record('privileges: new tables get no anon or TRUNCATE grants', v_anon = 0 and v_trunc = 0,
    format('anon %s truncate %s', v_anon, v_trunc));
end $$;
