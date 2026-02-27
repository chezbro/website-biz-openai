-- Website Biz OpenAI schema
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

create table if not exists public.website_biz_leads (
  id uuid primary key default gen_random_uuid(),
  source_file text not null,
  lead_key text not null,
  name text not null,
  industry text,
  city text,
  address text,
  phone text,
  email text,
  email_status text,
  website text,
  website_url text,
  rating numeric,
  reviews integer,
  enriched boolean not null default false,
  socials jsonb not null default '{}'::jsonb,
  raw jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(source_file, lead_key)
);
create index if not exists idx_website_biz_leads_source_file on public.website_biz_leads(source_file);

create table if not exists public.website_biz_websites (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  source_file text,
  business_name text,
  city text,
  industry text,
  file_path text,
  created_at timestamptz not null default now(),
  raw jsonb not null default '{}'::jsonb
);

create table if not exists public.website_biz_outreach (
  id text primary key,
  source_file text,
  email text,
  business_name text,
  template_id text,
  sent_at timestamptz,
  status text,
  error text,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_website_biz_outreach_email on public.website_biz_outreach(email);
