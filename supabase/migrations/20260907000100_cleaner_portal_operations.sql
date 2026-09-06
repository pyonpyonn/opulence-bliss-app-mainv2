-- Cleaner portal operations: suspension, provider reminders, invoices and payout cadence.

alter table public.providers
  add column if not exists is_suspended boolean not null default false,
  add column if not exists suspended_at timestamptz,
  add column if not exists suspension_reason text,
  add column if not exists suspended_by uuid references public.profiles(id),
  add column if not exists payout_schedule text not null default 'weekly',
  add column if not exists payout_schedule_updated_at timestamptz,
  add column if not exists payout_anchor_date date not null default current_date,
  add column if not exists next_payout_at timestamptz;

do $constraints$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.providers'::regclass
      and conname = 'providers_payout_schedule_check'
  ) then
    alter table public.providers add constraint providers_payout_schedule_check
      check (payout_schedule in ('weekly', 'fortnightly', 'monthly'));
  end if;
end
$constraints$;

create table if not exists public.provider_suspension_events (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers(id) on delete cascade,
  suspended boolean not null,
  reason text,
  actor_id uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.provider_suspension_events enable row level security;
revoke all on public.provider_suspension_events from public, anon, authenticated;
grant select on public.provider_suspension_events to authenticated;

drop policy if exists "admins read provider suspension history" on public.provider_suspension_events;
create policy "admins read provider suspension history"
on public.provider_suspension_events for select to authenticated
using (public.is_admin());

create or replace function public.admin_set_provider_suspension(
  p_provider_id uuid,
  p_suspended boolean,
  p_reason text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_actor uuid := auth.uid();
  v_profile uuid;
  v_affected uuid[];
begin
  if v_actor is null or not public.is_admin() then
    raise exception 'admins only' using errcode = 'insufficient_privilege';
  end if;
  if p_suspended and coalesce(trim(p_reason), '') = '' then
    raise exception 'a suspension reason is required' using errcode = 'check_violation';
  end if;

  select profile_id into v_profile from public.providers where id = p_provider_id for update;
  if not found then raise exception 'provider not found' using errcode = 'no_data_found'; end if;

  select coalesce(array_agg(booking_id), '{}'::uuid[]) into v_affected
  from public.booking_offers
  where provider_id = p_provider_id and status = 'open';

  update public.providers set
    is_suspended = p_suspended,
    suspended_at = case when p_suspended then now() else null end,
    suspension_reason = case when p_suspended then trim(p_reason) else null end,
    suspended_by = case when p_suspended then v_actor else null end
  where id = p_provider_id;

  if p_suspended then
    update public.booking_offers set status = 'declined'
    where provider_id = p_provider_id and status = 'open';

    update public.booking_offer_queue
       set outcome = 'declined', finished_at = coalesce(finished_at, now())
     where provider_id = p_provider_id and outcome in ('waiting', 'offered');
  end if;

  insert into public.provider_suspension_events(provider_id, suspended, reason, actor_id)
  values(p_provider_id, p_suspended, nullif(trim(coalesce(p_reason, '')), ''), v_actor);

  insert into public.notifications(user_id, title, body, href)
  values(
    v_profile,
    case when p_suspended then 'Your provider account is suspended' else 'Your provider account is active again' end,
    case when p_suspended
      then 'You cannot accept new jobs while the team reviews your account. Reason: ' || trim(p_reason)
      else 'Your suspension has been removed and you can receive new job offers again.' end,
    '/worker'
  );

  return jsonb_build_object('provider_id', p_provider_id, 'suspended', p_suspended,
    'affected_booking_ids', to_jsonb(v_affected));
end
$fn$;

revoke all on function public.admin_set_provider_suspension(uuid, boolean, text) from public, anon;
grant execute on function public.admin_set_provider_suspension(uuid, boolean, text) to authenticated;

create or replace function public.prevent_suspended_provider_work()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if new.provider_id is not null
     and new.status::text in ('scheduled', 'in_progress')
     and (new.provider_id is distinct from old.provider_id or new.status is distinct from old.status)
     and exists (select 1 from public.providers p where p.id = new.provider_id and p.is_suspended) then
    raise exception 'this provider account is suspended' using errcode = 'insufficient_privilege';
  end if;
  return new;
end
$fn$;

drop trigger if exists prevent_suspended_provider_work on public.bookings;
create trigger prevent_suspended_provider_work
before update of provider_id, status on public.bookings
for each row execute function public.prevent_suspended_provider_work();
revoke all on function public.prevent_suspended_provider_work() from public, anon, authenticated, service_role;

create or replace function public.provider_offer_details(p_booking_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_provider uuid := public.current_provider_id();
  v_booking public.bookings;
  v_customer_name text;
  v_service text;
  v_payout numeric(12,2);
begin
  if v_provider is null or not exists (
    select 1 from public.booking_offers offer
    where offer.booking_id = p_booking_id
      and offer.provider_id = v_provider
      and offer.status = 'open'
  ) then
    raise exception 'this offer is not available to this provider'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id;
  select coalesce(full_name, email, 'Customer') into v_customer_name
    from public.profiles where id = v_booking.customer_id;
  select name into v_service from public.packages where id = v_booking.package_id;
  select nullif(split_breakdown->>'provider','')::numeric into v_payout
    from public.payments
   where booking_id = p_booking_id and coalesce(kind, 'visit') <> 'tip'
   order by created_at limit 1;

  return jsonb_build_object(
    'customer_name', coalesce(v_customer_name, v_booking.customer_email, 'Customer'),
    'address', v_booking.address,
    'property_size_sqm', v_booking.property_size_sqm,
    'service_name', coalesce(v_service, 'Service'),
    'scheduled_at', v_booking.scheduled_at,
    'special_instructions', v_booking.household_notes,
    'duration_minutes', coalesce(v_booking.duration_minutes, 120),
    'payout_amount', coalesce(v_booking.provider_payout, v_payout, 0)
  );
end
$fn$;

revoke all on function public.provider_offer_details(uuid) from public, anon;
grant execute on function public.provider_offer_details(uuid) to authenticated;

-- The existing function retains its public signature, but now queues the same
-- timely notices for the assigned provider as well as the customer.
create or replace function public.queue_booking_notice(
  p_booking_id uuid, p_kind text, p_key text, p_due timestamptz, p_expires timestamptz
) returns void language plpgsql security definer set search_path = public as $fn$
declare
  v_booking public.bookings;
  v_service text;
  v_recipient record;
  v_title text;
  v_body text;
  v_id uuid;
  v_channel text;
begin
  select * into v_booking from public.bookings where id = p_booking_id;
  if not found or v_booking.customer_id is null then return; end if;
  select name into v_service from public.packages where id = v_booking.package_id;

  for v_recipient in
    select v_booking.customer_id as user_id, 'customer'::text as audience, '/account/visit/' || p_booking_id as href
    union all
    select p.profile_id, 'provider'::text, '/worker/job/' || p_booking_id
      from public.providers p
     where p.id = v_booking.provider_id
       and p_kind in ('confirmed', 'reminder_24h', 'reminder_90m', 'remaining_30m')
  loop
    v_title := case
      when v_recipient.audience = 'provider' and p_kind = 'confirmed' then 'Job confirmed'
      when v_recipient.audience = 'provider' and p_kind = 'reminder_24h' then 'Your job is in 24 hours'
      when v_recipient.audience = 'provider' and p_kind = 'reminder_90m' then 'Your job is in 1 hour 30 minutes'
      when p_kind = 'received' then 'Booking received'
      when p_kind = 'confirmed' then 'Booking confirmed'
      when p_kind = 'reminder_24h' then 'Your booking is in 24 hours'
      when p_kind = 'reminder_90m' then 'Your booking is in 1 hour 30 minutes'
      else '30 minutes remaining'
    end;
    v_body := case
      when v_recipient.audience = 'provider' and p_kind = 'confirmed' then 'You accepted this job. '
      when v_recipient.audience = 'provider' and p_kind = 'remaining_30m' then 'Your active job has 30 minutes remaining. '
      when v_recipient.audience = 'provider' then 'A reminder for your confirmed job. '
      when p_kind = 'received' then 'We have received your booking and are finding your cleaner or professional. '
      when p_kind = 'confirmed' then 'Your professional has accepted your booking. '
      when p_kind = 'remaining_30m' then 'Your session has 30 minutes remaining from the checked-in start time. '
      else 'A reminder for your confirmed booking. '
    end || coalesce(v_service, 'Service') || ' on ' ||
      to_char(v_booking.scheduled_at at time zone 'Europe/London', 'Dy DD Mon YYYY, HH12:MI AM') ||
      ' (London time), ' || coalesce(v_booking.duration_minutes::text, '120') ||
      ' minutes. This is an automated notification; use your booking chat for replies.';

    foreach v_channel in array array['in_app','email'] loop
      v_id := null;
      insert into public.booking_notification_deliveries
        (booking_id,user_id,event_key,kind,channel,title,body,href,due_at,expires_at)
      values(p_booking_id,v_recipient.user_id,p_key,p_kind,v_channel,v_title,v_body,v_recipient.href,p_due,p_expires)
      on conflict(booking_id,user_id,event_key,channel) do update
        set status = 'pending', due_at = excluded.due_at, expires_at = excluded.expires_at,
            title = excluded.title, body = excluded.body, href = excluded.href, claim_token = null
        where booking_notification_deliveries.status = 'cancelled'
          and booking_notification_deliveries.sent_at is null
      returning id into v_id;
      if v_id is not null and v_channel = 'in_app' and p_due <= now() then
        insert into public.notifications(user_id,title,body,href)
        values(v_recipient.user_id,v_title,v_body,v_recipient.href);
        update public.booking_notification_deliveries set status = 'sent', sent_at = now() where id = v_id;
      end if;
    end loop;
  end loop;
end
$fn$;
revoke all on function public.queue_booking_notice(uuid,text,text,timestamptz,timestamptz) from public, anon, authenticated, service_role;

create or replace function public.schedule_session_notice()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare v_minutes integer; v_end timestamptz; v_scheduled timestamptz;
begin
  if new.arrived_at is not null then
    if tg_op = 'UPDATE' and old.arrived_at is not distinct from new.arrived_at then return new; end if;
    select coalesce(b.duration_minutes,p.duration_minutes,120), b.scheduled_at
      into v_minutes, v_scheduled
      from public.bookings b
      left join public.packages p on p.id = b.package_id
     where b.id = new.booking_id;
    v_end := v_scheduled + make_interval(mins => v_minutes);
    if v_end > now() then
      perform public.queue_booking_notice(new.booking_id,'remaining_30m','30m:' || new.arrived_at::text,
        greatest(now(), v_end - interval '30 minutes'),v_end);
    end if;
  end if;
  return new;
end
$fn$;
revoke all on function public.schedule_session_notice() from public, anon, authenticated, service_role;

-- Backfill provider reminders for confirmed and active jobs that already exist.
do $backfill_provider_notices$
declare
  v_booking record;
  v_key text;
  v_end timestamptz;
begin
  for v_booking in
    select id, scheduled_at, provider_id
      from public.bookings
     where status::text = 'scheduled' and provider_id is not null and scheduled_at > now()
  loop
    v_key := v_booking.scheduled_at::text || ':' || v_booking.provider_id::text;
    perform public.queue_booking_notice(v_booking.id, 'confirmed', 'confirmed:' || v_key, now(), v_booking.scheduled_at);
    if v_booking.scheduled_at - interval '24 hours' > now() then
      perform public.queue_booking_notice(v_booking.id, 'reminder_24h', '24h:' || v_key,
        v_booking.scheduled_at - interval '24 hours', v_booking.scheduled_at - interval '90 minutes');
    end if;
    if v_booking.scheduled_at - interval '90 minutes' > now() then
      perform public.queue_booking_notice(v_booking.id, 'reminder_90m', '90m:' || v_key,
        v_booking.scheduled_at - interval '90 minutes', v_booking.scheduled_at);
    end if;
  end loop;

  for v_booking in
    select b.id, b.scheduled_at, ci.arrived_at, coalesce(b.duration_minutes, package.duration_minutes, 120) as minutes
      from public.bookings b
      join public.check_ins ci on ci.booking_id = b.id and ci.arrived_at is not null and ci.left_at is null
      left join public.packages package on package.id = b.package_id
     where b.status::text = 'in_progress' and b.provider_id is not null
  loop
    v_end := v_booking.scheduled_at + make_interval(mins => v_booking.minutes);
    if v_end > now() then
      perform public.queue_booking_notice(v_booking.id, 'remaining_30m', '30m:' || v_booking.arrived_at::text,
        greatest(now(), v_end - interval '30 minutes'), v_end);
    end if;
  end loop;
end
$backfill_provider_notices$;

create or replace function public.provider_invoice_due_date(
  p_completed_at timestamptz, p_schedule text, p_anchor date
) returns date language sql stable set search_path = public as $fn$
  select case p_schedule
    when 'monthly' then (date_trunc('month', p_completed_at) + interval '1 month')::date
    when 'fortnightly' then case
      when p_completed_at::date < p_anchor then p_anchor
      else p_anchor + (((p_completed_at::date - p_anchor) / 14) + 1) * 14
    end
    else (date_trunc('week', p_completed_at) + interval '1 week')::date
  end
$fn$;
revoke all on function public.provider_invoice_due_date(timestamptz,text,date) from public, anon, authenticated, service_role;

create table if not exists public.provider_job_invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  booking_id uuid not null unique references public.bookings(id) on delete restrict,
  provider_id uuid not null references public.providers(id) on delete restrict,
  issued_at timestamptz not null default now(),
  completed_at timestamptz not null,
  payout_due_on date not null,
  payout_schedule text not null check (payout_schedule in ('weekly','fortnightly','monthly')),
  customer_name text not null,
  service_name text not null,
  address text,
  property_size_sqm numeric(10,2),
  duration_minutes integer not null,
  gross_amount numeric(12,2),
  platform_fee numeric(12,2),
  payout_amount numeric(12,2) not null,
  currency text not null default 'GBP',
  status text not null default 'issued' check(status in ('issued','void'))
);

alter table public.provider_job_invoices enable row level security;
revoke all on public.provider_job_invoices from public, anon, authenticated;
grant select on public.provider_job_invoices to authenticated;

drop policy if exists "providers read own job invoices" on public.provider_job_invoices;
create policy "providers read own job invoices" on public.provider_job_invoices
for select to authenticated using (provider_id = public.current_provider_id() or public.is_admin());

create or replace function public.generate_provider_job_invoice()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare
  v_provider public.providers;
  v_service text;
  v_customer text;
  v_gross numeric(12,2);
  v_share numeric(12,2);
  v_fee numeric(12,2);
  v_minutes integer;
begin
  if new.status::text <> 'completed' or old.status::text = 'completed' or new.provider_id is null then return new; end if;
  select * into v_provider from public.providers where id = new.provider_id;
  select name, duration_minutes into v_service, v_minutes from public.packages where id = new.package_id;
  select coalesce(full_name, email, 'Customer') into v_customer from public.profiles where id = new.customer_id;
  select p.gross_amount,
         nullif(p.split_breakdown->>'provider','')::numeric,
         nullif(p.split_breakdown->>'platform_margin','')::numeric
    into v_gross, v_share, v_fee
    from public.payments p
   where p.booking_id = new.id and coalesce(p.kind, 'visit') <> 'tip'
   order by p.created_at limit 1;

  v_share := coalesce(new.provider_payout, v_share, 0);
  v_fee := coalesce(v_fee, greatest(coalesce(v_gross, v_share) - v_share, 0));
  v_minutes := coalesce(new.duration_minutes, v_minutes, 120);

  insert into public.provider_job_invoices(
    invoice_number, booking_id, provider_id, completed_at, payout_due_on, payout_schedule,
    customer_name, service_name, address, property_size_sqm, duration_minutes,
    gross_amount, platform_fee, payout_amount
  ) values(
    'OB-' || to_char(now() at time zone 'Europe/London','YYYYMM') || '-' || upper(left(new.id::text,8)),
    new.id, new.provider_id, now(),
    public.provider_invoice_due_date(now(), v_provider.payout_schedule, v_provider.payout_anchor_date),
    v_provider.payout_schedule, coalesce(v_customer, 'Customer'), coalesce(v_service, 'Service'),
    new.address, new.property_size_sqm, v_minutes, v_gross, v_fee, v_share
  ) on conflict (booking_id) do nothing;
  return new;
end
$fn$;

drop trigger if exists generate_provider_job_invoice on public.bookings;
create trigger generate_provider_job_invoice
after update of status on public.bookings
for each row execute function public.generate_provider_job_invoice();
revoke all on function public.generate_provider_job_invoice() from public, anon, authenticated, service_role;

-- Completed jobs that predate this migration receive the same invoice snapshot.
insert into public.provider_job_invoices(
  invoice_number, booking_id, provider_id, completed_at, payout_due_on, payout_schedule,
  customer_name, service_name, address, property_size_sqm, duration_minutes,
  gross_amount, platform_fee, payout_amount
)
select
  'OB-' || to_char(coalesce(events.completed_at, b.scheduled_at) at time zone 'Europe/London','YYYYMM') || '-' || upper(left(b.id::text,8)),
  b.id, b.provider_id, coalesce(events.completed_at, b.scheduled_at),
  public.provider_invoice_due_date(
    coalesce(events.completed_at, b.scheduled_at),
    coalesce(provider.payout_schedule, 'weekly'),
    coalesce(provider.payout_anchor_date, current_date)
  ),
  coalesce(provider.payout_schedule, 'weekly'),
  coalesce(customer.full_name, customer.email, b.customer_email, 'Customer'),
  coalesce(package.name, 'Service'), b.address, b.property_size_sqm,
  coalesce(b.duration_minutes, package.duration_minutes, 120),
  payment.gross_amount,
  coalesce(payment.platform_fee, greatest(coalesce(payment.gross_amount, coalesce(b.provider_payout, payment.provider_share, 0)) - coalesce(b.provider_payout, payment.provider_share, 0), 0)),
  coalesce(b.provider_payout, payment.provider_share, 0)
from public.bookings b
join public.providers provider on provider.id = b.provider_id
left join public.profiles customer on customer.id = b.customer_id
left join public.packages package on package.id = b.package_id
left join lateral (
  select p.gross_amount,
         nullif(p.split_breakdown->>'provider','')::numeric as provider_share,
         nullif(p.split_breakdown->>'platform_margin','')::numeric as platform_fee
    from public.payments p
   where p.booking_id = b.id and coalesce(p.kind, 'visit') <> 'tip'
   order by p.created_at limit 1
) payment on true
left join lateral (
  select max(e.created_at) as completed_at
    from public.booking_events e
   where e.booking_id = b.id and e.to_status = 'completed'
) events on true
where b.status::text = 'completed'
on conflict (booking_id) do nothing;

create table if not exists public.provider_payout_runs (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers(id) on delete restrict,
  scheduled_for timestamptz not null,
  amount numeric(12,2) not null default 0,
  currency text not null default 'GBP',
  stripe_payout_ref text,
  status text not null check(status in ('paid','empty','failed')),
  note text,
  created_at timestamptz not null default now(),
  unique(provider_id, scheduled_for)
);

alter table public.provider_payout_runs enable row level security;
revoke all on public.provider_payout_runs from public, anon, authenticated;
grant select on public.provider_payout_runs to authenticated;
grant select, insert, update on public.provider_payout_runs to service_role;
drop policy if exists "providers read own payout runs" on public.provider_payout_runs;
create policy "providers read own payout runs" on public.provider_payout_runs
for select to authenticated using (provider_id = public.current_provider_id() or public.is_admin());

create or replace function public.invoke_provider_operations_cron()
returns bigint language plpgsql security definer set search_path = public, vault, net as $fn$
declare v_secret text; v_origin text; v_id bigint;
begin
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'opulence_cron_secret' order by created_at desc limit 1;
  select decrypted_secret into v_origin from vault.decrypted_secrets where name = 'opulence_app_origin' order by created_at desc limit 1;
  if coalesce(v_secret,'') = '' or coalesce(v_origin,'') = '' then
    raise warning 'Provider operations require Vault secrets opulence_cron_secret and opulence_app_origin';
    return null;
  end if;
  select net.http_get(
    url := rtrim(v_origin,'/') || '/api/cron/provider-operations',
    headers := jsonb_build_object('Authorization','Bearer ' || v_secret),
    timeout_milliseconds := 55000
  ) into v_id;
  return v_id;
end
$fn$;
revoke all on function public.invoke_provider_operations_cron() from public, anon, authenticated, service_role;

select cron.unschedule(jobid) from cron.job where jobname = 'opulence-provider-operations';
select cron.schedule(
  'opulence-provider-operations',
  '*/5 * * * *',
  $$select public.invoke_provider_operations_cron();$$
);
