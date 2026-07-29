-- Extends the daily budget snapshot with performance metrics (not just
-- spend) — captured in the same Meta insights call cron-budget-snapshot.js
-- already makes per client per day, no extra API calls. Feeds the blend
-- dashboard's new performance columns.

alter table meraki_budget_snapshots
  add column if not exists meta_impressions bigint,
  add column if not exists meta_clicks bigint,
  add column if not exists meta_ctr numeric,
  add column if not exists meta_cpc numeric,
  add column if not exists meta_actions jsonb;

comment on column meraki_budget_snapshots.meta_actions is
  'Raw [{action_type, value}] from Meta insights — objective-specific conversion events (leads, purchases, messages, etc), left uninterpreted since "results" means different things per campaign objective.';
