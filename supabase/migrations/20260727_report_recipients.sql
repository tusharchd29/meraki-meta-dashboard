-- Who gets the automated report emails, configurable from the Reports tab
-- instead of being hardcoded (tusharchd29@gmail.com / heena@merakiads.in
-- were baked directly into api/cron-monthly-report.js and
-- app/api/send-report/route.js). Each recipient can be included on the
-- weekly send, the monthly send, or both.
create table if not exists meraki_report_recipients (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  label text,
  weekly boolean not null default true,
  monthly boolean not null default true,
  created_at timestamptz not null default now()
);

-- Seed the two addresses that were previously hardcoded, so switching to
-- the table doesn't silently stop delivering to anyone who relied on it.
-- ON CONFLICT so re-running this migration is safe.
insert into meraki_report_recipients (email, label, weekly, monthly)
values
  ('tusharchd29@gmail.com', 'Tushar', true, true),
  ('heena@merakiads.in', 'Heena', true, true)
on conflict (email) do nothing;
