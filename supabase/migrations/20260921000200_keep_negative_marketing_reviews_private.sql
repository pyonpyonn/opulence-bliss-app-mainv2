-- Marketing testimonials follow the same public-review rule as booking reviews:
-- ratings below four remain visible to admins, but never on public pages.

update public.marketing_reviews
set published = false,
    updated_at = now()
where rating < 4 and published;

drop policy if exists "public reads published marketing reviews" on public.marketing_reviews;
create policy "public reads published positive marketing reviews"
on public.marketing_reviews
for select to public
using (published and rating >= 4);

alter table public.marketing_reviews
  add constraint marketing_reviews_positive_when_published
  check (not published or rating >= 4);
