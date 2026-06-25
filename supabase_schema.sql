-- Run this in the Supabase SQL editor (Project > SQL Editor > New query)
-- This creates the three tables the CRM needs, plus permissive policies
-- since this is a single-user app with no login system.

create table if not exists leads (
  id bigint generated always as identity primary key,
  name text not null,
  temp text default 'WARM',
  location text,
  parcel_number text,
  land_insights_url text,
  price_label text,
  net_label text,
  stage text not null default 'range_accepted',
  stage_entered_at timestamptz not null default now(),
  call_due boolean default false,
  listed boolean default false,
  created_at timestamptz default now()
);

create table if not exists emds (
  id bigint generated always as identity primary key,
  lead_id bigint references leads(id) on delete set null,
  amount numeric not null default 0,
  pull_by_date date not null,
  will_close boolean default true,
  notes text,
  created_at timestamptz default now()
);

create table if not exists outreach_log (
  id bigint generated always as identity primary key,
  log_date date not null unique,
  sent integer not null default 0,
  created_at timestamptz default now()
);

-- Enable row level security
alter table leads enable row level security;
alter table emds enable row level security;
alter table outreach_log enable row level security;

-- Since there's no login system (single user, anon key), allow all
-- operations through the anon key. This is fine for a private personal
-- tool but means anyone with your URL + anon key can read/write data.
-- Do not share your Supabase URL/anon key publicly.
create policy "Allow all on leads" on leads for all using (true) with check (true);
create policy "Allow all on emds" on emds for all using (true) with check (true);
create policy "Allow all on outreach_log" on outreach_log for all using (true) with check (true);
