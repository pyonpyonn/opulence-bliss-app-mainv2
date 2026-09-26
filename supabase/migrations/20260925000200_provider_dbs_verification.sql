-- Private DBS certificate evidence and an approval gate for professionals.

begin;

alter table public.providers
  add column if not exists dbs_verified boolean not null default false;

comment on column public.providers.dbs_verified is
  'Safe public indicator maintained from the private DBS review record.';

create table if not exists public.provider_dbs_checks (
  provider_id uuid primary key references public.providers(id) on delete cascade,
  certificate_number text not null check (certificate_number ~ '^\d{12}$'),
  issue_date date not null,
  certificate_storage_path text not null unique,
  certificate_original_name text not null,
  certificate_mime_type text not null check (
    certificate_mime_type in ('application/pdf', 'image/jpeg', 'image/png')
  ),
  status text not null default 'pending' check (
    status in ('pending', 'verified', 'failed')
  ),
  review_note text,
  submitted_at timestamptz not null default now(),
  uploaded_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

comment on table public.provider_dbs_checks is
  'Private DBS certificate evidence. Only the applicant and administrators may read it.';

alter table public.provider_dbs_checks enable row level security;
revoke all on table public.provider_dbs_checks
  from public, anon, authenticated, service_role;
grant select on table public.provider_dbs_checks to authenticated;
grant update (uploaded_at) on table public.provider_dbs_checks to authenticated;
grant all on table public.provider_dbs_checks to service_role;

drop policy if exists "applicants and admins read DBS evidence"
  on public.provider_dbs_checks;
create policy "applicants and admins read DBS evidence"
on public.provider_dbs_checks
for select
to authenticated
using (
  provider_id = public.current_provider_id()
  or public.is_admin()
);

drop policy if exists "applicants mark their DBS upload complete"
  on public.provider_dbs_checks;
create policy "applicants mark their DBS upload complete"
on public.provider_dbs_checks
for update
to authenticated
using (
  provider_id = public.current_provider_id()
  and status = 'pending'
)
with check (
  provider_id = public.current_provider_id()
  and status = 'pending'
);

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
) values (
  'provider-dbs',
  'provider-dbs',
  false,
  8388608,
  array['application/pdf', 'image/jpeg', 'image/png']::text[]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "applicants upload their own DBS certificate"
  on storage.objects;
create policy "applicants upload their own DBS certificate"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'provider-dbs'
  and (storage.foldername(name))[1] = public.current_provider_id()::text
  and exists (
    select 1
    from public.provider_dbs_checks check_record
    where check_record.provider_id = public.current_provider_id()
      and check_record.status = 'pending'
      and check_record.certificate_storage_path = name
  )
);

drop policy if exists "applicants replace their pending DBS certificate"
  on storage.objects;
create policy "applicants replace their pending DBS certificate"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'provider-dbs'
  and (storage.foldername(name))[1] = public.current_provider_id()::text
  and exists (
    select 1
    from public.provider_dbs_checks check_record
    where check_record.provider_id = public.current_provider_id()
      and check_record.status = 'pending'
      and check_record.certificate_storage_path = name
  )
)
with check (
  bucket_id = 'provider-dbs'
  and (storage.foldername(name))[1] = public.current_provider_id()::text
);

drop policy if exists "applicants and admins read DBS certificates"
  on storage.objects;
create policy "applicants and admins read DBS certificates"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'provider-dbs'
  and (
    (storage.foldername(name))[1] = public.current_provider_id()::text
    or public.is_admin()
  )
);

create or replace function public.sync_provider_dbs_verification()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  update public.providers
  set
    dbs_verified = new.status = 'verified',
    show_on_our_pros = case
      when new.status = 'verified' then show_on_our_pros
      else false
    end,
    vetting_status = case
      when new.status <> 'verified' and vetting_status = 'approved'
        then 'pending'
      else vetting_status
    end
  where id = new.provider_id;
  return new;
end
$fn$;

drop trigger if exists sync_provider_dbs_verification
  on public.provider_dbs_checks;
create trigger sync_provider_dbs_verification
after insert or update of status
on public.provider_dbs_checks
for each row execute function public.sync_provider_dbs_verification();

create or replace function public.enforce_dbs_before_provider_approval()
returns trigger
language plpgsql
set search_path = public
as $fn$
begin
  if new.vetting_status = 'approved'
     and old.vetting_status is distinct from 'approved'
     and not new.dbs_verified then
    raise exception 'DBS verification is required before provider approval'
      using errcode = 'check_violation';
  end if;
  return new;
end
$fn$;

drop trigger if exists enforce_dbs_before_provider_approval
  on public.providers;
create trigger enforce_dbs_before_provider_approval
before update of vetting_status
on public.providers
for each row execute function public.enforce_dbs_before_provider_approval();

create or replace function public.enforce_dbs_before_public_directory()
returns trigger
language plpgsql
set search_path = public
as $fn$
begin
  if new.show_on_our_pros
     and old.show_on_our_pros is distinct from true
     and not new.dbs_verified then
    raise exception 'DBS verification is required before public directory display'
      using errcode = 'check_violation';
  end if;
  return new;
end
$fn$;

drop trigger if exists enforce_dbs_before_public_directory
  on public.providers;
create trigger enforce_dbs_before_public_directory
before update of show_on_our_pros
on public.providers
for each row execute function public.enforce_dbs_before_public_directory();

create or replace function public.enforce_verified_dbs_booking_assignment()
returns trigger
language plpgsql
set search_path = public
as $fn$
declare
  v_assignment_changed boolean := false;
begin
  if new.provider_id is not null then
    if tg_op = 'INSERT' then
      v_assignment_changed := true;
    elsif tg_op = 'UPDATE' then
      v_assignment_changed := new.provider_id is distinct from old.provider_id;
    end if;
  end if;

  if v_assignment_changed and not exists (
       select 1
       from public.providers provider
       where provider.id = new.provider_id
         and provider.vetting_status = 'approved'
         and provider.dbs_verified
         and not coalesce(provider.is_suspended, false)
     ) then
    raise exception 'Only an approved professional with a verified DBS may be assigned'
      using errcode = 'check_violation';
  end if;
  return new;
end
$fn$;

drop trigger if exists enforce_verified_dbs_booking_assignment
  on public.bookings;
create trigger enforce_verified_dbs_booking_assignment
before insert or update of provider_id
on public.bookings
for each row execute function public.enforce_verified_dbs_booking_assignment();

revoke all on function public.sync_provider_dbs_verification()
  from public, anon, authenticated;
revoke all on function public.enforce_dbs_before_provider_approval()
  from public, anon, authenticated;
revoke all on function public.enforce_dbs_before_public_directory()
  from public, anon, authenticated;
revoke all on function public.enforce_verified_dbs_booking_assignment()
  from public, anon, authenticated;

commit;
