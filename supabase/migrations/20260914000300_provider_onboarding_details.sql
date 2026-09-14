-- Private professional application details used during onboarding review.

begin;

create table if not exists public.provider_onboarding_details (
  provider_id uuid primary key references public.providers(id) on delete cascade,
  preferred_weekly_hours smallint not null default 20
    check (preferred_weekly_hours between 0 and 40),
  resident_status text not null
    check (resident_status in (
      'British or Irish citizen',
      'Asylum Seeker',
      'Dependent / spouse Visa',
      'Limited leave to remain',
      'Refugee',
      'Indefinite leave to remain / settled status',
      'Sponsored Visa',
      'Student Visa'
    )),
  utr_number text
    check (utr_number is null or utr_number ~ '^\d{10}$'),
  self_employed_confirmed boolean not null
    check (self_employed_confirmed = true),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.provider_onboarding_details is
  'Private professional eligibility and availability details. UTR is optional and never exposed publicly.';

alter table public.provider_onboarding_details enable row level security;
revoke all on public.provider_onboarding_details from public, anon, authenticated;
grant select on public.provider_onboarding_details to authenticated;
grant select, insert, update, delete on public.provider_onboarding_details to service_role;

drop policy if exists "providers and admins read onboarding details"
  on public.provider_onboarding_details;
create policy "providers and admins read onboarding details"
on public.provider_onboarding_details for select to authenticated
using (
  provider_id = public.current_provider_id()
  or public.is_admin()
);

commit;
