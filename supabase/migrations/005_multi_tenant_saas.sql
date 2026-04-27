alter table public.businesses
  add column if not exists phone_number text unique,
  add column if not exists whatsapp_number text,
  add column if not exists plan text not null default 'basic',
  add column if not exists status text not null default 'active',
  add column if not exists monthly_limit_minutes int not null default 1000,
  add column if not exists usage_minutes int not null default 0;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  role text not null default 'client',
  business_id uuid references public.businesses(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.calls (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  from_number text,
  transcript text,
  duration int not null default 0,
  outcome text not null default 'success',
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  from_number text,
  message text not null,
  direction text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.usage_logs (
  id uuid primary key default gen_random_uuid(),
  business_id text not null,
  minutes_used int not null default 0,
  mode text not null default 'fallback',
  created_at timestamptz not null default now()
);

create index if not exists idx_calls_business_id on public.calls(business_id);
create index if not exists idx_messages_business_id on public.messages(business_id);
create index if not exists idx_usage_logs_business_id on public.usage_logs(business_id);
