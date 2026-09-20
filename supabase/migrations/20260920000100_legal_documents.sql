-- Editable legal documents for the public website. Only administrators may
-- write them; every replacement keeps the previous published wording.

begin;

create table if not exists public.legal_documents (
  slug text primary key check (
    slug in ('terms', 'privacy', 'professional-partner-agreement')
  ),
  title text not null check (char_length(title) between 3 and 120),
  audience text not null check (audience in ('customers', 'professionals', 'everyone')),
  content_html text not null check (char_length(content_html) >= 80),
  version text not null check (version ~ '^\d{4}-\d{2}-\d{2}(\.\d+)?$'),
  published boolean not null default true,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.legal_document_revisions (
  id bigint generated always as identity primary key,
  document_slug text not null,
  title text not null,
  audience text not null,
  content_html text not null,
  version text not null,
  published boolean not null,
  changed_by uuid references public.profiles(id) on delete set null,
  changed_at timestamptz not null default now()
);

alter table public.legal_documents enable row level security;
alter table public.legal_document_revisions enable row level security;

revoke all on table public.legal_documents
  from public, anon, authenticated, service_role;
revoke all on table public.legal_document_revisions
  from public, anon, authenticated, service_role;

grant select on table public.legal_documents to anon, authenticated;
grant insert, update on table public.legal_documents to authenticated;
grant select on table public.legal_document_revisions to authenticated;
grant all on table public.legal_documents to service_role;
grant all on table public.legal_document_revisions to service_role;
grant usage, select on sequence public.legal_document_revisions_id_seq
  to service_role;

drop policy if exists "published legal documents are public" on public.legal_documents;
create policy "published legal documents are public"
on public.legal_documents
for select
to anon, authenticated
using (published or public.is_admin());

drop policy if exists "admins create legal documents" on public.legal_documents;
create policy "admins create legal documents"
on public.legal_documents
for insert
to authenticated
with check (public.is_admin() and updated_by = auth.uid());

drop policy if exists "admins update legal documents" on public.legal_documents;
create policy "admins update legal documents"
on public.legal_documents
for update
to authenticated
using (public.is_admin())
with check (public.is_admin() and updated_by = auth.uid());

drop policy if exists "admins read legal revisions" on public.legal_document_revisions;
create policy "admins read legal revisions"
on public.legal_document_revisions
for select
to authenticated
using (public.is_admin());

create or replace function public.archive_legal_document_revision()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  insert into public.legal_document_revisions (
    document_slug,
    title,
    audience,
    content_html,
    version,
    published,
    changed_by,
    changed_at
  ) values (
    old.slug,
    old.title,
    old.audience,
    old.content_html,
    old.version,
    old.published,
    new.updated_by,
    now()
  );
  return new;
end
$fn$;

drop trigger if exists archive_legal_document_revision on public.legal_documents;
create trigger archive_legal_document_revision
before update on public.legal_documents
for each row execute function public.archive_legal_document_revision();

create or replace function public.prevent_legal_revision_changes()
returns trigger
language plpgsql
set search_path = public
as $fn$
begin
  raise exception 'Legal document revisions are immutable';
end
$fn$;

drop trigger if exists legal_revisions_are_immutable on public.legal_document_revisions;
create trigger legal_revisions_are_immutable
before update or delete on public.legal_document_revisions
for each row execute function public.prevent_legal_revision_changes();

revoke all on function public.archive_legal_document_revision()
  from public, anon, authenticated;
revoke all on function public.prevent_legal_revision_changes()
  from public, anon, authenticated;

commit;
