-- ============================================================================
--  LOCAL DEVELOPMENT SEED DATA ONLY — NEVER RUN AGAINST A HOSTED PROJECT
-- ============================================================================
--
-- Run automatically by `supabase db reset` against your local Docker
-- Postgres (started with `supabase start`). This file creates real
-- auth.users rows protected only by a shared, publicly-documented password
-- printed right here in this repository — that is fine for a throwaway
-- local container and NOT fine for anything reachable outside your machine.
--
-- The password below is deliberately spelled out with a "LOCALDEV" marker
-- (not a normal-looking password) specifically so it is unmistakable as a
-- placeholder if it is ever pasted somewhere else, and so a secret scanner
-- or reviewer immediately recognises it as intentional seed data, not a
-- leaked real credential.
--
-- Login credentials (all three accounts share this password):
--   Password: Funda360!LOCALDEV-ONLY-2026
--
--   Role              Email                              School
--   ----------------  ---------------------------------  -----------------------
--   Super Admin       super.admin@funda360.dev            (none — platform-level)
--   Principal         principal@riverside.funda360.dev     Riverside Secondary School
--   Teacher           teacher@riverside.funda360.dev       Riverside Secondary School

do $$
begin
  raise notice '============================================================';
  raise notice ' FUNDA360 LOCAL DEV SEED — DO NOT USE AGAINST A REAL PROJECT';
  raise notice ' Seeded accounts share the password: Funda360!LOCALDEV-ONLY-2026';
  raise notice ' If you are seeing this against a hosted Supabase project,';
  raise notice ' stop now and investigate — this file must never run there.';
  raise notice '============================================================';
end;
$$;

create extension if not exists pgcrypto;

-- Fixed, readable UUIDs so this file is idempotent and easy to reference
-- from ad-hoc queries while testing locally.
-- School:        10000000-0000-0000-0000-000000000001
-- Super Admin:   20000000-0000-0000-0000-000000000001
-- Principal:     20000000-0000-0000-0000-000000000002
-- Teacher:       20000000-0000-0000-0000-000000000003

insert into public.schools (
  id, name, registration_number, education_department, school_type,
  province, district, emis_number, email, phone, website,
  physical_address, postal_address, principal_name, status
) values (
  '10000000-0000-0000-0000-000000000001',
  'Riverside Secondary School',
  'GDE-2024-00123',
  'Gauteng Department of Education',
  'public',
  'Gauteng',
  'Johannesburg Central',
  '700101234',
  'info@riverside.funda360.dev',
  '+27 11 555 0100',
  'https://riverside.funda360.dev',
  '12 River Road, Johannesburg, 2001',
  'PO Box 456, Johannesburg, 2000',
  'Thabo Nkosi',
  'active'
)
on conflict (id) do nothing;

-- auth.users + auth.identities: the minimal rows GoTrue needs for
-- email/password sign-in to work against these seeded accounts.
with seed_users (id, email, first_name, last_name, app_metadata) as (
  values
    (
      '20000000-0000-0000-0000-000000000001'::uuid,
      'super.admin@funda360.dev',
      'Lerato',
      'Molefe',
      '{"provider":"email","providers":["email"],"role":"super_administrator"}'::jsonb
    ),
    (
      '20000000-0000-0000-0000-000000000002'::uuid,
      'principal@riverside.funda360.dev',
      'Thabo',
      'Nkosi',
      '{"provider":"email","providers":["email"],"role":"principal","tenant_id":"10000000-0000-0000-0000-000000000001"}'::jsonb
    ),
    (
      '20000000-0000-0000-0000-000000000003'::uuid,
      'teacher@riverside.funda360.dev',
      'Naledi',
      'Dlamini',
      '{"provider":"email","providers":["email"],"role":"teacher","tenant_id":"10000000-0000-0000-0000-000000000001"}'::jsonb
    )
)
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select
  '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated', email,
  crypt('Funda360!LOCALDEV-ONLY-2026', gen_salt('bf')), now(),
  app_metadata, jsonb_build_object('first_name', first_name, 'last_name', last_name),
  now(), now(), '', '', '', ''
from seed_users
on conflict (id) do nothing;

insert into auth.identities (
  id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
)
select
  gen_random_uuid(), id,
  jsonb_build_object('sub', id::text, 'email', email),
  'email', id::text, now(), now(), now()
from (
  values
    ('20000000-0000-0000-0000-000000000001'::uuid, 'super.admin@funda360.dev'),
    ('20000000-0000-0000-0000-000000000002'::uuid, 'principal@riverside.funda360.dev'),
    ('20000000-0000-0000-0000-000000000003'::uuid, 'teacher@riverside.funda360.dev')
) as seed_identities (id, email)
on conflict do nothing;

insert into public.profiles (id, tenant_id, first_name, last_name, email, status)
values
  ('20000000-0000-0000-0000-000000000001', null, 'Lerato', 'Molefe', 'super.admin@funda360.dev', 'active'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Thabo', 'Nkosi', 'principal@riverside.funda360.dev', 'active'),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'Naledi', 'Dlamini', 'teacher@riverside.funda360.dev', 'active')
on conflict (id) do nothing;
