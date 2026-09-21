-- Live handyman quotation requests and admin-managed prototype testimonials.

create extension if not exists pgcrypto;

create table if not exists public.handyman_quote_requests (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default (
    'HQ-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
  ),
  customer_id uuid references auth.users(id) on delete set null,
  full_name text not null,
  email text not null,
  phone text not null,
  address text not null,
  postcode text not null,
  task_type text not null,
  description text not null,
  preferred_date date,
  preferred_time text,
  status text not null default 'new'
    check (status in ('new', 'reviewing', 'quoted', 'accepted', 'declined', 'closed')),
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.handyman_quote_requests enable row level security;

drop policy if exists "admins manage handyman quotes" on public.handyman_quote_requests;
create policy "admins manage handyman quotes"
on public.handyman_quote_requests
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "customers read own handyman quotes" on public.handyman_quote_requests;
create policy "customers read own handyman quotes"
on public.handyman_quote_requests
for select to authenticated
using (customer_id = auth.uid() or public.is_admin());

grant select, update, delete on public.handyman_quote_requests to authenticated;

create index if not exists handyman_quote_requests_status_created_idx
  on public.handyman_quote_requests(status, created_at desc);
create index if not exists handyman_quote_requests_customer_idx
  on public.handyman_quote_requests(customer_id, created_at desc)
  where customer_id is not null;

create table if not exists public.marketing_reviews (
  id uuid primary key default gen_random_uuid(),
  service_type text not null default 'cleaning'
    check (service_type in ('cleaning', 'handyman')),
  rating smallint not null check (rating between 1 and 5),
  service_label text not null,
  comment text not null,
  customer_name text not null,
  location text,
  reviewed_at date not null default current_date,
  published boolean not null default true,
  is_demo boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.marketing_reviews enable row level security;

drop policy if exists "public reads published marketing reviews" on public.marketing_reviews;
create policy "public reads published marketing reviews"
on public.marketing_reviews
for select to public
using (published);

drop policy if exists "admins manage marketing reviews" on public.marketing_reviews;
create policy "admins manage marketing reviews"
on public.marketing_reviews
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

grant select on public.marketing_reviews to anon, authenticated;
grant insert, update, delete on public.marketing_reviews to authenticated;

create index if not exists marketing_reviews_public_idx
  on public.marketing_reviews(service_type, published, sort_order, reviewed_at desc);

comment on table public.marketing_reviews is
  'Admin-curated public testimonials. Prototype/demo entries must keep is_demo=true so the public UI labels them.';
