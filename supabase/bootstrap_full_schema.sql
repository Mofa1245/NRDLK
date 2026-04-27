-- One-shot bootstrap for an empty Supabase project (run in SQL Editor).
-- Creates public.businesses and related tables. Safe to re-run where "if not exists" applies;
-- policies may need manual drop if you re-run after partial failure.

-- ========== 001_call_logs ==========
create table if not exists public.call_logs (
  id uuid primary key default gen_random_uuid(),
  call_id text not null,
  business_id text not null,
  timestamp timestamptz not null default now(),
  transcript text,
  llm_output_json jsonb,
  confidence numeric(3,2) check (confidence >= 0 and confidence <= 1),
  flagged boolean not null default false,
  high_priority boolean not null default false,
  duration_seconds integer,
  caller_phone text,
  fallback_reason text,
  created_at timestamptz not null default now()
);

create index if not exists idx_call_logs_business_id on public.call_logs(business_id);
create index if not exists idx_call_logs_timestamp on public.call_logs(timestamp);
create index if not exists idx_call_logs_call_id on public.call_logs(call_id);

alter table public.call_logs enable row level security;

comment on table public.call_logs is 'Call transcript and LLM output for dispute resolution and quality tuning';

-- ========== 002_businesses (junction BEFORE policies that reference it) ==========
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

create table if not exists public.business_users (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  unique(business_id, user_id)
);

create index if not exists idx_business_users_user_id on public.business_users(user_id);

alter table public.businesses enable row level security;
alter table public.business_users enable row level security;

drop policy if exists "Users can read own business" on public.businesses;
drop policy if exists "Users can update own business" on public.businesses;
drop policy if exists "Users can read own business_users" on public.business_users;
drop policy if exists "Service role full access businesses" on public.businesses;
drop policy if exists "Service role full access business_users" on public.business_users;
drop policy if exists "Users can read call_logs for their business" on public.call_logs;

create policy "Users can read own business"
  on public.businesses for select
  using (auth.uid() in (select user_id from public.business_users where business_id = businesses.id));

create policy "Users can update own business"
  on public.businesses for update
  using (auth.uid() in (select user_id from public.business_users where business_id = businesses.id));

create policy "Users can read own business_users"
  on public.business_users for select
  using (auth.uid() = user_id);

create policy "Service role full access businesses"
  on public.businesses for all using (true) with check (true);

create policy "Service role full access business_users"
  on public.business_users for all using (true) with check (true);

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

-- ========== 003_recordings_versions_queue ==========
alter table public.call_logs
  add column if not exists recording_url text,
  add column if not exists prompt_version text,
  add column if not exists model_version text,
  add column if not exists config_version integer;

comment on column public.call_logs.recording_url is 'Twilio/Retell recording URL; transcript is not legal proof without raw audio';
comment on column public.call_logs.prompt_version is 'Prompt version at call time; for debugging when something breaks';
comment on column public.call_logs.model_version is 'Model version at call time';
comment on column public.call_logs.config_version is 'Business config_version at call time; prevents "AI used old menu" disputes';

alter table public.businesses
  add column if not exists config_version integer not null default 1;

comment on column public.businesses.config_version is 'Incremented on dashboard save; attached to each call log';

create table if not exists public.outbound_queue (
  id uuid primary key default gen_random_uuid(),
  business_id text not null,
  to_phone text not null,
  message text not null,
  payload_json jsonb,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  retry_count integer not null default 0,
  max_retries integer not null default 10,
  last_error text,
  created_at timestamptz not null default now(),
  next_retry_at timestamptz,
  sent_at timestamptz
);

create index if not exists idx_outbound_queue_status on public.outbound_queue(status);
create index if not exists idx_outbound_queue_next_retry on public.outbound_queue(next_retry_at) where status = 'pending';

alter table public.outbound_queue enable row level security;

comment on table public.outbound_queue is 'Failed WhatsApp sends; retry every 5 minutes (standard SaaS messaging)';

-- ========== 004_usage_metering_billing ==========
create table if not exists public.usage_metering (
  id uuid primary key default gen_random_uuid(),
  business_id text not null,
  billing_period text not null,
  period_start date not null,
  period_end date not null,
  usage_minutes numeric(12,2) not null default 0,
  calls_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(business_id, billing_period)
);

create index if not exists idx_usage_metering_business_id on public.usage_metering(business_id);
create index if not exists idx_usage_metering_period on public.usage_metering(period_start, period_end);

comment on table public.usage_metering is 'Usage minutes and call count per billing period; track now for future billing';

alter table public.businesses
  add column if not exists billing_status text default 'active',
  add column if not exists usage_quota_minutes integer,
  add column if not exists usage_quota_calls integer;

comment on column public.businesses.billing_status is 'active | unpaid | over_quota | suspended; when not active, ai_enabled should be false';
comment on column public.businesses.usage_quota_minutes is 'Optional cap per period; exceed → set ai_enabled false';
comment on column public.businesses.usage_quota_calls is 'Optional cap per period; exceed → set ai_enabled false';

-- ========== 005_multi_tenant_saas ==========
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
