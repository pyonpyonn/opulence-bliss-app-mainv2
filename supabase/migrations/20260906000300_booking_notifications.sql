-- Durable delivery records: channel-specific retries cannot duplicate app alerts.
create table public.booking_notification_deliveries(
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id),
  user_id uuid not null references public.profiles(id),
  event_key text not null,
  kind text not null check(kind in ('received','confirmed','reminder_24h','reminder_90m','remaining_30m')),
  channel text not null check(channel in ('email','in_app')),
  title text not null,
  body text not null,
  href text not null,
  due_at timestamptz not null,
  expires_at timestamptz not null,
  status text not null default 'pending' check(status in ('pending','processing','sent','failed','cancelled')),
  attempts integer not null default 0,
  claimed_at timestamptz,
  claim_token uuid,
  sent_at timestamptz,
  last_error text,
  unique(booking_id, user_id, event_key, channel)
);
create index booking_notice_due on public.booking_notification_deliveries(due_at) where status in ('pending','processing');
alter table public.booking_notification_deliveries enable row level security;
revoke all on public.booking_notification_deliveries from public, anon, authenticated, service_role;

create or replace function public.queue_booking_notice(
  p_booking_id uuid, p_kind text, p_key text, p_due timestamptz, p_expires timestamptz
) returns void language plpgsql security definer set search_path = public as $fn$
declare
  v_booking public.bookings;
  v_service text;
  v_title text;
  v_body text;
  v_id uuid;
  v_channel text;
begin
  select * into v_booking from public.bookings where id = p_booking_id;
  if not found or v_booking.customer_id is null then return; end if;
  select name into v_service from public.packages where id = v_booking.package_id;
  v_title := case p_kind when 'received' then 'Booking received' when 'confirmed' then 'Booking confirmed'
    when 'reminder_24h' then 'Your booking is in 24 hours'
    when 'reminder_90m' then 'Your booking is in 1 hour 30 minutes'
    else '30 minutes remaining' end;
  v_body := case p_kind when 'received' then 'We have received your booking and are finding your cleaner or professional. '
    when 'confirmed' then 'Your professional has accepted your booking. '
    when 'remaining_30m' then 'Your session has 30 minutes remaining from the checked-in start time. '
    else 'A reminder for your confirmed booking. ' end ||
    coalesce(v_service, 'Service') || ' on ' ||
    to_char(v_booking.scheduled_at at time zone 'Europe/London', 'Dy DD Mon YYYY, HH12:MI AM') ||
    ' (London time), ' || coalesce(v_booking.duration_minutes::text, '120') || ' minutes. This is an automated notification; use your booking chat for replies.';
  foreach v_channel in array array['in_app','email'] loop
    v_id := null;
    insert into public.booking_notification_deliveries(booking_id,user_id,event_key,kind,channel,title,body,href,due_at,expires_at)
    values(p_booking_id,v_booking.customer_id,p_key,p_kind,v_channel,v_title,v_body,'/account/visit/' || p_booking_id,p_due,p_expires)
    on conflict(booking_id,user_id,event_key,channel) do update
      set status = 'pending', due_at = excluded.due_at, expires_at = excluded.expires_at, claim_token = null
      where booking_notification_deliveries.status = 'cancelled' and booking_notification_deliveries.sent_at is null
    returning id into v_id;
    if v_id is not null and v_channel = 'in_app' and p_due <= now() then
      insert into public.notifications(user_id,title,body,href) values(v_booking.customer_id,v_title,v_body,'/account/visit/' || p_booking_id);
      update public.booking_notification_deliveries set status = 'sent', sent_at = now() where id = v_id;
    end if;
  end loop;
end $fn$;
revoke all on function public.queue_booking_notice(uuid,text,text,timestamptz,timestamptz) from public, anon, authenticated, service_role;

create or replace function public.schedule_booking_notices()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare
  v_key text;
  v_time_changed boolean := false;
begin
  if tg_op = 'UPDATE' then
    v_time_changed := old.scheduled_at is distinct from new.scheduled_at or old.provider_id is distinct from new.provider_id;
    if v_time_changed or new.status::text in ('cancelled','completed','needs_review','declined') then
      update public.booking_notification_deliveries set status = 'cancelled', claim_token = null
      where booking_id = new.id and status in ('pending','processing') and
        (v_time_changed or kind in ('reminder_24h','reminder_90m','remaining_30m','confirmed','received'));
    end if;
  end if;
  if tg_op = 'INSERT' and new.status::text in ('offered','scheduled') then
    perform public.queue_booking_notice(new.id,'received','received',now(),greatest(new.scheduled_at,now() + interval '1 hour'));
  end if;
  if new.status::text = 'scheduled' and
    (tg_op = 'INSERT' or old.status::text is distinct from 'scheduled' or v_time_changed) then
    v_key := new.scheduled_at::text || ':' || coalesce(new.provider_id::text, '');
    perform public.queue_booking_notice(new.id,'confirmed','confirmed:' || v_key,now(),new.scheduled_at);
    if new.scheduled_at - interval '24 hours' > now() then
      perform public.queue_booking_notice(new.id,'reminder_24h','24h:' || v_key,new.scheduled_at - interval '24 hours',new.scheduled_at - interval '90 minutes');
    end if;
    if new.scheduled_at - interval '90 minutes' > now() then
      perform public.queue_booking_notice(new.id,'reminder_90m','90m:' || v_key,new.scheduled_at - interval '90 minutes',new.scheduled_at);
    end if;
  end if;
  return new;
end $fn$;
create trigger schedule_booking_notices after insert or update of status, scheduled_at, provider_id on public.bookings
for each row execute function public.schedule_booking_notices();
revoke all on function public.schedule_booking_notices() from public, anon, authenticated, service_role;

create or replace function public.schedule_session_notice()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare v_minutes integer; v_end timestamptz;
begin
  if new.arrived_at is not null then
    if tg_op = 'UPDATE' and old.arrived_at is not distinct from new.arrived_at then return new; end if;
    select coalesce(b.duration_minutes,p.duration_minutes,120) into v_minutes from public.bookings b
      left join public.packages p on p.id = b.package_id where b.id = new.booking_id;
    v_end := new.arrived_at + make_interval(mins => v_minutes);
    perform public.queue_booking_notice(new.booking_id,'remaining_30m','30m:' || new.arrived_at::text,v_end - interval '30 minutes',v_end);
  end if;
  return new;
end $fn$;
create trigger schedule_session_notice after insert or update of arrived_at on public.check_ins for each row execute function public.schedule_session_notice();
revoke all on function public.schedule_session_notice() from public, anon, authenticated, service_role;

-- Concurrent cron invocations claim disjoint rows. App notifications are inserted
-- and acknowledged in the same transaction; email uses a retry lease.
create or replace function public.claim_booking_emails(p_email_ready boolean default true)
returns table(id uuid, claim_token uuid, email text, title text, body text, href text)
language plpgsql security definer set search_path = public as $fn$
declare v_row public.booking_notification_deliveries;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'service role required'; end if;
  update public.booking_notification_deliveries d set status = 'cancelled', claim_token = null
    from public.bookings b where b.id = d.booking_id and d.status in ('pending','processing')
      and (d.expires_at <= now() or b.status::text in ('cancelled','completed','needs_review')
        or (d.kind in ('reminder_24h','reminder_90m') and b.status::text <> 'scheduled')
        or (d.kind = 'remaining_30m' and b.status::text <> 'in_progress'));
  for v_row in select d.* from public.booking_notification_deliveries d
    where d.channel = 'in_app' and d.status = 'pending' and d.due_at <= now()
    order by d.due_at limit 500 for update skip locked
  loop
    insert into public.notifications(user_id,title,body,href) values(v_row.user_id,v_row.title,v_row.body,v_row.href);
    update public.booking_notification_deliveries d set status = 'sent', sent_at = now() where d.id = v_row.id;
  end loop;
  if not p_email_ready then return; end if;
  update public.booking_notification_deliveries d set status = 'failed', last_error = 'Delivery lease expired after final attempt.'
    where d.status = 'processing' and d.attempts >= 8 and d.claimed_at < now() - interval '5 minutes';
  return query
    with candidates as (
      select d.id from public.booking_notification_deliveries d
      where d.channel = 'email' and d.due_at <= now() and d.attempts < 8 and
        (d.status = 'pending' or (d.status = 'processing' and d.claimed_at < now() - interval '5 minutes'))
      order by d.due_at limit 25 for update skip locked
    ), claimed as (
      update public.booking_notification_deliveries d
      set status = 'processing', claimed_at = now(), claim_token = gen_random_uuid(), attempts = d.attempts + 1
      from candidates c where c.id = d.id
      returning d.*
    )
    select c.id,c.claim_token,p.email,c.title,c.body,c.href from claimed c join public.profiles p on p.id = c.user_id;
end $fn$;
revoke all on function public.claim_booking_emails(boolean) from public, anon, authenticated;
grant execute on function public.claim_booking_emails(boolean) to service_role;

create or replace function public.finish_booking_email(p_id uuid,p_token uuid,p_ok boolean,p_error text default null)
returns void language plpgsql security definer set search_path = public as $fn$
begin
  if auth.role() is distinct from 'service_role' then raise exception 'service role required'; end if;
  update public.booking_notification_deliveries set
    status = case when p_ok then 'sent' when attempts >= 8 then 'failed' else 'pending' end,
    sent_at = case when p_ok then now() else null end,
    due_at = case when p_ok then due_at else now() + make_interval(mins => least(attempts * attempts,60)) end,
    last_error = left(p_error,500), claim_token = null
  where id = p_id and claim_token = p_token and status = 'processing';
end $fn$;
revoke all on function public.finish_booking_email(uuid,uuid,boolean,text) from public, anon, authenticated;
grant execute on function public.finish_booking_email(uuid,uuid,boolean,text) to service_role;

-- Only the scheduler can invoke this function. Reuse the existing secret, but
-- configure the app origin in Vault so this deployment need not use another app.
create or replace function public.invoke_booking_notification_cron()
returns bigint language plpgsql security definer set search_path = public, vault, net as $fn$
declare v_secret text; v_origin text; v_id bigint;
begin
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'opulence_cron_secret' order by created_at desc limit 1;
  select decrypted_secret into v_origin from vault.decrypted_secrets where name = 'opulence_app_origin' order by created_at desc limit 1;
  if coalesce(v_secret,'') = '' or coalesce(v_origin,'') = '' then
    raise warning 'Booking notifications require Vault secrets opulence_cron_secret and opulence_app_origin';
    return null;
  end if;
  select net.http_get(url := rtrim(v_origin,'/') || '/api/cron/booking-notifications',
    headers := jsonb_build_object('Authorization','Bearer ' || v_secret), timeout_milliseconds := 55000) into v_id;
  return v_id;
end $fn$;
revoke all on function public.invoke_booking_notification_cron() from public, anon, authenticated, service_role;
select cron.schedule('opulence-booking-notifications','* * * * *',$$select public.invoke_booking_notification_cron();$$);
