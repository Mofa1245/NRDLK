-- Call transcript logging: dispute resolution, debugging, client trust, quality tuning.
-- Run in Supabase SQL editor or via Supabase CLI.

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

-- RLS: select policy added in 002_businesses (users see own business calls). Inserts from API use service_role (bypasses RLS).
alter table public.call_logs enable row level security;

comment on table public.call_logs is 'Call transcript and LLM output for dispute resolution and quality tuning';
