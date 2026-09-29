-- Funda360 in-app attendance notifications.
--
-- Teacher/principal attendance changes create an in-app notification for every
-- active guardian linked to that learner.
--
-- INSERT: notify for Present, Absent or Late.
-- UPDATE: notify only when status actually changes, preventing duplicates when
-- a register is merely re-saved.
--
-- The existing 3-consecutive-absence attendance_alert producer remains in
-- place. This is a separate per-attendance-status event for the immediate
-- workflow:
--   Teacher marks Present/Absent/Late -> Guardian sees an in-app notification.

create or replace function public.attendance_record_notify_guardians()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_learner record;
  v_guardian record;
  v_status_label text;
begin
  if tg_op = 'UPDATE' and old.status is not distinct from new.status then
    return new;
  end if;

  select first_name, last_name
    into v_learner
    from public.learners
   where id = new.learner_id;

  v_status_label := initcap(new.status::text);

  for v_guardian in
    select lg.guardian_profile_id
      from public.learner_guardians lg
      join public.profiles p on p.id = lg.guardian_profile_id
     where lg.learner_id = new.learner_id
       and lg.school_id = new.school_id
       and p.tenant_id = new.school_id
       and p.status = 'active'
       and p.role in ('parent', 'guardian')
  loop
    perform public.create_notification(
      v_guardian.guardian_profile_id,
      'attendance_status',
      'Attendance updated',
      format('%s %s was marked %s for %s.',
        coalesce(v_learner.first_name, 'Learner'),
        coalesce(v_learner.last_name, ''),
        v_status_label,
        new.attendance_date::text
      ),
      new.school_id,
      'attendance_records',
      new.id,
      '/parent/children/' || new.learner_id::text
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists attendance_record_notify_guardians_trigger
  on public.attendance_records;

create trigger attendance_record_notify_guardians_trigger
  after insert or update of status on public.attendance_records
  for each row
  execute function public.attendance_record_notify_guardians();

comment on function public.attendance_record_notify_guardians() is
  'Creates an in-app attendance_status notification for each active guardian of the learner when daily attendance is inserted or its status changes. Re-saving the same status does not duplicate the notification.';

-- Ensure notifications is part of Supabase Realtime so the notification
-- bell/inbox can receive new rows immediately.
do $$
begin
  if not exists (
    select 1
      from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;
