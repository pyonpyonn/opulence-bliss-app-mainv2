begin;

-- The two-hour catalogue base price is the amount checkout scales by duration.
update public.packages
set price = 45.98,
    good_to_know = array_replace(
      coalesce(good_to_know, '{}'::text[]),
      '£22.90 per cleaner-hour',
      '£22.99 per cleaner-hour'
    )
where name = 'One-Time Essential Clean'
  and billing_type = 'per_visit'
  and lower(coalesce(service_type, '')) like '%clean%';

-- Enforce the new cap for both one-off and six-visit bookings, including
-- reschedules and direct database writes. This runs after the existing
-- appointment trigger, which may set the duration from a changed package.
create or replace function public.enforce_cleaning_eight_hour_cap()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_service_type text;
begin
  select service_type into v_service_type
  from public.packages where id = new.package_id;

  if lower(coalesce(v_service_type, '')) like '%clean%'
     and (new.duration_minutes < 120
          or new.duration_minutes > 480
          or mod(new.duration_minutes, 30) <> 0) then
    raise exception 'Cleaning sessions must be 2 to 8 hours in 30-minute steps.'
      using errcode = 'check_violation';
  end if;
  return new;
end
$function$;

drop trigger if exists bookings_z_enforce_cleaning_eight_hour_cap on public.bookings;
create trigger bookings_z_enforce_cleaning_eight_hour_cap
before insert or update of package_id, duration_minutes
on public.bookings
for each row execute function public.enforce_cleaning_eight_hour_cap();

revoke all on function public.enforce_cleaning_eight_hour_cap()
from public, anon, authenticated, service_role;

commit;
