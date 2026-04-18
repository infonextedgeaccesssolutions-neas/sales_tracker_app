-- ═══════════════════════════════════════════════════════════════════
--  PCORP SALES TRACKER — Supabase Schema
--  Run this in your Supabase project → SQL Editor → New Query
-- ═══════════════════════════════════════════════════════════════════

-- 1. proposals table
create table if not exists proposals (
  id          bigserial primary key,
  proposal_num text,
  cost        numeric default 0,
  markup      numeric default 0.25,
  win_rate    numeric default 0,
  revisions   numeric default 0,
  comment     text    default '',
  sort_order  integer default 0,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- 2. Auto-update updated_at on every row change
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger proposals_updated_at
  before update on proposals
  for each row execute function update_updated_at();

-- 3. Enable Row Level Security (open read/write for team use)
alter table proposals enable row level security;

create policy "Allow all" on proposals
  for all using (true) with check (true);

-- 4. Enable Realtime for live sync
alter publication supabase_realtime add table proposals;

-- 5. Seed with initial data (optional — app seeds automatically on first run)
-- insert into proposals (cost, markup, win_rate, revisions, comment, sort_order) values
--   (34000000,    0.20, 0,   32000000,   'Serendra 2 Alveo',    1),
--   (11586094.43, 0.25, 0,   0,          'Alveo',               2),
--   (7827388.53,  0.25, 0.7, 3629947.46, 'ACEN',                3);
