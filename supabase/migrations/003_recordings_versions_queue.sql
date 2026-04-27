-- Call recording URL (raw audio proof), prompt/model/config versioning, outbound retry queue.

-- call_logs: recording + version tracking
alter table public.call_logs
  add column if not exists recording_url text,
  add column if not exists prompt_version text,
  add column if not exists model_version text,
  add column if not exists config_version integer;

comment on column public.call_logs.recording_url is 'Twilio/Retell recording URL; transcript is not legal proof without raw audio';
comment on column public.call_logs.prompt_version is 'Prompt version at call time; for debugging when something breaks';
comment on column public.call_logs.model_version is 'Model version at call time';
comment on column public.call_logs.config_version is 'Business config_version at call time; prevents "AI used old menu" disputes';

-- Retention: delete or anonymize recordings after N days (run via cron or Supabase Edge).
-- Example: delete from call_logs where recording_url is not null and created_at < now() - interval '90 days';

-- businesses: config version (increment when hours/menu/etc change)
alter table public.businesses
  add column if not exists config_version integer not null default 1;

comment on column public.businesses.config_version is 'Incremented on dashboard save; attached to each call log';

-- Outbound queue: WhatsApp send fails → message not lost; retry every 5 min
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
