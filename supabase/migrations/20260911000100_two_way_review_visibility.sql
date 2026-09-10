-- Two-way public/private reviews. Private content is readable by the person
-- who received it; public content is readable by everyone.

begin;

create or replace function public.enforce_review_visibility()
returns trigger
language plpgsql
set search_path = public
as $fn$
begin
  if new.visibility <> 'public' then
    new.visibility := 'private';
  elsif new.reviewer = 'client' and new.rating < 4 then
    -- Preserve the cleaner-protection rule: negative cleaner reviews cannot
    -- be published, even if a modified client tries to submit them as public.
    new.visibility := 'private';
  end if;
  return new;
end
$fn$;

drop policy if exists "public and participants read reviews" on public.reviews;
drop policy if exists "public and recipients read reviews" on public.reviews;
create policy "public and recipients read reviews"
on public.reviews for select to public
using (
  visibility = 'public'
  or public.is_admin()
  or (
    reviewer = 'client'
    and exists (
      select 1
      from public.bookings b
      where b.id = reviews.booking_id
        and b.provider_id = public.current_provider_id()
    )
  )
  or (
    reviewer = 'provider'
    and exists (
      select 1
      from public.bookings b
      where b.id = reviews.booking_id
        and b.customer_id = auth.uid()
    )
  )
);

create or replace function public.my_review_submission_states()
returns table (
  booking_id uuid,
  reviewer text,
  visibility text
)
language sql
stable
security definer
set search_path = public
as $fn$
  select r.booking_id, r.reviewer, r.visibility
  from public.reviews r
  join public.bookings b on b.id = r.booking_id
  where auth.uid() is not null
    and (
      (r.reviewer = 'client' and b.customer_id = auth.uid())
      or
      (r.reviewer = 'provider' and b.provider_id = public.current_provider_id())
    );
$fn$;

revoke all on function public.my_review_submission_states()
  from public, anon;
grant execute on function public.my_review_submission_states()
  to authenticated;

create or replace function public.public_reviews_feed(p_limit integer default 60)
returns table (
  id uuid,
  reviewer text,
  rating integer,
  comment text,
  created_at timestamptz,
  recipient_name text,
  recipient_type text
)
language sql
stable
security definer
set search_path = public
as $fn$
  select
    r.id,
    r.reviewer,
    r.rating,
    r.comment,
    r.created_at,
    case
      when r.reviewer = 'client'
        then coalesce(nullif(trim(p.display_name), ''), 'Opulence professional')
      else 'Verified client'
    end as recipient_name,
    case when r.reviewer = 'client' then 'professional' else 'client' end
      as recipient_type
  from public.reviews r
  join public.bookings b on b.id = r.booking_id
  left join public.providers p on p.id = b.provider_id
  where r.visibility = 'public'
    and (r.reviewer = 'provider' or r.rating >= 4)
  order by r.created_at desc
  limit least(greatest(coalesce(p_limit, 60), 1), 100);
$fn$;

revoke all on function public.public_reviews_feed(integer) from public;
grant execute on function public.public_reviews_feed(integer)
  to anon, authenticated;

create index if not exists reviews_visibility_created_idx
  on public.reviews(visibility, created_at desc)
  where visibility = 'public';

commit;
