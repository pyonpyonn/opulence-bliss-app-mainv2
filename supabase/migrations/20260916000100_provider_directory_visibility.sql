-- Admin-controlled visibility for the public "Our professionals" directory.

alter table public.providers
  add column if not exists show_on_our_pros boolean not null default true;

comment on column public.providers.show_on_our_pros is
  'Whether an approved, active professional may appear on the public Our Pros page.';

create table if not exists public.provider_directory_events (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers(id) on delete restrict,
  visible boolean not null,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists provider_directory_events_provider_created_idx
  on public.provider_directory_events(provider_id, created_at desc);

alter table public.provider_directory_events enable row level security;
revoke all on public.provider_directory_events from public, anon, authenticated, service_role;
grant select on public.provider_directory_events to authenticated;

drop policy if exists "admins read provider directory history"
  on public.provider_directory_events;
create policy "admins read provider directory history"
on public.provider_directory_events for select to authenticated
using (public.is_admin());

create or replace function public.provider_directory_events_immutable()
returns trigger
language plpgsql
set search_path = public
as $fn$
begin
  raise exception 'provider directory events are immutable'
    using errcode = 'insufficient_privilege';
end
$fn$;

drop trigger if exists provider_directory_events_immutable
  on public.provider_directory_events;
create trigger provider_directory_events_immutable
before update or delete on public.provider_directory_events
for each row execute function public.provider_directory_events_immutable();

revoke all on function public.provider_directory_events_immutable()
  from public, anon, authenticated, service_role;

-- Even roles with a broad providers UPDATE grant cannot change this flag
-- directly. The SECURITY DEFINER RPC below runs as its database owner and is
-- the only application path permitted by this trigger.
create or replace function public.protect_provider_directory_visibility()
returns trigger
language plpgsql
set search_path = public
as $fn$
begin
  if new.show_on_our_pros is distinct from old.show_on_our_pros
     and current_user not in ('postgres', 'supabase_admin') then
    raise exception 'directory visibility must be changed through the admin function'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end
$fn$;

drop trigger if exists protect_provider_directory_visibility on public.providers;
create trigger protect_provider_directory_visibility
before update of show_on_our_pros on public.providers
for each row execute function public.protect_provider_directory_visibility();

revoke all on function public.protect_provider_directory_visibility()
  from public, anon, authenticated, service_role;

create or replace function public.admin_set_provider_directory_visibility(
  p_provider_id uuid,
  p_visible boolean
) returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_actor uuid := auth.uid();
  v_previous boolean;
  v_status text;
  v_suspended boolean;
begin
  if v_actor is null or not public.is_admin() then
    raise exception 'admins only' using errcode = 'insufficient_privilege';
  end if;

  select show_on_our_pros, vetting_status::text, is_suspended
    into v_previous, v_status, v_suspended
    from public.providers
   where id = p_provider_id
   for update;

  if not found then
    raise exception 'provider not found' using errcode = 'no_data_found';
  end if;

  if v_previous is distinct from p_visible then
    update public.providers
       set show_on_our_pros = p_visible
     where id = p_provider_id;

    insert into public.provider_directory_events(provider_id, visible, actor_id)
    values (p_provider_id, p_visible, v_actor);
  end if;

  return jsonb_build_object(
    'provider_id', p_provider_id,
    'visible', p_visible,
    'eligible_now', p_visible and v_status = 'approved' and not v_suspended
  );
end
$fn$;

revoke all on function public.admin_set_provider_directory_visibility(uuid, boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.admin_set_provider_directory_visibility(uuid, boolean)
  to authenticated;

do $verify$
begin
  if not exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'providers'
       and column_name = 'show_on_our_pros'
  ) then
    raise exception 'provider directory visibility column was not created';
  end if;

  if not exists (
    select 1 from pg_trigger
     where tgrelid = 'public.providers'::regclass
       and tgname = 'protect_provider_directory_visibility'
       and not tgisinternal
  ) then
    raise exception 'provider directory visibility guard is missing';
  end if;
end
$verify$;

