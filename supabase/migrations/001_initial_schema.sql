-- ============================================================
-- ATLAS — Supabase Database Schema
-- Run this in your Supabase SQL editor
-- ============================================================

-- Enable UUID extension
create extension if not exists "pgcrypto";

-- ─── RIDERS ─────────────────────────────────────────────────────────────────
create table if not exists riders (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  phone           text not null unique,          -- WhatsApp number e.g. 2348012345678
  company         text,                          -- Company name or null for independent
  zone            text not null,                 -- Primary zone: central / inner / outer
  coverage_zones  text[] default '{}',           -- All zones they cover
  is_available    boolean default true,
  rating          numeric(2,1) default 5.0,
  verified        boolean default false,         -- Admin must verify before they appear
  notes           text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ─── DELIVERIES ─────────────────────────────────────────────────────────────
create table if not exists deliveries (
  id               uuid primary key default gen_random_uuid(),
  sender_phone     text not null,
  pickup_address   text not null,
  dropoff_address  text not null,
  item_description text,
  item_size        text default 'small',         -- small / medium / large / extra-large
  estimated_price  integer default 0,            -- in Naira
  rider_id         uuid references riders(id),
  status           text default 'pending',       -- pending / accepted / in_transit / delivered / cancelled
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

-- ─── SESSIONS ────────────────────────────────────────────────────────────────
create table if not exists sessions (
  phone        text primary key,
  state        text not null default 'IDLE',
  context_json jsonb default '{}',
  last_active  timestamptz default now()
);

-- ─── PRICING ZONES (optional — used if you want DB-driven pricing) ───────────
create table if not exists pricing_zones (
  id              uuid primary key default gen_random_uuid(),
  from_zone       text not null,
  to_zone         text not null,
  base_rate_ngn   integer not null,
  size_small      numeric default 1.0,
  size_medium     numeric default 1.3,
  size_large      numeric default 1.8,
  size_xl         numeric default 2.5,
  is_active       boolean default true,
  unique (from_zone, to_zone)
);

-- ─── INDEXES ────────────────────────────────────────────────────────────────
create index if not exists idx_deliveries_sender  on deliveries(sender_phone);
create index if not exists idx_deliveries_status  on deliveries(status);
create index if not exists idx_deliveries_rider   on deliveries(rider_id);
create index if not exists idx_riders_available   on riders(is_available, verified);
create index if not exists idx_sessions_phone     on sessions(phone);

-- ─── SEED: Sample Abuja riders (for testing) ────────────────────────────────
insert into riders (name, phone, company, zone, coverage_zones, is_available, rating, verified)
values
  ('Emeka Dispatch',   '2348011111111', 'FastRun Abuja',     'central', '{"central","inner"}',  true, 4.8, true),
  ('Tunde Express',    '2348022222222', null,                'inner',   '{"inner","outer"}',     true, 4.5, true),
  ('Kelechi Logistics','2348033333333', 'AbujaMoto Courier', 'outer',   '{"outer","inner"}',     true, 4.7, true),
  ('Aminu Rider',      '2348044444444', null,                'central', '{"central"}',           true, 4.2, true),
  ('Chidi Swift',      '2348055555555', 'SwiftNG',           'central', '{"central","inner","outer"}', true, 4.9, true)
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
