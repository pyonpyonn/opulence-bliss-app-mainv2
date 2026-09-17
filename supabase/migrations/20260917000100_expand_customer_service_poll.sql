-- Expands the customer "which service next" poll from two options to six.
--
-- Purely additive: 'moving_support' and 'maintenance' both stay permitted, so
-- no existing row in customer_service_interest is invalidated and no vote is
-- lost. 'moving_support' now backs "Home organisation / House movers" and
-- 'maintenance' backs "Home maintenance / handyman".
--
-- The allowed list is enforced in two places (a check constraint and a
-- hard-coded test inside submit_customer_service_interest). Both must be kept
-- in step or votes fail at run time.

begin;

alter table public.customer_service_interest
  drop constraint if exists customer_service_interest_service_key_check;

alter table public.customer_service_interest
  add constraint customer_service_interest_service_key_check
  check (
    service_key in (
      'maintenance',
      'moving_support',
      'garden',
      'pets',
      'tech_help',
      'carpet_upholstery'
    )
  );

create or replace function public.submit_customer_service_interest(
  p_service_key text,
  p_suggestion text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_customer_id uuid := auth.uid();
  v_role text;
  v_suggestion text := nullif(btrim(coalesce(p_suggestion, '')), '');
begin
  if v_customer_id is null then
    raise exception 'Sign in as a client to vote';
  end if;

  select role::text
    into v_role
    from public.profiles
   where id = v_customer_id;

  if v_role is distinct from 'customer' then
    raise exception 'Only client accounts can vote';
  end if;

  if p_service_key not in (
    'maintenance',
    'moving_support',
    'garden',
    'pets',
    'tech_help',
    'carpet_upholstery'
  ) then
    raise exception 'Choose one of the available services';
  end if;

  if char_length(coalesce(v_suggestion, '')) > 500 then
    raise exception 'Suggestions must be 500 characters or fewer';
  end if;

  insert into public.customer_service_interest (
    customer_id,
    service_key,
    suggestion
  )
  values (
    v_customer_id,
    p_service_key,
    v_suggestion
  )
  on conflict (customer_id) do update
    set service_key = excluded.service_key,
        suggestion = excluded.suggestion,
        updated_at = now();
end;
$fn$;

revoke all on function public.submit_customer_service_interest(text, text) from public, anon;
grant execute on function public.submit_customer_service_interest(text, text) to authenticated;

commit;

