-- Daily budget/spend ledger. Fixes the dashboard's #1 known limitation:
-- "No historical ledger — spend is fetched live, nothing preserves a
-- month's final figures once it rolls over."
--
-- One row per client per day. cron-budget-snapshot.js upserts this once
-- daily so history is never lost, even though live views (Clients tab,
-- Billing & Pacing tab) keep reading spend live from Meta/Google as before.

create table if not exists meraki_budget_snapshots (
  id                  uuid primary key default gen_random_uuid(),
  client_id           uuid not null references meraki_clients(id) on delete cascade,
  snapshot_date       date not null,

  meta_spend_mtd      numeric,          -- month-to-date, in meta_currency
  meta_currency       text,
  google_spend_mtd    numeric,          -- month-to-date, in google_currency
  google_currency     text,

  -- Both legs converted to INR so a client running THB Meta + INR Google
  -- gets a real total instead of the "mixed currency" placeholder the
  -- live views show today.
  blended_spend_inr   numeric,
  fx_rates_used       jsonb,            -- {"THB": 2.5, "NZD": 51.2, ...} snapshot of rates applied

  budget              numeric,          -- meraki_clients.monthly_budget at snapshot time
  budget_month        text,

  expected_pct        numeric,          -- days elapsed / days in month * 100
  actual_pct          numeric,          -- blended_spend_inr / budget * 100
  pace_status         text,             -- 'overspending' | 'on_track' | 'underspending' | null (no budget set)

  created_at          timestamptz not null default now(),

  unique (client_id, snapshot_date)
);

create index if not exists idx_budget_snapshots_client_date
  on meraki_budget_snapshots (client_id, snapshot_date desc);

comment on table meraki_budget_snapshots is
  'Daily append-only ledger of spend vs budget per client, written by cron-budget-snapshot.js. Read this for trend/history views instead of re-deriving from live API calls.';
