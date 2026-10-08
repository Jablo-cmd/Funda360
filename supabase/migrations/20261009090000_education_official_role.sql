-- Government readiness: a role for education department officials
-- (province / district / circuit level) who read aggregated reports across
-- the schools in their area. They have no school tenant.
--
-- Kept in its own migration: a new enum value cannot be used in the same
-- transaction that adds it. 20261009091000 is the first to use it.

alter type public.user_role add value if not exists 'education_official';
