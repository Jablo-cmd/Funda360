-- Platform overview for the platform-owner dashboard (platform-owner review
-- 2026-10-24, item C). The old dashboard showed words ("Manage", "Open",
-- "Admin") instead of figures. get_platform_overview() returns counts only:
-- no learner, guardian or message content, and no names except those of
-- schools and of the staff behind recent administrative actions.
--
-- Callers: platform roles only (is_platform_admin(), which already demands
-- an aal2 session once the caller has enrolled a factor).

create or replace function public.get_platform_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_platform_roles constant text[] := array['platform_owner', 'super_administrator', 'platform_administrator'];
  v_privileged_roles constant text[] := array[
    'platform_owner', 'super_administrator', 'platform_administrator', 'education_official',
    'school_owner', 'principal', 'finance_manager', 'accountant'
  ];
  v_users jsonb;
  v_security jsonb;
  v_health jsonb;
  v_latest_migration text;
  v_cron_failures integer;
begin
  if not public.is_platform_admin() then
    raise exception 'insufficient_privilege: the platform overview is for platform administrators';
  end if;

  -- auth.users differs between hosted Supabase and the test harness, so the
  -- sign-in timestamp is read through to_jsonb().
  with u as (
    select
      u.id,
      lower(coalesce(u.email, '')) as email,
      coalesce(u.raw_app_meta_data ->> 'role', '') as role,
      nullif(to_jsonb(u) ->> 'last_sign_in_at', '')::timestamptz as last_sign_in_at,
      exists (select 1 from auth.mfa_factors f where f.user_id = u.id and f.status::text = 'verified') as has_mfa
    from auth.users u
  )
  select
    jsonb_build_object(
      'total', count(*),
      'staff', count(*) filter (where role not in ('guardian', 'parent', 'learner', '') and not role = any (v_platform_roles)),
      'guardians', count(*) filter (where role in ('guardian', 'parent')),
      'learners', count(*) filter (where role = 'learner'),
      'platform', count(*) filter (where role = any (v_platform_roles)),
      'signed_in_7d', count(*) filter (where last_sign_in_at > now() - interval '7 days'),
      'signed_in_30d', count(*) filter (where last_sign_in_at > now() - interval '30 days'),
      'demo_accounts', count(*) filter (where email like '%.funda360.dev' or email like '%.test')
    ),
    jsonb_build_object(
      'privileged_accounts', count(*) filter (where role = any (v_privileged_roles)),
      'privileged_with_mfa', count(*) filter (where role = any (v_privileged_roles) and has_mfa),
      'platform_accounts', count(*) filter (where role = any (v_platform_roles)),
      'platform_with_mfa', count(*) filter (where role = any (v_platform_roles) and has_mfa),
      'platform_demo_accounts', count(*) filter (
        where role = any (v_platform_roles) and (email like '%.funda360.dev' or email like '%.test')
      )
    )
  into v_users, v_security
  from u;

  v_security := v_security || jsonb_build_object(
    'support_pending', (select count(*) from public.platform_support_grants where status = 'pending'),
    'support_active', (
      select count(*) from public.platform_support_grants
      where status = 'approved' and revoked_at is null and now() < expires_at
    )
  );

  if to_regclass('supabase_migrations.schema_migrations') is not null then
    execute 'select max(version)::text from supabase_migrations.schema_migrations' into v_latest_migration;
  end if;
  if to_regclass('cron.job_run_details') is not null then
    execute $q$select count(*)::int from cron.job_run_details
      where status = 'failed' and start_time > now() - interval '24 hours'$q$ into v_cron_failures;
  end if;

  v_health := jsonb_build_object(
    'latest_migration', v_latest_migration,
    'scheduled_job_failures_24h', v_cron_failures,
    'notifications_pending', (select count(*) from public.notification_deliveries where status = 'pending'),
    'notifications_failed_7d', (
      select count(*) from public.notification_deliveries where status = 'failed' and created_at > now() - interval '7 days'
    ),
    'unverified_payment_callbacks_7d', (
      select count(*) from public.payment_webhook_events where not signature_valid and received_at > now() - interval '7 days'
    ),
    'ai_requests_7d', (select count(*) from public.ai_requests where created_at > now() - interval '7 days')
  );

  return jsonb_build_object(
    'generated_at', now(),
    'schools', jsonb_build_object(
      'total', (select count(*) from public.schools),
      'active', (select count(*) from public.schools where status = 'active'),
      'pending', (select count(*) from public.schools where status = 'pending'),
      'suspended', (select count(*) from public.schools where status in ('suspended', 'inactive')),
      'created_30d', (select count(*) from public.schools where created_at > now() - interval '30 days'),
      'without_education_area', (select count(*) from public.schools where education_area_id is null),
      'list', coalesce((
        select jsonb_agg(row_data order by row_data ->> 'name')
        from (
          select jsonb_build_object(
            'id', s.id,
            'name', s.name,
            'status', s.status,
            'created_at', s.created_at,
            'learners', (select count(*) from public.learners l where l.school_id = s.id and l.status = 'active'),
            'staff', (
              select count(*) from public.profiles p
              where p.tenant_id = s.id and p.status = 'active' and p.role::text not in ('guardian', 'parent', 'learner')
            ),
            'guardians', (
              select count(*) from public.profiles p
              where p.tenant_id = s.id and p.status = 'active' and p.role::text in ('guardian', 'parent')
            )
          ) as row_data
          from public.schools s
          order by s.name
          limit 200
        ) per_school
      ), '[]'::jsonb)
    ),
    'learners', jsonb_build_object(
      'active', (select count(*) from public.learners where status = 'active')
    ),
    'users', v_users,
    'security', v_security,
    'health', v_health,
    'compliance', jsonb_build_object(
      'open_data_requests', (
        select count(*) from public.data_subject_requests where status not in ('completed', 'rejected')
      ),
      'overdue_data_requests', (
        select count(*) from public.data_subject_requests
        where status not in ('completed', 'rejected') and due_at < now()
      ),
      'open_amendment_requests', (
        select count(*) from public.record_amendment_requests where status in ('submitted', 'under_review', 'hearing_requested')
      ),
      'open_content_safety_events', (select count(*) from public.content_safety_events where status = 'open')
    ),
    'government', jsonb_build_object(
      'education_areas', (select count(*) from public.education_areas),
      'active_official_assignments', (
        select count(*) from public.education_official_assignments where active and revoked_at is null
      ),
      'active_api_clients', (
        select count(*) from public.government_api_clients
        where revoked_at is null and (expires_at is null or expires_at > now())
      )
    ),
    'recent_admin_actions', coalesce((
      select jsonb_agg(jsonb_build_object(
          'at', a.created_at,
          'action', a.action,
          'school', s.name,
          'by', coalesce(nullif(btrim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), ''), 'System')
        ) order by a.created_at desc)
      from (
        select * from public.audit_log
        where action like any (array[
          'platform_support_%', 'school_education_area_changed', 'school_emis_number_changed', 'education_%',
          'government_api_client_%', 'government_import_%', 'ai_feature_updated', 'ai_school_settings_updated',
          'learner_erased', 'compliance_settings_updated'
        ])
        order by created_at desc
        limit 10
      ) a
      left join public.schools s on s.id = a.school_id
      left join public.profiles p on p.id = a.actor_profile_id
    ), '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.get_platform_overview() from public, anon;
grant execute on function public.get_platform_overview() to authenticated;

comment on function public.get_platform_overview() is
  'Counts for the platform-owner dashboard: schools, users, security (MFA coverage, support access), health, compliance, government and recent administrative actions. Platform administrators only; returns no learner, guardian or message content.';
