-- Private attachment storage, using the same booking membership as messages.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values('booking-attachments', 'booking-attachments', false, 10485760,
  array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict(id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create table public.booking_message_attachments(
  message_id bigint primary key references public.booking_messages(id),
  path text not null unique,
  name text not null check(length(name) between 1 and 160),
  mime_type text not null check(mime_type in ('image/jpeg','image/png','image/webp','application/pdf'))
);
alter table public.booking_message_attachments enable row level security;
revoke all on public.booking_message_attachments from public, anon, authenticated, service_role;
grant select on public.booking_message_attachments to authenticated;
create policy "participants read message attachments" on public.booking_message_attachments for select to authenticated using (
  exists(select 1 from public.booking_messages m where m.id = message_id)
);

create policy "participants read private booking files" on storage.objects for select to authenticated using (
  bucket_id = 'booking-attachments' and exists(
    select 1 from public.bookings b where b.id::text = (storage.foldername(name))[1]
    and (b.customer_id = auth.uid() or b.provider_id = public.current_provider_id() or public.is_admin())
  )
);
create policy "participants upload private booking files" on storage.objects for insert to authenticated with check (
  bucket_id = 'booking-attachments' and (storage.foldername(name))[2] = auth.uid()::text
  and exists(select 1 from public.bookings b where b.id::text = (storage.foldername(name))[1]
    and (b.customer_id = auth.uid() or b.provider_id = public.current_provider_id())
    and b.provider_id is not null and b.status::text <> 'cancelled' and b.scheduled_at >= now() - interval '7 days')
);
create or replace function public.booking_attachment_is_posted(p_path text)
returns boolean language sql stable security definer set search_path = public as $fn$
  select exists(select 1 from public.booking_message_attachments where path = p_path);
$fn$;
revoke all on function public.booking_attachment_is_posted(text) from public, anon;
grant execute on function public.booking_attachment_is_posted(text) to authenticated;

create policy "uploader removes unposted files" on storage.objects for delete to authenticated using (
  bucket_id = 'booking-attachments' and (storage.foldername(name))[2] = auth.uid()::text
  and not public.booking_attachment_is_posted(name)
);

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
  -- Existing RPC checks membership, booking state and thread expiry. Both rows
  -- commit together, so the real-time message event includes its attachment.
  v_result := public.send_booking_message(p_booking_id, p_body);
  insert into public.booking_message_attachments(message_id, path, name, mime_type)
  values((v_result->>'id')::bigint, p_path, left(coalesce(nullif(trim(p_name), ''), 'Attachment'), 160), v_meta->>'mimetype');
  return v_result;
end $fn$;
revoke all on function public.send_booking_attachment(uuid,text,text,text) from public, anon, service_role;
grant execute on function public.send_booking_attachment(uuid,text,text,text) to authenticated;
