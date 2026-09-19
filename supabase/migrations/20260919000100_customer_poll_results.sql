-- Public aggregate results for the future-services poll.
--
-- The function returns one row for every option, including options with zero
-- votes. It never exposes customer ids or individual responses.

begin;

create or replace function public.customer_service_poll_results()
returns table (
  service_key text,
  vote_count bigint,
  vote_percent integer,
  total_votes bigint
)
language sql
stable
security definer
set search_path = public
as $fn$
  with poll_options(service_key) as (
    values
      ('maintenance'::text),
      ('moving_support'::text),
      ('garden'::text),
      ('pets'::text),
      ('tech_help'::text),
      ('carpet_upholstery'::text)
  ),
  counts as (
    select i.service_key, count(*)::bigint as vote_count
      from public.customer_service_interest i
     group by i.service_key
  ),
  totals as (
    select count(*)::bigint as total_votes
      from public.customer_service_interest
  )
  select
    o.service_key,
    coalesce(c.vote_count, 0)::bigint as vote_count,
    case
      when t.total_votes = 0 then 0
      else round(coalesce(c.vote_count, 0) * 100.0 / t.total_votes)::integer
    end as vote_percent,
    t.total_votes
  from poll_options o
  left join counts c using (service_key)
  cross join totals t;
$fn$;

revoke all on function public.customer_service_poll_results() from public;
grant execute on function public.customer_service_poll_results() to anon, authenticated;

-- Keep the database error consistent with the public customer wording. The
-- role check remains unchanged: only customer accounts can actually vote.
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
    raise exception 'Sign in to vote';
  end if;

  select role::text
    into v_role
    from public.profiles
   where id = v_customer_id;

  if v_role is distinct from 'customer' then
    raise exception 'Only customer accounts can vote';
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

revoke all on function public.submit_customer_service_interest(text, text)
  from public, anon;
grant execute on function public.submit_customer_service_interest(text, text)
  to authenticated;

commit;
