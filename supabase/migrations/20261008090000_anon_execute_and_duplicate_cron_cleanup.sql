-- Audit 2026-10-08 clean-up. No data changes.
--
-- 1. SECURITY DEFINER trigger functions were executable by anon and
--    authenticated (Supabase advisor: 40 anon / 198 authenticated warnings).
--    Postgres checks EXECUTE on a trigger function only when the trigger is
--    created, never when it fires, so these grants were never needed (same
--    reasoning as 20260822020000). Revoke them from every caller role.
--
-- 2. trigger_fee_overdue_reminders(uuid) and trigger_document_expiry_alerts(uuid)
--    are authenticated entry points that check permissions inside, but anon
--    still held EXECUTE through PUBLIC. Logged-in callers keep it.
--
-- 3. 20260929120000 scheduled 'funda360-fee-overdue' and
--    'funda360-document-expiry', duplicating 'fee-overdue-reminders-daily'
--    and 'document-expiry-alerts-daily' (20260829150000, 20260829160000).
--    The duplicates call the trigger_* wrappers, which require a signed-in
--    finance or learner manager, so under pg_cron (no JWT) they would raise
--    insufficient_privilege every day. The original jobs keep doing the work.

do $$
declare
  f regprocedure;
begin
  for f in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and p.prorettype = 'trigger'::regtype
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop;
end;
$$;

revoke execute on function public.trigger_fee_overdue_reminders(uuid) from public, anon;
revoke execute on function public.trigger_document_expiry_alerts(uuid) from public, anon;
grant execute on function public.trigger_fee_overdue_reminders(uuid) to authenticated;
grant execute on function public.trigger_document_expiry_alerts(uuid) to authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobname)
    from cron.job
    where jobname in ('funda360-fee-overdue', 'funda360-document-expiry');
  end if;
end;
$$;
