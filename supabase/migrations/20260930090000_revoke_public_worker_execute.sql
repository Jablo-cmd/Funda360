-- Security fix (audit 2026-09-29, finding P1-1).
--
-- run_fee_overdue_reminders(uuid) and run_document_expiry_alerts(uuid) are
-- SECURITY DEFINER workers with NO authorization check of their own: they
-- are meant to be reachable only from pg_cron (as the owner) and from the
-- gated trigger_* wrappers (which run as the owner too, being SECURITY
-- DEFINER themselves). Their migrations assumed that
--   alter default privileges in schema public revoke execute on functions from public
-- stopped PUBLIC from inheriting EXECUTE. It does not: per-schema default
-- privileges can only ADD to the global defaults, never remove them, so both
-- functions kept PUBLIC EXECUTE and were callable by the anon role — i.e.
-- by anyone holding the public anon key, for ANY school id.
--
-- Revoking explicitly from PUBLIC, anon and authenticated closes that. The
-- pg_cron jobs and the trigger_* wrappers are unaffected (owner context).

revoke execute on function public.run_fee_overdue_reminders(uuid) from public, anon, authenticated;
revoke execute on function public.run_document_expiry_alerts(uuid) from public, anon, authenticated;
