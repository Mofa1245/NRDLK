-- Businesses table for dashboard: change hours, toggle AI, linked to auth.
create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  business_id text not null unique,
  name text not null,
  business_hours text not null default '',
  ai_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_businesses_business_id on public.businesses(business_id);

-- Junction must exist before policies on businesses that reference business_users.
create table if not exists public.business_users (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  unique(business_id, user_id)
);

create index if not exists idx_business_users_user_id on public.business_users(user_id);

alter table public.businesses enable row level security;
alter table public.business_users enable row level security;

-- Link call_logs to businesses; dashboard users see only their business.
create policy "Users can read own business"
  on public.businesses for select
  using (auth.uid() in (select user_id from public.business_users where business_id = businesses.id));

create policy "Users can update own business"
  on public.businesses for update
  using (auth.uid() in (select user_id from public.business_users where business_id = businesses.id));

create policy "Users can read own business_users"
  on public.business_users for select
  using (auth.uid() = user_id);

-- Service role can do everything for API usage.
create policy "Service role full access businesses"
  on public.businesses for all using (true) with check (true);

create policy "Service role full access business_users"
  on public.business_users for all using (true) with check (true);

-- RLS for call_logs: users see only call_logs for their business(es).
create policy "Users can read call_logs for their business"
  on public.call_logs for select
  using (
    business_id in (
      select b.business_id from public.businesses b
      join public.business_users bu on bu.business_id = b.id
      where bu.user_id = auth.uid()
    )
  );

comment on table public.businesses is 'Business settings for dashboard: hours, ai_enabled';
