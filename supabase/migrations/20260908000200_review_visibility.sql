-- Public/private cleaner feedback. Public review feeds contain positive
-- customer reviews only; booking participants and admins retain private access.

begin;

alter table public.reviews add column if not exists visibility text;

update public.reviews
set visibility = case
  when reviewer = 'client' and rating >= 4 then 'public'
  else 'private'
end
where visibility is null;

alter table public.reviews alter column visibility set default 'private';
alter table public.reviews alter column visibility set not null;

do $constraints$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.reviews'::regclass
      and conname = 'reviews_visibility_check'
  ) then
    alter table public.reviews
      add constraint reviews_visibility_check
      check (visibility in ('public', 'private'));
  end if;
end
$constraints$;

alter table public.providers
  add column if not exists public_rating_avg numeric(3,2),
  add column if not exists public_rating_count integer not null default 0;

create or replace function public.enforce_review_visibility()
returns trigger
language plpgsql
set search_path = public
as $fn$
begin
  if new.reviewer <> 'client' or new.rating < 4 or new.visibility <> 'public' then
    new.visibility := 'private';
  end if;
  return new;
end
$fn$;

drop trigger if exists enforce_review_visibility on public.reviews;
create trigger enforce_review_visibility
before insert or update of rating, reviewer, visibility on public.reviews
for each row execute function public.enforce_review_visibility();

create or replace function public.recompute_review_ratings(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_provider_id uuid;
  v_customer_id uuid;
begin
  select provider_id, customer_id
    into v_provider_id, v_customer_id
  from public.bookings
  where id = p_booking_id;

  if v_provider_id is not null then
    update public.providers p
    set rating_avg = (
          select avg(r.rating)::numeric(3,2)
          from public.reviews r
          join public.bookings b on b.id = r.booking_id
          where b.provider_id = v_provider_id and r.reviewer = 'client'
        ),
        rating_count = (
          select count(*)::integer
          from public.reviews r
          join public.bookings b on b.id = r.booking_id
          where b.provider_id = v_provider_id and r.reviewer = 'client'
        ),
        public_rating_avg = (
          select avg(r.rating)::numeric(3,2)
          from public.reviews r
          join public.bookings b on b.id = r.booking_id
          where b.provider_id = v_provider_id
            and r.reviewer = 'client'
            and r.visibility = 'public'
            and r.rating >= 4
        ),
        public_rating_count = (
          select count(*)::integer
          from public.reviews r
          join public.bookings b on b.id = r.booking_id
          where b.provider_id = v_provider_id
            and r.reviewer = 'client'
            and r.visibility = 'public'
            and r.rating >= 4
        )
    where p.id = v_provider_id;
  end if;

  if v_customer_id is not null then
    update public.profiles pr
    set client_rating_avg = (
          select avg(r.rating)::numeric(3,2)
          from public.reviews r
          join public.bookings b on b.id = r.booking_id
          where b.customer_id = v_customer_id and r.reviewer = 'provider'
        ),
        client_rating_count = (
          select count(*)::integer
          from public.reviews r
          join public.bookings b on b.id = r.booking_id
          where b.customer_id = v_customer_id and r.reviewer = 'provider'
        )
    where pr.id = v_customer_id;
  end if;
end
$fn$;

revoke all on function public.recompute_review_ratings(uuid)
  from public, anon, authenticated;

create or replace function public.refresh_ratings()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if tg_op <> 'DELETE' then
    perform public.recompute_review_ratings(new.booking_id);
  end if;

  if tg_op = 'DELETE' then
    perform public.recompute_review_ratings(old.booking_id);
    return old;
  end if;

  if tg_op = 'UPDATE' and old.booking_id is distinct from new.booking_id then
    perform public.recompute_review_ratings(old.booking_id);
  end if;

  return new;
end
$fn$;

drop trigger if exists on_review_changed on public.reviews;
create trigger on_review_changed
after insert or update or delete on public.reviews
for each row execute function public.refresh_ratings();

update public.providers p
set public_rating_avg = (
      select avg(r.rating)::numeric(3,2)
      from public.reviews r
      join public.bookings b on b.id = r.booking_id
      where b.provider_id = p.id
        and r.reviewer = 'client'
        and r.visibility = 'public'
        and r.rating >= 4
    ),
    public_rating_count = (
      select count(*)::integer
      from public.reviews r
      join public.bookings b on b.id = r.booking_id
      where b.provider_id = p.id
        and r.reviewer = 'client'
        and r.visibility = 'public'
        and r.rating >= 4
    );

drop policy if exists "anyone reads reviews" on public.reviews;
drop policy if exists "public and participants read reviews" on public.reviews;
create policy "public and participants read reviews"
on public.reviews for select to public
using (
  (
    reviewer = 'client'
    and rating >= 4
    and visibility = 'public'
  )
  or public.is_admin()
  or exists (
    select 1
    from public.bookings b
    where b.id = reviews.booking_id
      and (
        b.customer_id = auth.uid()
        or b.provider_id = public.current_provider_id()
      )
  )
);

create index if not exists reviews_public_feed_idx
  on public.reviews(created_at desc)
  where reviewer = 'client' and rating >= 4 and visibility = 'public';

commit;
