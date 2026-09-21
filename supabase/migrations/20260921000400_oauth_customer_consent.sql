-- OAuth users are created by Supabase before our callback can attach legal
-- metadata, so record their explicit website consent through a service-only
-- function. The evidence remains immutable once inserted.

create or replace function public.record_oauth_signup_consent(
  p_user_id uuid,
  p_legal_version text,
  p_accepted_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service role required' using errcode = 'insufficient_privilege';
  end if;
  if p_user_id is null or coalesce(trim(p_legal_version), '') = '' then
    raise exception 'Valid consent details are required' using errcode = 'check_violation';
  end if;

  insert into public.signup_consents(user_id, legal_version, accepted_at)
  values(p_user_id, trim(p_legal_version), coalesce(p_accepted_at, now()))
  on conflict (user_id) do nothing;
end;
$fn$;

revoke all on function public.record_oauth_signup_consent(uuid,text,timestamptz)
  from public, anon, authenticated;
grant execute on function public.record_oauth_signup_consent(uuid,text,timestamptz)
  to service_role;
