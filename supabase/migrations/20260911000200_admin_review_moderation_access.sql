-- Admins need a complete review stream for moderation. Public visitors still
-- see only public reviews, and regular users see private content only when
-- they are the recipient.

begin;

drop policy if exists "public and recipients read reviews" on public.reviews;
drop policy if exists "public recipients and admins read reviews" on public.reviews;
create policy "public recipients and admins read reviews"
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

commit;
