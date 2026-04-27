-- Usage metering: track usage_minutes, calls_count, billing_period (even if not billing yet).
-- Billing guardrail: ai_enabled can be set false when invoice unpaid or quota exceeded.

-- Usage per business per billing period
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

-- Optional: billing state for guardrail (invoice paid, quota not exceeded).
-- When invoice unpaid or usage over quota → set businesses.ai_enabled = false.
alter table public.businesses
  add column if not exists billing_status text default 'active',
  add column if not exists usage_quota_minutes integer,
  add column if not exists usage_quota_calls integer;

comment on column public.businesses.billing_status is 'active | unpaid | over_quota | suspended; when not active, ai_enabled should be false';
comment on column public.businesses.usage_quota_minutes is 'Optional cap per period; exceed → set ai_enabled false';
comment on column public.businesses.usage_quota_calls is 'Optional cap per period; exceed → set ai_enabled false';
