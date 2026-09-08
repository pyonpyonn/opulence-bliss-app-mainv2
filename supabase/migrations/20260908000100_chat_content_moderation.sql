-- Keep abusive or hateful language out of booking chats while preserving a
-- small, admin-only evidence trail for safety review.

begin;

create table if not exists public.chat_moderation_flags (
  id             bigint generated always as identity primary key,
  booking_id     uuid not null references public.bookings(id) on delete restrict,
  sender_id      uuid not null references public.profiles(id) on delete restrict,
  sender_role    text not null check (sender_role in ('customer', 'provider', 'admin')),
  attempted_text text not null check (length(trim(attempted_text)) between 1 and 2000),
  category       text not null check (category in ('hate_speech', 'threat', 'targeted_abuse')),
  severity       text not null check (severity in ('high', 'critical')),
  matched_rule   text not null,
  status         text not null default 'pending' check (status in ('pending', 'reviewed', 'dismissed')),
  reviewed_by    uuid references public.profiles(id) on delete restrict,
  reviewed_at    timestamptz,
  created_at     timestamptz not null default now()
);

create index if not exists chat_moderation_flags_queue_idx
  on public.chat_moderation_flags(status, created_at desc);
create index if not exists chat_moderation_flags_sender_idx
  on public.chat_moderation_flags(sender_id, created_at desc);

alter table public.chat_moderation_flags enable row level security;
revoke all on public.chat_moderation_flags from public, anon, authenticated, service_role;
grant select on public.chat_moderation_flags to authenticated;

drop policy if exists "admins read chat moderation flags" on public.chat_moderation_flags;
create policy "admins read chat moderation flags"
  on public.chat_moderation_flags for select to authenticated
  using (public.is_admin());

-- Returns NULL for acceptable text, or a compact category/rule payload for
-- content that should be blocked. The normalization catches common spacing and
-- number substitutions without treating ordinary profanity as a safety case.
create or replace function public.classify_chat_message(p_body text)
returns jsonb
language plpgsql immutable
set search_path = public
as $fn$
declare
  v_text text := lower(coalesce(p_body, ''));
  v_compact text;
begin
  v_text := replace(v_text, '0', 'o');
  v_text := replace(v_text, '1', 'i');
  v_text := replace(v_text, '3', 'e');
  v_text := replace(v_text, '4', 'a');
  v_text := replace(v_text, '5', 's');
  v_text := replace(v_text, '7', 't');
  v_text := replace(v_text, '@', 'a');
  v_text := replace(v_text, '$', 's');
  v_text := regexp_replace(v_text, '[^a-z]+', ' ', 'g');
  v_text := trim(regexp_replace(v_text, '\s+', ' ', 'g'));
  v_compact := replace(v_text, ' ', '');

  if v_text ~ ('(^| )(nigg(er|a)s?|kikes?|chinks?|spics?|wetbacks?|ragheads?|pakis?'
               || '|faggots?|trann(y|ies)|coons?)( |$)')
     or v_text ~ ('(^| )(kill|gas|lynch|exterminate|hate) (all )?'
                  || '(black|white|asian|jewish|muslim|christian|hindu|gay|lesbian|trans) (people|men|women|persons)( |$)')
     or v_text ~ '(^| )go back to (your|the) country( |$)'
     or v_text ~ ('(^| )(n +i +g +g +(e +r|a)|f +a +g +g +o +t'
                    || '|k +i +k +e|p +a +k +i|c +h +i +n +k)( |$)') then
    return jsonb_build_object('category', 'hate_speech', 'severity', 'critical', 'rule', 'identity_attack');
  end if;

  if v_text ~ ('(^| )(i will|i ll|im going to|i am going to|we will|we ll) '
                || '(kill|hurt|attack|beat|stab|shoot) (you|u)( |$)')
     or v_text ~ '(^| )(hope you die|watch your back|you are dead)( |$)'
     or v_compact ~ '(iwill|ill|imgoingto)(kill|hurt|attack|beat|stab|shoot)(you|u)' then
    return jsonb_build_object('category', 'threat', 'severity', 'critical', 'rule', 'credible_threat');
  end if;

  if v_text ~ ('(^| )(fuck you|fuck off|piece of shit|dumb bitch|stupid bitch'
               || '|you are (an? )?(idiot|moron|retard|stupid|useless|pathetic)'
               || '|you re (an? )?(idiot|moron|retard|stupid|useless|pathetic)'
               || '|cunts?|whores?)( |$)')
     or v_compact ~ '(f+u+c+k+(you|u|off)|pieceofshit|dumbbitch|stupidbitch)' then
    return jsonb_build_object('category', 'targeted_abuse', 'severity', 'high', 'rule', 'direct_abuse');
  end if;

  return null;
end
$fn$;

revoke all on function public.classify_chat_message(text) from public, anon, authenticated;

-- Sending remains function-only. A blocked attempt is recorded and returned as
-- a normal result so the evidence is committed instead of rolled back by an
-- exception.
create or replace function public.send_booking_message(
  p_booking_id uuid,
  p_body       text
) returns jsonb
language plpgsql security definer set search_path = public as $fn$
declare
  v_uid        uuid := auth.uid();
  v_role       text;
  v_kind       text;
  v_booking    bookings;
  v_provider   uuid;
  v_other      uuid;
  v_name       text;
  v_service    text;
  v_id         bigint;
  v_flag_id    bigint;
  v_moderation jsonb;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = 'insufficient_privilege';
  end if;
  if coalesce(trim(p_body), '') = '' then
    raise exception 'the message is empty' using errcode = 'check_violation';
  end if;
  if length(trim(p_body)) > 2000 then
    raise exception 'that message is too long' using errcode = 'check_violation';
  end if;

  select role into v_role from public.profiles where id = v_uid;
  select * into v_booking from public.bookings where id = p_booking_id;

  if not found then
    raise exception 'booking not found' using errcode = 'no_data_found';
  end if;

  select id into v_provider from public.providers where profile_id = v_uid;

  if v_booking.customer_id = v_uid then
    v_kind := 'customer';
  elsif v_provider is not null and v_booking.provider_id = v_provider then
    v_kind := 'provider';
  elsif v_role = 'admin' then
    v_kind := 'admin';
  else
    raise exception 'you are not on this booking'
      using errcode = 'insufficient_privilege';
  end if;

  if v_kind <> 'admin' then
    if v_booking.provider_id is null then
      raise exception 'you can message once a provider has accepted the booking'
        using errcode = 'check_violation';
    end if;
    if v_booking.status::text = 'cancelled'
       or v_booking.scheduled_at < now() - interval '7 days' then
      raise exception 'this booking is closed — contact support instead'
        using errcode = 'check_violation';
    end if;
  end if;

  v_moderation := public.classify_chat_message(p_body);
  if v_kind <> 'admin' and v_moderation is not null then
    -- Collapse repeated taps/retries into one queue item for five minutes.
    select id into v_flag_id
      from public.chat_moderation_flags
     where booking_id = p_booking_id
       and sender_id = v_uid
       and attempted_text = trim(p_body)
       and created_at > now() - interval '5 minutes'
     order by created_at desc
     limit 1;

    if v_flag_id is null then
      insert into public.chat_moderation_flags
        (booking_id, sender_id, sender_role, attempted_text, category, severity, matched_rule)
      values (
        p_booking_id,
        v_uid,
        v_kind,
        trim(p_body),
        v_moderation->>'category',
        v_moderation->>'severity',
        v_moderation->>'rule'
      ) returning id into v_flag_id;

      insert into public.notifications(user_id, title, body, href)
      select p.id,
             'Chat safety flag',
             format('A %s message was blocked and needs review.', replace(v_moderation->>'category', '_', ' ')),
             '/admin/chat-flags'
        from public.profiles p
       where p.role = 'admin';
    end if;

    return jsonb_build_object(
      'ok', false,
      'blocked', true,
      'flag_id', v_flag_id,
      'category', v_moderation->>'category'
    );
  end if;

  insert into public.booking_messages
    (booking_id, sender_id, sender_role, body)
  values (p_booking_id, v_uid, v_kind, trim(p_body))
  returning id into v_id;

  select pk.name into v_service
  from public.packages pk where pk.id = v_booking.package_id;

  if v_kind = 'customer' then
    select pr.profile_id, coalesce(pr.display_name, 'Your provider')
      into v_other, v_name
    from public.providers pr where pr.id = v_booking.provider_id;
  else
    v_other := v_booking.customer_id;
    select coalesce(pr.display_name, 'Your provider') into v_name
    from public.providers pr where pr.id = v_booking.provider_id;
  end if;

  if v_other is not null then
    insert into public.notifications (user_id, title, body, href)
    values (
      v_other,
      case v_kind
        when 'customer' then 'Message from your customer'
        when 'admin'    then 'Message from Opulence Bliss'
        else format('Message from %s', v_name)
      end,
      left(trim(p_body), 140),
      case
        when v_kind = 'customer' then format('/worker/job/%s', p_booking_id)
        else format('/account/visit/%s', p_booking_id)
      end
    );
  end if;

  return jsonb_build_object('ok', true, 'id', v_id, 'sender_role', v_kind);
end
$fn$;

revoke all on function public.send_booking_message(uuid, text) from public, anon;
grant execute on function public.send_booking_message(uuid, text) to authenticated;

create or replace function public.send_booking_attachment(p_booking_id uuid, p_body text, p_path text, p_name text)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare
  v_result jsonb;
  v_meta jsonb;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = 'insufficient_privilege'; end if;
  if p_path not like p_booking_id::text || '/' || auth.uid()::text || '/%' then
    raise exception 'Invalid attachment path.' using errcode = 'insufficient_privilege';
  end if;
  select metadata into v_meta from storage.objects where bucket_id = 'booking-attachments' and name = p_path for update;
  if not found or coalesce(v_meta->>'mimetype', '') not in ('image/jpeg','image/png','image/webp','application/pdf')
    or coalesce((v_meta->>'size')::bigint, 0) not between 1 and 10485760 then
    raise exception 'Choose a JPG, PNG, WebP or PDF up to 10 MB.';
  end if;
  -- File names are visible in the thread, so they follow the same policy as a
  -- typed message. Reusing the main function also repeats its membership and
  -- booking-state checks before a flag can be recorded.
  if public.classify_chat_message(p_name) is not null then
    return public.send_booking_message(p_booking_id, p_name);
  end if;
  v_result := public.send_booking_message(p_booking_id, p_body);
  if coalesce((v_result->>'blocked')::boolean, false) then
    return v_result;
  end if;
  insert into public.booking_message_attachments(message_id, path, name, mime_type)
  values((v_result->>'id')::bigint, p_path, left(coalesce(nullif(trim(p_name), ''), 'Attachment'), 160), v_meta->>'mimetype');
  return v_result;
end $fn$;
revoke all on function public.send_booking_attachment(uuid,text,text,text) from public, anon, service_role;
grant execute on function public.send_booking_attachment(uuid,text,text,text) to authenticated;

create or replace function public.review_chat_moderation_flag(
  p_flag_id bigint,
  p_status text
) returns jsonb
language plpgsql security definer set search_path = public as $fn$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not public.is_admin() then
    raise exception 'administrators only' using errcode = 'insufficient_privilege';
  end if;
  if p_status not in ('reviewed', 'dismissed') then
    raise exception 'invalid moderation status' using errcode = 'check_violation';
  end if;

  update public.chat_moderation_flags
     set status = p_status,
         reviewed_by = v_uid,
         reviewed_at = now()
   where id = p_flag_id;

  if not found then raise exception 'flag not found' using errcode = 'no_data_found'; end if;
  return jsonb_build_object('ok', true, 'id', p_flag_id, 'status', p_status);
end
$fn$;

revoke all on function public.review_chat_moderation_flag(bigint, text) from public, anon;
grant execute on function public.review_chat_moderation_flag(bigint, text) to authenticated;

commit;
