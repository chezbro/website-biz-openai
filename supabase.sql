-- Website Biz OpenAI minimal schema
create table if not exists public.website_biz_jobs (
  id text primary key,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  error text,
  result jsonb
);

create index if not exists idx_website_biz_jobs_status_created on public.website_biz_jobs(status, created_at desc);
