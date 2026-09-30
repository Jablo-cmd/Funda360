-- Operations-module staff roles (audit P2).
--
-- The operations RPCs (20260929120000_platform_completion_wave.sql,
-- 20260929170000_remaining_modules_hardening.sql) authorize these roles via
-- operations_role_allowed(), but they never existed in user_role, so the
-- authorization paths were unreachable and nobody could run boarding,
-- assets, procurement, governance or events without being a principal.
--
-- Kept in its own migration: a new enum value cannot be used in the same
-- transaction that adds it. 20260930121000 is the first to use them.

alter type public.user_role add value if not exists 'asset_manager';
alter type public.user_role add value if not exists 'boarding_manager';
alter type public.user_role add value if not exists 'events_coordinator';
alter type public.user_role add value if not exists 'governance_officer';
alter type public.user_role add value if not exists 'procurement_officer';
