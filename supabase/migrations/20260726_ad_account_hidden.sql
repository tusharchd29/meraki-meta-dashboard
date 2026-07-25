-- Lets an account be permanently removed from the Connections & Accounts
-- list (not just left unchecked/untracked). Untracked accounts still show
-- up in the list today, which is exactly what shouldn't happen for
-- accounts that don't belong in this tool at all.
alter table meraki_ad_accounts
  add column if not exists is_hidden boolean not null default false;
