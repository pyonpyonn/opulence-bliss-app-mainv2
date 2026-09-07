-- Live session timing starts when the cleaner checks in. The customer-selected
-- booking duration remains authoritative for the expected finish, countdown,
-- 30-minute warning and automatic checkout.

create or replace function public.schedule_session_notice()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_minutes integer;
  v_end timestamptz;
begin
  if new.arrived_at is not null then
    if tg_op = 'UPDATE' and old.arrived_at is not distinct from new.arrived_at then
      return new;
    end if;

    select coalesce(b.duration_minutes, p.duration_minutes, 120)
      into v_minutes
      from public.bookings b
      left join public.packages p on p.id = b.package_id
     where b.id = new.booking_id;

    v_end := new.arrived_at + make_interval(mins => v_minutes);

    update public.booking_notification_deliveries
       set status = 'cancelled', claim_token = null
     where booking_id = new.booking_id
       and kind = 'remaining_30m'
       and status in ('pending', 'processing');

    if v_end > now() then
      perform public.queue_booking_notice(
        new.booking_id,
        'remaining_30m',
        '30m-live-v2:' || new.arrived_at::text,
        greatest(now(), v_end - interval '30 minutes'),
        v_end
      );
    end if;
  end if;

  return new;
end
$fn$;

revoke all on function public.schedule_session_notice() from public, anon, authenticated, service_role;

-- Repair pending 30-minute notices for sessions that were already running when
-- this correction was deployed.
do $repair_active_session_notices$
declare
  v_booking record;
  v_end timestamptz;
begin
  for v_booking in
    select
      b.id,
      ci.arrived_at,
      coalesce(b.duration_minutes, p.duration_minutes, 120) as minutes
    from public.bookings b
    join public.check_ins ci
      on ci.booking_id = b.id
     and ci.arrived_at is not null
     and ci.left_at is null
    left join public.packages p on p.id = b.package_id
    where b.status::text = 'in_progress'
  loop
    v_end := v_booking.arrived_at + make_interval(mins => v_booking.minutes);

    update public.booking_notification_deliveries
       set status = 'cancelled', claim_token = null
     where booking_id = v_booking.id
       and kind = 'remaining_30m'
       and status in ('pending', 'processing');

    if v_end > now() then
      perform public.queue_booking_notice(
        v_booking.id,
        'remaining_30m',
        '30m-live-v2:' || v_booking.arrived_at::text,
        greatest(now(), v_end - interval '30 minutes'),
        v_end
      );
    end if;
  end loop;
end
$repair_active_session_notices$;
