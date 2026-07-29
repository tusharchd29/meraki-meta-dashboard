-- Budget deviation alerting (SOP v2.0 Section 5.1 / Escalation Matrix:
-- "Ad below benchmark flagged with cause + corrective action + review date").
--
-- cron-budget-snapshot.js already computes pace_status ('overspending' /
-- 'underspending' / 'on_track') into meraki_budget_snapshots every day, but
-- nothing ever surfaces it — it just sits in the table. This migration adds
-- what's needed to actually alert on it:
--   1. An opt-in column on the existing recipients table.
--   2. A log table so the alert cron can avoid re-sending the same
--      deviation every single day (alerts once when a deviation starts,
--      then a reminder every 3 days if it's still unresolved).

alter table meraki_report_recipients
  add column if not exists budget_alerts boolean not null default true;

comment on column meraki_report_recipients.budget_alerts is
  'Whether this recipient gets the budget deviation alert email (cron-budget-alert.js). Defaults true so existing recipients are not silently dropped.';

create table if not exists meraki_budget_alerts_log (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references meraki_clients(id) on delete cascade,
  pace_status text not null,       -- 'overspending' | 'underspending' at time of alert
  deviation_pct numeric,           -- actual_pct - expected_pct at time of alert
  alert_date date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists idx_budget_alerts_log_client_date
  on meraki_budget_alerts_log (client_id, alert_date desc);

comment on table meraki_budget_alerts_log is
  'Tracks which clients have already been alerted on and when, so cron-budget-alert.js only re-notifies every 3 days for an unresolved deviation instead of daily.';
