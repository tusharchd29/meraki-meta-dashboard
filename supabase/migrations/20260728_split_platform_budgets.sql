-- Budgets are approved separately per platform (Meta and Google get their
-- own numbers from the client), not as one combined figure. The old single
-- monthly_budget column couldn't represent that, which caused Billing &
-- Pacing (Meta) and Google Ads tabs to pace platform-only spend against a
-- number meant to (incorrectly, in one direction or the other) represent
-- everything.
--
-- monthly_budget is kept, untouched, as a legacy/fallback value — existing
-- rows aren't migrated automatically since there's no way to know how a
-- past combined figure should split between the two platforms. Re-enter
-- meta_monthly_budget and google_monthly_budget per client in Clients
-- (Blended) going forward; monthly_budget only matters for clients that
-- haven't been re-entered yet, and even then only as a single-platform
-- fallback (see app code).

alter table meraki_clients
  add column if not exists meta_monthly_budget   numeric,
  add column if not exists google_monthly_budget numeric;

comment on column meraki_clients.meta_monthly_budget is
  'Approved monthly budget for this client''s Meta account. Paced against Meta-only spend on the Billing & Pacing tab.';
comment on column meraki_clients.google_monthly_budget is
  'Approved monthly budget for this client''s Google Ads account. Paced against Google-only spend on the Google Ads tab.';
comment on column meraki_clients.monthly_budget is
  'Legacy combined budget field. Superseded by meta_monthly_budget / google_monthly_budget — only read as a fallback for clients not yet re-entered under the split fields.';
