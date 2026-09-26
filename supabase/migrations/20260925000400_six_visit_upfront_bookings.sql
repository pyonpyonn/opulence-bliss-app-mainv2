-- One captured platform charge funds exactly six separately managed visits.
-- Install before enabling the regular Checkout path; regular_checkout_ready()
-- prevents a charge when this migration has not been applied.

begin;

create table if not exists public.regular_booking_series (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete restrict,
  package_id uuid not null references public.packages(id) on delete restrict,
  checkout_session_id text not null unique,
  stripe_payment_ref text not null unique,
  frequency text not null check (frequency in ('weekly', 'monthly')),
  total_amount numeric(12,2) not null check (total_amount > 0),
  platform_amount numeric(12,2) not null check (platform_amount >= 0 and platform_amount < total_amount),
  created_at timestamptz not null default now()
);

alter table public.regular_booking_series enable row level security;
revoke all on public.regular_booking_series from public, anon, authenticated;
grant select, insert on public.regular_booking_series to service_role;

alter table public.bookings
  add column if not exists regular_series_id uuid references public.regular_booking_series(id) on delete restrict,
  add column if not exists regular_visit_number smallint;

alter table public.bookings
  drop constraint if exists bookings_regular_visit_number_check;
alter table public.bookings
  add constraint bookings_regular_visit_number_check check (
    (regular_series_id is null and regular_visit_number is null)
    or (regular_series_id is not null and regular_visit_number between 1 and 6)
  );

create unique index if not exists bookings_regular_series_visit_unique
  on public.bookings(regular_series_id, regular_visit_number)
  where regular_series_id is not null;

revoke update(regular_series_id, regular_visit_number)
  on public.bookings from public, anon, authenticated, service_role;

create or replace function public.protect_regular_booking_identity()
returns trigger language plpgsql security definer set search_path = public as $function$
begin
  if old.regular_series_id is not null and (
    new.package_id is distinct from old.package_id
    or new.regular_series_id is distinct from old.regular_series_id
    or new.regular_visit_number is distinct from old.regular_visit_number
    or new.booking_frequency is distinct from old.booking_frequency
  ) then
    raise exception 'An upfront-paid visit cannot change package or series identity; cancel and rebook instead.';
  end if;
  return new;
end
$function$;

drop trigger if exists bookings_protect_regular_identity on public.bookings;
create trigger bookings_protect_regular_identity
before update of package_id, regular_series_id, regular_visit_number, booking_frequency
on public.bookings for each row execute function public.protect_regular_booking_identity();
revoke all on function public.protect_regular_booking_identity() from public, anon, authenticated, service_role;

alter table public.booking_checkout_time_choices
  add column if not exists regular_scheduled_at timestamptz[] not null default '{}'::timestamptz[];

create or replace function public.finalize_regular_customer_checkout(
  p_customer_id uuid,
  p_session_id text,
  p_payment_ref text,
  p_package_id uuid,
  p_postcode text,
  p_address text,
  p_request text,
  p_slots timestamptz[],
  p_duration_minutes integer,
  p_frequency text,
  p_preferred_provider_id uuid,
  p_total_pence integer,
  p_platform_pence integer,
  p_amounts integer[],
  p_platforms integer[],
  p_email text
)
returns uuid[]
language plpgsql security definer set search_path = public as $function$
declare
  v_series uuid;
  v_booking uuid;
  v_ids uuid[] := '{}'::uuid[];
  v_anchor timestamp;
  v_month_start date;
  v_expected_date date;
  v_expected timestamp;
  v_package public.packages;
  v_index integer;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service role required' using errcode = 'insufficient_privilege';
  end if;
  if coalesce(p_session_id, '') = '' or coalesce(p_payment_ref, '') = ''
     or char_length(btrim(coalesce(p_address, ''))) < 5
     or p_frequency not in ('weekly', 'monthly')
     or cardinality(p_slots) <> 6 or cardinality(p_amounts) <> 6
     or cardinality(p_platforms) <> 6
     or p_duration_minutes < 120 or p_duration_minutes > 600
     or mod(p_duration_minutes, 30) <> 0
     or p_total_pence is null or p_total_pence <= 0
     or p_platform_pence is null or p_platform_pence < 0
     or p_platform_pence >= p_total_pence then
    raise exception 'Invalid six-visit checkout.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_session_id, 0));
  select id into v_series from public.regular_booking_series
   where checkout_session_id = p_session_id
     and customer_id = p_customer_id and stripe_payment_ref = p_payment_ref;
  if found then
    select array_agg(id order by regular_visit_number) into v_ids
      from public.bookings where regular_series_id = v_series;
    return v_ids;
  end if;
  if exists (select 1 from public.regular_booking_series where checkout_session_id = p_session_id or stripe_payment_ref = p_payment_ref) then
    raise exception 'Checkout reference already belongs to a different customer or payment.';
  end if;

  select * into v_package from public.packages
   where id = p_package_id and billing_type = 'per_visit'
     and lower(coalesce(service_type, '')) like '%clean%';
  if not found then raise exception 'Regular Essential Clean is not available.'; end if;

  if p_preferred_provider_id is not null and not exists (
    select 1 from public.bookings b join public.packages pkg on pkg.id = b.package_id
     where b.customer_id = p_customer_id and b.provider_id = p_preferred_provider_id
       and b.status::text = 'completed' and lower(coalesce(pkg.service_type, '')) like '%clean%'
  ) then
    raise exception 'Requested cleaner must come from a completed visit.';
  end if;

  if exists (select 1 from unnest(p_slots) as choice(slot) where slot is null)
     or (select count(distinct slot) from unnest(p_slots) as choice(slot)) <> 6
     or p_slots[6] > now() + interval '1 year'
     or (select sum(value) from unnest(p_amounts) as amount(value)) <> p_total_pence
     or (select sum(value) from unnest(p_platforms) as margin(value)) <> p_platform_pence then
    raise exception 'Six distinct, funded visits within one year are required.';
  end if;

  v_anchor := p_slots[1] at time zone 'Europe/London';
  for v_index in 1..6 loop
    if p_amounts[v_index] <= 0 or p_platforms[v_index] < 0
       or p_platforms[v_index] >= p_amounts[v_index] then
      raise exception 'Invalid visit payment allocation.';
    end if;
    if p_frequency = 'weekly' then
      v_expected_date := v_anchor::date + 7 * (v_index - 1);
    else
      v_month_start := (date_trunc('month', v_anchor) + make_interval(months => v_index - 1))::date;
      v_expected_date := v_month_start + least(
        extract(day from v_anchor)::integer,
        extract(day from v_month_start + interval '1 month - 1 day')::integer
      ) - 1;
    end if;
    v_expected := v_expected_date + v_anchor::time;
    if (p_slots[v_index] at time zone 'Europe/London') <> v_expected then
      raise exception 'Visit dates must follow the chosen London schedule.';
    end if;
  end loop;

  insert into public.regular_booking_series(
    customer_id, package_id, checkout_session_id, stripe_payment_ref,
    frequency, total_amount, platform_amount
  ) values (
    p_customer_id, p_package_id, p_session_id, p_payment_ref,
    p_frequency, p_total_pence / 100.0, p_platform_pence / 100.0
  ) returning id into v_series;

  for v_index in 1..6 loop
    insert into public.bookings(
      customer_id, provider_id, package_id, scheduled_at, preferred_scheduled_at,
      optional_scheduled_at, status, address, customer_email, household_notes,
      offer_expires_at, duration_minutes, property_size_sqm, booking_frequency,
      preferred_provider_id, checkout_session_id, regular_series_id, regular_visit_number
    ) values (
      p_customer_id, null, p_package_id, p_slots[v_index], p_slots[v_index],
      '{}'::timestamptz[], 'offered', btrim(p_address), p_email, p_request,
      p_slots[v_index] - interval '2 hours', p_duration_minutes, null,
      p_frequency, p_preferred_provider_id,
      case when v_index = 1 then p_session_id else null end,
      v_series, v_index
    ) returning id into v_booking;
    v_ids := array_append(v_ids, v_booking);

    insert into public.payments(
      booking_id, gross_amount, split_breakdown, stripe_payment_ref, status
    ) values (
      v_booking, p_amounts[v_index] / 100.0,
      jsonb_build_object(
        'provider', (p_amounts[v_index] - p_platforms[v_index]) / 100.0,
        'platform_margin', p_platforms[v_index] / 100.0,
        'upfront_series_id', v_series
      ),
      p_payment_ref, 'succeeded'
    );
  end loop;
  insert into public.notifications(user_id, title, body, href)
  values(
    p_customer_id,
    'Six visits booked',
    'Your six Essential Clean visits have been paid upfront. See each visit and its professional in My Bookings.',
    '/account'
  );
  return v_ids;
end
$function$;

revoke all on function public.finalize_regular_customer_checkout(
  uuid,text,text,uuid,text,text,text,timestamptz[],integer,text,uuid,integer,integer,integer[],integer[],text
) from public, anon, authenticated;
grant execute on function public.finalize_regular_customer_checkout(
  uuid,text,text,uuid,text,text,text,timestamptz[],integer,text,uuid,integer,integer,integer[],integer[],text
) to service_role;

create or replace function public.regular_checkout_ready()
returns boolean language sql stable security definer set search_path = public as $function$
  select to_regclass('public.regular_booking_series') is not null
     and to_regprocedure('public.finalize_regular_customer_checkout(uuid,text,text,uuid,text,text,text,timestamptz[],integer,text,uuid,integer,integer,integer[],integer[],text)') is not null
     and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'bookings' and column_name = 'regular_series_id')
     and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'booking_checkout_time_choices' and column_name = 'regular_scheduled_at');
$function$;
revoke all on function public.regular_checkout_ready() from public, anon, authenticated;
grant execute on function public.regular_checkout_ready() to service_role;

notify pgrst, 'reload schema';
commit;
