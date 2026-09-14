-- Remove the optional-time cap and stage large time-choice lists outside Stripe metadata.

begin;

alter table public.bookings
  drop constraint if exists bookings_optional_scheduled_at_limit;

create table if not exists public.booking_checkout_time_choices (
  checkout_session_id text primary key,
  customer_id uuid not null references auth.users(id) on delete cascade,
  preferred_scheduled_at timestamptz not null,
  optional_scheduled_at timestamptz[] not null default '{}'::timestamptz[],
  created_at timestamptz not null default now()
);

alter table public.booking_checkout_time_choices enable row level security;
revoke all on public.booking_checkout_time_choices from public, anon, authenticated;
grant select, insert, update, delete on public.booking_checkout_time_choices to service_role;

create or replace function public.finalize_customer_checkout(
  p_customer_id uuid,
  p_session_id text,
  p_payment_ref text,
  p_package_id uuid,
  p_postcode text,
  p_address text,
  p_request text,
  p_slot timestamptz,
  p_optional_slots timestamptz[],
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
  v_optional timestamptz[] := coalesce(p_optional_slots, '{}'::timestamptz[]);
  v_earliest timestamptz;
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

  if exists (select 1 from unnest(v_optional) as choice(slot) where slot is null)
     or p_slot = any(v_optional)
     or (select count(*) from unnest(v_optional)) <>
        (select count(distinct slot) from unnest(v_optional) as choice(slot)) then
    raise exception 'Optional booking times must be distinct and cannot include the preferred time.'
      using errcode = 'check_violation';
  end if;

  if exists (
    select 1
      from unnest(v_optional) as choice(slot)
     where (slot at time zone 'Europe/London')::time < time '07:00'
        or ((slot + make_interval(mins => p_duration_minutes)) at time zone 'Europe/London')::date <>
           (slot at time zone 'Europe/London')::date
        or ((slot + make_interval(mins => p_duration_minutes)) at time zone 'Europe/London')::time > time '20:00'
        or mod(extract(minute from (slot at time zone 'Europe/London'))::integer, 30) <> 0
        or extract(second from slot) <> 0
  ) then
    raise exception 'Optional booking times must use the available appointment window.'
      using errcode = 'check_violation';
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

  select min(choice.slot)
    into v_earliest
    from (
      select p_slot as slot
      union all
      select slot from unnest(v_optional) as alternatives(slot)
    ) as choice;

  insert into public.bookings(
    customer_id,
    provider_id,
    package_id,
    scheduled_at,
    preferred_scheduled_at,
    optional_scheduled_at,
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
    p_slot,
    v_optional,
    'offered',
    btrim(p_address),
    p_email,
    p_request,
    v_earliest - interval '2 hours',
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
  uuid,text,text,uuid,text,text,text,timestamptz,timestamptz[],integer,numeric,text,uuid,numeric,numeric,text,text
)
from public, anon, authenticated;
grant execute on function public.finalize_customer_checkout(
  uuid,text,text,uuid,text,text,text,timestamptz,timestamptz[],integer,numeric,text,uuid,numeric,numeric,text,text
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
      select count(*) = 7
        from information_schema.columns
       where table_schema = 'public'
         and table_name = 'bookings'
         and column_name = any(array[
           'duration_minutes',
           'property_size_sqm',
           'preferred_provider_id',
           'checkout_session_id',
           'booking_frequency',
           'preferred_scheduled_at',
           'optional_scheduled_at'
         ])
    )
    and to_regclass('public.booking_checkout_time_choices') is not null
    and to_regprocedure(
      'public.finalize_customer_checkout(uuid,text,text,uuid,text,text,text,timestamptz,timestamptz[],integer,numeric,text,uuid,numeric,numeric,text,text)'
    ) is not null
    and to_regprocedure('public.provider_accept_booking_time(uuid,timestamptz)') is not null
    and to_regprocedure('public.system_initialize_booking_offer_queue(uuid,uuid[])') is not null;
$function$;

revoke all on function public.booking_checkout_ready()
  from public, anon, authenticated;
grant execute on function public.booking_checkout_ready()
  to service_role;

notify pgrst, 'reload schema';

commit;
