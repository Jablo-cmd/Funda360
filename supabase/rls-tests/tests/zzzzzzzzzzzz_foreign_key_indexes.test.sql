-- Regression suite for 20261024102000_foreign_key_indexes.sql: every
-- single-column foreign key outside the audit columns is led by an index.
do $$
declare v_missing text;
begin
  select string_agg(c.conrelid::regclass::text || '.' || a.attname, ', ') into v_missing
  from pg_constraint c
  join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
  where c.contype = 'f'
    and c.connamespace = 'public'::regnamespace
    and array_length(c.conkey, 1) = 1
    and a.attname !~ '(_by|_by_id|by_profile_id)$'
    and not exists (select 1 from pg_index i where i.indrelid = c.conrelid and i.indkey[0] = c.conkey[1]);
  call test_util.record('indexes: every non-audit foreign key has a leading index', v_missing is null, coalesce(v_missing, 'none missing'));
end $$;
