-- Index foreign keys (audit 2026-10-23, finding Q-1). The Supabase advisor
-- listed 228 foreign keys without a covering index. Those used by RLS
-- filters (school_id), joins (learner_id, assignment_id, ...) and cascading
-- deletes get an index here. Audit columns (created_by, updated_by,
-- decided_by, ...) are left alone: they are written, rarely filtered.
-- Single-column keys only; any key already led by an index is skipped.

do $$
declare
  r record;
  v_name text;
begin
  for r in
    select c.conrelid::regclass::text as tbl, a.attname as col
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f'
      and c.connamespace = 'public'::regnamespace
      and array_length(c.conkey, 1) = 1
      and a.attname !~ '(_by|_by_id|by_profile_id)$'
      and not exists (
        select 1 from pg_index i where i.indrelid = c.conrelid and i.indkey[0] = c.conkey[1]
      )
  loop
    v_name := left(replace(r.tbl, 'public.', '') || '_' || r.col || '_fk_idx', 63);
    execute format('create index if not exists %I on %s (%I)', v_name, r.tbl, r.col);
  end loop;
end $$;
