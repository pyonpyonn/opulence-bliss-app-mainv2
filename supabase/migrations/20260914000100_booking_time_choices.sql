-- Let customers provide one preferred time and up to five optional alternatives.
-- A provider selects the final scheduled time atomically when accepting the offer.

begin;

alter table public.bookings
  add column if not exists preferred_scheduled_at timestamptz,
  add column if not exists optional_scheduled_at timestamptz[] not null default '{}'::timestamptz[];

update public.bookings
   set preferred_scheduled_at = scheduled_at
 where preferred_scheduled_at is null;

create or replace function public.sync_booking_time_choices()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if tg_op = 'INSERT' then
    new.preferred_scheduled_at := coalesce(new.preferred_scheduled_at, new.scheduled_at);
    new.optional_scheduled_at := coalesce(new.optional_scheduled_at, '{}'::timestamptz[]);
  elsif new.scheduled_at is distinct from old.scheduled_at
        and new.status::text = 'offered'
        and old.status::text <> 'offered' then
    -- A customer reschedule establishes a new first choice.
    new.preferred_scheduled_at := new.scheduled_at;
    new.optional_scheduled_at := '{}'::timestamptz[];
  end if;
  return new;
end
$function$;

drop trigger if exists bookings_sync_time_choices on public.bookings;
create trigger bookings_sync_time_choices
before insert or update of scheduled_at, status on public.bookings
for each row execute function public.sync_booking_time_choices();

revoke all on function public.sync_booking_time_choices()
  from public, anon, authenticated, service_role;

alter table public.bookings
  alter column preferred_scheduled_at set not null;

alter table public.bookings
  drop constraint if exists bookings_optional_scheduled_at_limit;
alter table public.bookings
  add constraint bookings_optional_scheduled_at_limit
  check (cardinality(optional_scheduled_at) <= 5);

revoke update(preferred_scheduled_at, optional_scheduled_at)
  on public.bookings
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

  if cardinality(v_optional) > 5
     or exists (select 1 from unnest(v_optional) as choice(slot) where slot is null)
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

create or replace function public.provider_offer_details(p_booking_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_provider uuid := public.current_provider_id();
  v_booking public.bookings;
  v_customer_name text;
  v_service text;
  v_payout numeric(12,2);
begin
  if v_provider is null or not exists (
    select 1 from public.booking_offers offer
     where offer.booking_id = p_booking_id
       and offer.provider_id = v_provider
       and offer.status = 'open'
  ) then
    raise exception 'this offer is not available to this provider'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id;
  select coalesce(full_name, email, 'Customer') into v_customer_name
    from public.profiles where id = v_booking.customer_id;
  select name into v_service from public.packages where id = v_booking.package_id;
  select nullif(split_breakdown->>'provider','')::numeric into v_payout
    from public.payments
   where booking_id = p_booking_id and coalesce(kind, 'visit') <> 'tip'
   order by created_at limit 1;

  return jsonb_build_object(
    'customer_name', coalesce(v_customer_name, v_booking.customer_email, 'Customer'),
    'address', v_booking.address,
    'property_size_sqm', v_booking.property_size_sqm,
    'service_name', coalesce(v_service, 'Service'),
    'scheduled_at', v_booking.scheduled_at,
    'preferred_scheduled_at', v_booking.preferred_scheduled_at,
    'optional_scheduled_at', v_booking.optional_scheduled_at,
    'special_instructions', v_booking.household_notes,
    'duration_minutes', coalesce(v_booking.duration_minutes, 120),
    'payout_amount', coalesce(v_booking.provider_payout, v_payout, 0)
  );
end
$function$;

revoke all on function public.provider_offer_details(uuid) from public, anon;
grant execute on function public.provider_offer_details(uuid) to authenticated;

create or replace function public.provider_accept_booking_time(
  p_booking_id uuid,
  p_selected_slot timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_uid uuid := auth.uid();
  v_provider public.providers;
  v_booking public.bookings;
  v_preference text;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = 'insufficient_privilege';
  end if;

  select * into v_provider
    from public.providers
   where profile_id = v_uid;
  if not found or v_provider.vetting_status <> 'approved' or v_provider.is_suspended then
    raise exception 'provider account is not available to accept bookings'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_booking
    from public.bookings
   where id = p_booking_id
   for update;
  if not found or v_booking.status::text <> 'offered' or v_booking.provider_id is not null then
    raise exception 'this booking is no longer available';
  end if;

  if not exists (
    select 1 from public.booking_offers offer
     where offer.booking_id = p_booking_id
       and offer.provider_id = v_provider.id
       and offer.status = 'open'
  ) then
    raise exception 'there is no open offer for this booking'
      using errcode = 'insufficient_privilege';
  end if;

  if p_selected_slot = coalesce(v_booking.preferred_scheduled_at, v_booking.scheduled_at) then
    v_preference := 'preferred';
  elsif p_selected_slot = any(v_booking.optional_scheduled_at) then
    v_preference := 'optional';
  else
    raise exception 'choose one of the customer submitted times'
      using errcode = 'check_violation';
  end if;

  if p_selected_slot <= now() then
    raise exception 'that booking time has already passed'
      using errcode = 'check_violation';
  end if;

  update public.bookings
     set scheduled_at = p_selected_slot
   where id = p_booking_id;

  return public._apply_booking_transition(
    p_booking_id,
    'scheduled',
    v_uid,
    'provider',
    null,
    jsonb_build_object(
      'selected_slot', p_selected_slot,
      'selected_preference', v_preference
    )
  );
end
$function$;

revoke all on function public.provider_accept_booking_time(uuid,timestamptz)
  from public, anon;
grant execute on function public.provider_accept_booking_time(uuid,timestamptz)
  to authenticated;

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
