-- Customer-selected duration is a snapshot: later package edits must not change paid hours.
alter table public.bookings
  add column if not exists duration_minutes integer,
  add column if not exists property_size_sqm numeric,
  add column if not exists preferred_provider_id uuid,
  add column if not exists checkout_session_id text;

create unique index if not exists bookings_checkout_session_unique on public.bookings(checkout_session_id) where checkout_session_id is not null;

-- Avoid revalidating historical appointment windows while taking duration snapshots.
update public.bookings b set duration_minutes = coalesce(p.duration_minutes, 120)
from public.packages p where p.id = b.package_id and b.duration_minutes is null;

alter table public.bookings add constraint booking_duration_positive check (duration_minutes is null or duration_minutes > 0);
alter table public.bookings add constraint booking_property_size_positive check (property_size_sqm is null or (property_size_sqm > 0 and property_size_sqm <= 100000));
revoke update(duration_minutes, property_size_sqm, preferred_provider_id, checkout_session_id) on public.bookings from public, anon, authenticated, service_role;

update public.booking_rules set appointment_start_hour = 7, appointment_end_hour = 20 where id = 1;
alter table public.booking_rules alter column appointment_end_hour set default 20;

create or replace function public.enforce_booking_appointment_window()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare
  v_package public.packages;
  v_local timestamp;
  v_clean boolean;
begin
  select * into v_package from public.packages where id = new.package_id;
  v_clean := lower(coalesce(v_package.service_type, '')) like '%clean%';
  if tg_op = 'UPDATE' and new.package_id is distinct from old.package_id then
    if old.checkout_session_id is not null then
      raise exception 'To change a paid package, cancel and rebook so the new price can be authorised.';
    end if;
    new.duration_minutes := coalesce(v_package.duration_minutes, 120);
  else
    new.duration_minutes := coalesce(new.duration_minutes, v_package.duration_minutes, 120);
  end if;
  if v_clean and (new.duration_minutes < 120 or new.duration_minutes > 480 or mod(new.duration_minutes, 30) <> 0) then
    raise exception 'Cleaning sessions must be 2 to 8 hours in 30-minute steps.' using errcode = 'check_violation';
  end if;
  if v_clean and new.checkout_session_id is not null and
     (new.property_size_sqm is null or new.property_size_sqm <= 0 or new.property_size_sqm > 100000) then
    raise exception 'Enter a valid property size.' using errcode = 'check_violation';
  end if;
  v_local := new.scheduled_at at time zone 'Europe/London';
  if v_local is null or v_local::time < time '07:00' or v_local::time > time '20:00'
     or mod(extract(minute from v_local)::integer, 30) <> 0
     or extract(second from v_local) <> 0 then
    raise exception 'Appointments must start between 7:00 AM and 8:00 PM, on the hour or half hour (London time).' using errcode = 'check_violation';
  end if;
  return new;
end $fn$;
drop trigger if exists bookings_enforce_appointment_window on public.bookings;
create trigger bookings_enforce_appointment_window before insert or update of scheduled_at, package_id, duration_minutes, property_size_sqm on public.bookings
for each row execute function public.enforce_booking_appointment_window();
revoke all on function public.enforce_booking_appointment_window() from public;

create or replace function public.my_previous_cleaners()
returns table(provider_id uuid, display_name text)
language sql stable security definer set search_path = public as $fn$
  select distinct p.id, coalesce(p.display_name, 'Previous cleaner')
  from public.bookings b
  join public.providers p on p.id = b.provider_id
  join public.packages pkg on pkg.id = b.package_id
  where b.customer_id = auth.uid() and b.status::text = 'completed'
    and lower(coalesce(pkg.service_type, '')) like '%clean%'
    and p.vetting_status = 'approved' and p.joining_fee_paid = true;
$fn$;
revoke all on function public.my_previous_cleaners() from public, anon;
grant execute on function public.my_previous_cleaners() to authenticated;

-- Consent evidence is immutable and captured on account creation, independently
-- of editable user metadata. Existing users are not assigned invented consent.
create table public.signup_consents (
  user_id uuid primary key references auth.users(id) on delete cascade,
  legal_version text not null,
  accepted_at timestamptz not null default now()
);
alter table public.signup_consents enable row level security;
revoke all on public.signup_consents from public, anon, authenticated, service_role;
grant select on public.signup_consents to service_role;
create or replace function public.record_signup_consent()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  if new.raw_user_meta_data->>'legal_accepted' = 'true'
     and coalesce(new.raw_user_meta_data->>'legal_version', '') <> '' then
    insert into public.signup_consents(user_id, legal_version)
    values(new.id, new.raw_user_meta_data->>'legal_version');
  end if;
  return new;
end $fn$;
create trigger record_signup_consent after insert on auth.users for each row execute function public.record_signup_consent();
revoke all on function public.record_signup_consent() from public, anon, authenticated, service_role;

create or replace function public.finalize_customer_checkout(
  p_customer_id uuid, p_session_id text, p_payment_ref text, p_package_id uuid,
  p_postcode text, p_request text, p_slot timestamptz, p_duration_minutes integer,
  p_property_size_sqm numeric, p_preferred_provider_id uuid, p_amount numeric,
  p_platform numeric, p_email text, p_payment_status text
) returns uuid language plpgsql security definer set search_path = public as $fn$
declare
  v_id uuid;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service role required' using errcode = 'insufficient_privilege';
  end if;
  if coalesce(p_session_id, '') = '' or coalesce(p_payment_ref, '') = ''
     or p_amount is null or p_amount <= 0 or p_platform is null or p_platform < 0 or p_platform >= p_amount
     or p_payment_status not in ('succeeded', 'authorised') then
    raise exception 'Invalid checkout.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_session_id, 0));
  select id into v_id from public.bookings where checkout_session_id = p_session_id and customer_id = p_customer_id;
  if found then return v_id; end if;
  if p_preferred_provider_id is not null and not exists (
    select 1 from public.bookings b join public.packages pkg on pkg.id = b.package_id
    where b.customer_id = p_customer_id and b.provider_id = p_preferred_provider_id
      and b.status::text = 'completed' and lower(coalesce(pkg.service_type, '')) like '%clean%'
  ) then raise exception 'Requested cleaner must come from a completed cleaning visit.'; end if;
  insert into public.bookings(customer_id, provider_id, package_id, scheduled_at, status, address,
    customer_email, household_notes, offer_expires_at, duration_minutes, property_size_sqm, preferred_provider_id, checkout_session_id)
  values(p_customer_id, null, p_package_id, p_slot, 'offered', p_postcode, p_email, p_request,
    p_slot - interval '2 hours', p_duration_minutes, p_property_size_sqm, p_preferred_provider_id, p_session_id)
  returning id into v_id;
  insert into public.payments(booking_id, gross_amount, split_breakdown, stripe_payment_ref, status)
  values(v_id, p_amount, jsonb_build_object('provider', p_amount - p_platform, 'platform_margin', p_platform), p_payment_ref, p_payment_status);
  return v_id;
end $fn$;
revoke all on function public.finalize_customer_checkout(uuid,text,text,uuid,text,text,timestamptz,integer,numeric,uuid,numeric,numeric,text,text) from public, anon, authenticated;
grant execute on function public.finalize_customer_checkout(uuid,text,text,uuid,text,text,timestamptz,integer,numeric,uuid,numeric,numeric,text,text) to service_role;

-- Idempotent initial queue setup. Keep the private queue tables function-only.
create or replace function public.system_initialize_booking_offer_queue(p_booking_id uuid,p_provider_ids uuid[])
returns boolean language plpgsql security definer set search_path = public as $fn$
declare v_booking public.bookings;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'service role required'; end if;
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found or v_booking.status::text <> 'offered' or v_booking.provider_id is not null then return false; end if;
  if exists(select 1 from public.booking_offer_runs where booking_id = p_booking_id) then return false; end if;
  perform public.system_seed_booking_offer_queue(p_booking_id,p_provider_ids);
  return true;
end $fn$;
revoke all on function public.system_initialize_booking_offer_queue(uuid,uuid[]) from public, anon, authenticated;
grant execute on function public.system_initialize_booking_offer_queue(uuid,uuid[]) to service_role;
