-- Customers may place a booking at any time, but the complete appointment must
-- fit inside the 07:00-19:00 Europe/London service window.

update public.booking_rules
   set appointment_start_hour = 7,
       appointment_end_hour = 19,
       updated_at = now()
 where id = 1;

alter table public.booking_rules
  alter column appointment_start_hour set default 7,
  alter column appointment_end_hour set default 19;

create or replace function public.enforce_booking_appointment_window()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_package public.packages;
  v_local_start timestamp;
  v_local_end timestamp;
  v_clean boolean;
begin
  select * into v_package
    from public.packages
   where id = new.package_id;

  v_clean := lower(coalesce(v_package.service_type, '')) like '%clean%';

  if tg_op = 'UPDATE' and new.package_id is distinct from old.package_id then
    if old.checkout_session_id is not null then
      raise exception 'To change a paid package, cancel and rebook so the new price can be authorised.';
    end if;
    new.duration_minutes := coalesce(v_package.duration_minutes, 120);
  else
    new.duration_minutes := coalesce(
      new.duration_minutes,
      v_package.duration_minutes,
      120
    );
  end if;

  if v_clean and (
    new.duration_minutes < 120
    or new.duration_minutes > 480
    or mod(new.duration_minutes, 30) <> 0
  ) then
    raise exception 'Cleaning sessions must be 2 to 8 hours in 30-minute steps.'
      using errcode = 'check_violation';
  end if;

  if v_clean
     and new.checkout_session_id is not null
     and (
       new.property_size_sqm is null
       or new.property_size_sqm <= 0
       or new.property_size_sqm > 100000
     ) then
    raise exception 'Enter a valid property size.'
      using errcode = 'check_violation';
  end if;

  v_local_start := new.scheduled_at at time zone 'Europe/London';
  v_local_end := (
    new.scheduled_at + make_interval(mins => new.duration_minutes)
  ) at time zone 'Europe/London';

  if v_local_start is null
     or v_local_start::time < time '07:00'
     or v_local_end::date <> v_local_start::date
     or v_local_end::time > time '19:00'
     or mod(extract(minute from v_local_start)::integer, 30) <> 0
     or extract(second from v_local_start) <> 0 then
    raise exception 'Appointments must start at or after 7:00 AM and finish by 7:00 PM, with start times on the hour or half hour (London time).'
      using errcode = 'check_violation';
  end if;

  return new;
end
$function$;

drop trigger if exists bookings_enforce_appointment_window
  on public.bookings;
create trigger bookings_enforce_appointment_window
before insert or update of
  scheduled_at,
  package_id,
  duration_minutes,
  property_size_sqm
on public.bookings
for each row
execute function public.enforce_booking_appointment_window();

revoke all on function public.enforce_booking_appointment_window()
  from public, anon, authenticated, service_role;

do $verify$
declare
  v_rules public.booking_rules;
begin
  select * into v_rules
    from public.booking_rules
   where id = 1;

  if v_rules.appointment_start_hour <> 7
     or v_rules.appointment_end_hour <> 19 then
    raise exception 'appointment window must be 07:00-19:00';
  end if;
end
$verify$;
