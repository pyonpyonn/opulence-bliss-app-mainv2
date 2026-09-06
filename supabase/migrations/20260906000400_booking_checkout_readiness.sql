-- Checkout must be able to save a booking before Stripe authorises a card.
-- The app calls this read-only health check immediately before creating a
-- Checkout Session. It also makes a missing/partially applied booking migration
-- visible as a safe 503 response instead of an authorised payment with no visit.
create or replace function public.booking_checkout_ready()
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select
    (
      select count(*) = 4
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'bookings'
        and column_name = any(array[
          'duration_minutes',
          'property_size_sqm',
          'preferred_provider_id',
          'checkout_session_id'
        ])
    )
    and to_regprocedure(
      'public.finalize_customer_checkout(uuid,text,text,uuid,text,text,timestamptz,integer,numeric,uuid,numeric,numeric,text,text)'
    ) is not null
    and to_regprocedure(
      'public.system_initialize_booking_offer_queue(uuid,uuid[])'
    ) is not null;
$fn$;

revoke all on function public.booking_checkout_ready() from public, anon, authenticated;
grant execute on function public.booking_checkout_ready() to service_role;
