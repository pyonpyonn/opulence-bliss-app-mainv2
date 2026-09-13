-- Customer interest poll for possible future services.
-- One current response per customer; submitting again updates that response.

begin;

create table if not exists public.customer_service_interest (
  customer_id uuid primary key references public.profiles(id) on delete cascade,
  service_key text not null check (
    service_key in ('moving_support', 'maintenance', 'mobile_body_massage')
  ),
  suggestion text check (
    suggestion is null or char_length(suggestion) <= 500
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.customer_service_interest enable row level security;

revoke all on table public.customer_service_interest from public, anon, authenticated, service_role;
grant select on table public.customer_service_interest to authenticated;

drop policy if exists "admins can read service interest" on public.customer_service_interest;
create policy "admins can read service interest"
on public.customer_service_interest
for select
to authenticated
using (public.is_admin());

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

  if p_service_key not in ('moving_support', 'maintenance', 'mobile_body_massage') then
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

create or replace function public.my_customer_service_interest()
returns table (
  service_key text,
  suggestion text,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $fn$
  select i.service_key, i.suggestion, i.updated_at
    from public.customer_service_interest i
   where i.customer_id = auth.uid();
$fn$;

revoke all on function public.submit_customer_service_interest(text, text) from public, anon;
revoke all on function public.my_customer_service_interest() from public, anon;
grant execute on function public.submit_customer_service_interest(text, text) to authenticated;
grant execute on function public.my_customer_service_interest() to authenticated;

commit;
