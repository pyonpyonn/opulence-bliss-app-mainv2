-- Persist the simplified cleaning flow: address, session, frequency and 2-10 hours.

begin;

alter table public.bookings
  add column if not exists booking_frequency text not null default 'one_time';

alter table public.bookings
  drop constraint if exists bookings_booking_frequency_check;

alter table public.bookings
  add constraint bookings_booking_frequency_check
  check (booking_frequency in ('one_time', 'weekly', 'monthly'));

revoke update(booking_frequency)
  on public.bookings
  from public, anon, authenticated, service_role;

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
    or new.duration_minutes > 600
    or mod(new.duration_minutes, 30) <> 0
  ) then
    raise exception 'Cleaning sessions must be 2 to 10 hours in 30-minute steps.'
      using errcode = 'check_violation';
  end if;

  v_local_start := new.scheduled_at at time zone 'Europe/London';
  v_local_end := (
    new.scheduled_at + make_interval(mins => new.duration_minutes)
  ) at time zone 'Europe/London';

  if v_local_start is null
     or v_local_start::time < time '07:00'
     or v_local_end::date <> v_local_start::date
     or v_local_end::time > time '20:00'
     or mod(extract(minute from v_local_start)::integer, 30) <> 0
     or extract(second from v_local_start) <> 0 then
    raise exception 'Appointments must start at or after 7:00 AM and finish by 8:00 PM, with start times on the hour or half hour (London time).'
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

create or replace function public.finalize_customer_checkout(
  p_customer_id uuid,
  p_session_id text,
  p_payment_ref text,
  p_package_id uuid,
  p_postcode text,
  p_address text,
  p_request text,
  p_slot timestamptz,
  p_duration_minutes integer,
  p_property_size_sqm numeric,
  p_frequency text,
  p_preferred_provider_id uuid,
  p_amount numeric,
  p_platform numeric,
  p_email text,
  p_payment_status text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_id uuid;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service role required' using errcode = 'insufficient_privilege';
  end if;

  if coalesce(p_session_id, '') = ''
     or coalesce(p_payment_ref, '') = ''
     or char_length(btrim(coalesce(p_address, ''))) < 5
     or p_frequency not in ('one_time', 'weekly', 'monthly')
     or p_amount is null
     or p_amount <= 0
     or p_platform is null
     or p_platform < 0
     or p_platform >= p_amount
     or p_payment_status not in ('succeeded', 'authorised') then
    raise exception 'Invalid checkout.';
  end if;

  if not exists (
    select 1
      from public.packages
     where id = p_package_id
       and active = true
       and billing_type = 'per_visit'
       and lower(coalesce(service_type, '')) like '%clean%'
  ) then
    raise exception 'Cleaning session is not available.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_session_id, 0));

  select id into v_id
    from public.bookings
   where checkout_session_id = p_session_id
     and customer_id = p_customer_id;
  if found then
    return v_id;
  end if;

  if p_preferred_provider_id is not null and not exists (
    select 1
      from public.bookings b
      join public.packages pkg on pkg.id = b.package_id
     where b.customer_id = p_customer_id
       and b.provider_id = p_preferred_provider_id
       and b.status::text = 'completed'
       and lower(coalesce(pkg.service_type, '')) like '%clean%'
  ) then
    raise exception 'Requested cleaner must come from a completed cleaning visit.';
  end if;

  insert into public.bookings(
    customer_id,
    provider_id,
    package_id,
    scheduled_at,
    status,
    address,
    customer_email,
    household_notes,
    offer_expires_at,
    duration_minutes,
    property_size_sqm,
    booking_frequency,
    preferred_provider_id,
    checkout_session_id
  )
  values(
    p_customer_id,
    null,
    p_package_id,
    p_slot,
    'offered',
    btrim(p_address),
    p_email,
    p_request,
    p_slot - interval '2 hours',
    p_duration_minutes,
    p_property_size_sqm,
    p_frequency,
    p_preferred_provider_id,
    p_session_id
  )
  returning id into v_id;

  insert into public.payments(
    booking_id,
    gross_amount,
    split_breakdown,
    stripe_payment_ref,
    status
  )
  values(
    v_id,
    p_amount,
    jsonb_build_object(
      'provider', p_amount - p_platform,
      'platform_margin', p_platform
    ),
    p_payment_ref,
    p_payment_status
  );

  return v_id;
end
$function$;

revoke all on function public.finalize_customer_checkout(
  uuid,text,text,uuid,text,text,text,timestamptz,integer,numeric,text,uuid,numeric,numeric,text,text
)
from public, anon, authenticated;

grant execute on function public.finalize_customer_checkout(
  uuid,text,text,uuid,text,text,text,timestamptz,integer,numeric,text,uuid,numeric,numeric,text,text
)
to service_role;

create or replace function public.booking_checkout_ready()
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select
    (
      select count(*) = 5
        from information_schema.columns
       where table_schema = 'public'
         and table_name = 'bookings'
         and column_name = any(array[
           'duration_minutes',
           'property_size_sqm',
           'preferred_provider_id',
           'checkout_session_id',
           'booking_frequency'
         ])
    )
    and to_regprocedure(
      'public.finalize_customer_checkout(uuid,text,text,uuid,text,text,text,timestamptz,integer,numeric,text,uuid,numeric,numeric,text,text)'
    ) is not null
    and to_regprocedure(
      'public.system_initialize_booking_offer_queue(uuid,uuid[])'
    ) is not null;
$function$;

revoke all on function public.booking_checkout_ready()
  from public, anon, authenticated;
grant execute on function public.booking_checkout_ready()
  to service_role;

commit;
