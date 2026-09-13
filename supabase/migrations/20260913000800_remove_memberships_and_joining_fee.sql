-- Retire new memberships and the professional joining fee without deleting
-- historical subscription or Stripe records.

begin;

-- The column remains for old audit/reference data, but new professional rows
-- must never default into an artificial payment gate.
alter table public.providers
  alter column joining_fee_paid set default true;

-- Monthly packages remain referenced by historical bookings and invoices, so
-- deactivate rather than delete them.
update public.packages
   set active = false
 where billing_type = 'monthly'
   and active = true;

-- Previous-cleaner requests depend on approval, not a retired fee flag.
create or replace function public.my_previous_cleaners()
returns table(provider_id uuid, display_name text)
language sql stable security definer set search_path = public as $fn$
  select distinct p.id, coalesce(p.display_name, 'Previous cleaner')
  from public.bookings b
  join public.providers p on p.id = b.provider_id
  join public.packages pkg on pkg.id = b.package_id
  where b.customer_id = auth.uid()
    and b.status::text = 'completed'
    and lower(coalesce(pkg.service_type, '')) like '%clean%'
    and p.vetting_status = 'approved'
    and coalesce(p.is_suspended, false) = false;
$fn$;
revoke all on function public.my_previous_cleaners() from public, anon;
grant execute on function public.my_previous_cleaners() to authenticated;

-- Remove obsolete chatbot documents. The application prompt and future seed
-- runs now describe pay-per-visit booking only.
delete from public.ai_docs
 where lower(coalesce(title, '')) ~ '(membership|subscription)'
    or lower(coalesce(content, '')) ~ '(membership|subscription|/subscribe)';

do $verify$
begin
  if exists (
    select 1 from public.packages
     where billing_type = 'monthly' and active = true
  ) then
    raise exception 'Monthly packages are still active.';
  end if;

  if pg_get_functiondef('public.my_previous_cleaners()'::regprocedure)
       ilike '%joining_fee_paid%' then
    raise exception 'Previous-cleaner matching still depends on the retired joining fee.';
  end if;
end
$verify$;

commit;
