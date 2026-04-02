-- ============================================================
-- ATLAS UK — Supabase Database Schema (London)
-- Run this in your Supabase SQL editor
-- ============================================================

create extension if not exists "pgcrypto";

-- ─── RIDERS ──────────────────────────────────────────────────────────────────
create table if not exists riders (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  phone                 text not null unique,
  company               text,
  zone                  text not null,             -- central / inner / outer
  coverage_zones        text[] default '{}',
  vehicle_type          text default 'motorbike',  -- motorbike / bicycle / car / van
  hire_reward_insurance boolean default false,     -- UK legal requirement for paid deliveries
  is_available          boolean default true,
  rating                numeric(2,1) default 5.0,
  verified              boolean default false,     -- Admin must verify insurance before listing
  notes                 text,
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

-- ─── DELIVERIES ──────────────────────────────────────────────────────────────
create table if not exists deliveries (
  id                uuid primary key default gen_random_uuid(),
  sender_phone      text not null,
  pickup_address    text not null,
  dropoff_address   text not null,
  item_description  text,
  item_size         text default 'small',
  estimated_price   numeric(8,2) default 0,       -- in GBP
  rider_id          uuid references riders(id),
  status            text default 'pending',        -- pending / accepted / in_transit / delivered / cancelled
  channel           text default 'whatsapp',       -- whatsapp / telegram
  sender_type       text default 'individual',     -- individual / business
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

-- ─── SESSIONS ────────────────────────────────────────────────────────────────
create table if not exists sessions (
  phone        text primary key,
  state        text not null default 'IDLE',
  context_json jsonb default '{}',
  last_active  timestamptz default now()
);

-- ─── INDEXES ─────────────────────────────────────────────────────────────────
create index if not exists idx_deliveries_sender  on deliveries(sender_phone);
create index if not exists idx_deliveries_status  on deliveries(status);
create index if not exists idx_deliveries_rider   on deliveries(rider_id);
create index if not exists idx_riders_available   on riders(is_available, verified);
create index if not exists idx_sessions_phone     on sessions(phone);

-- ─── SEED: Sample London riders (for testing) ────────────────────────────────
insert into riders (name, phone, company, zone, coverage_zones, vehicle_type, hire_reward_insurance, is_available, rating, verified)
values
  ('James Courier',    '447700000001', null,                  'central', '{"central","inner"}',         'bicycle',   true, 4.8, true),
  ('Maria Express',    '447700000002', 'SpeedyLDN',           'inner',   '{"inner","central"}',         'motorbike', true, 4.7, true),
  ('David Swift',      '447700000003', null,                  'outer',   '{"outer","inner"}',           'motorbike', true, 4.5, true),
  ('Sophie Delivers',  '447700000004', 'LondonRuns Couriers', 'central', '{"central","inner","outer"}', 'car',       true, 4.9, true),
  ('Kwame Dispatch',   '447700000005', null,                  'inner',   '{"inner","outer"}',           'motorbike', true, 4.6, true)
on conflict (phone) do nothing;

-- ─── UPDATED_AT TRIGGER ──────────────────────────────────────────────────────
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger riders_updated_at
  before update on riders
  for each row execute function update_updated_at();

create trigger deliveries_updated_at
  before update on deliveries
  for each row execute function update_updated_at();
