# Meraki Dashboard — Setup Guide

Two things need manual setup on your end before they're fully live. Neither needs a Google Ads developer token, and neither needs you to touch code. Do them in either order.

- **Part 1: Report Recipients** (~2 minutes) — lets the Reports tab actually email people
- **Part 2: Google Ads Auto-Sync** (~10 minutes) — gets Google Ads data flowing automatically, no developer token

---

## Part 1: Report Recipients (Supabase migration)

**Why:** the weekly/monthly report emails read their recipient list from a database table that needs to be created once.

**How to tell if this is already done:** open the dashboard → **Reports** tab → scroll to "Report Recipients." If it shows a list of emails (or an empty list with an add-email box), you're already done — skip to Part 2. If it shows a message about the table not being set up, do this:

1. Go to **[supabase.com/dashboard/projects](https://supabase.com/dashboard/projects)** and log in.
2. Open the project whose database this dashboard uses. (If you're not sure which one, the `SUPABASE_URL` env var in Vercel — see Part 2, Step 5 for how to find Vercel env vars — tells you the project ref.)
3. In the left sidebar, click **SQL Editor** → **New query**.
4. Paste in the SQL below and click **Run** (or Ctrl/Cmd+Enter).

```sql
-- Who gets the automated report emails, configurable from the Reports tab
-- instead of being hardcoded. Each recipient can be included on the
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
insert into meraki_report_recipients (email, label, weekly, monthly)
values
  ('tusharchd29@gmail.com', 'Tushar', true, true),
  ('heena@merakiads.in', 'Heena', true, true)
on conflict (email) do nothing;
```

5. You should see "Success. No rows returned." Reload the Reports tab — the recipients panel should now show Tushar and Heena, and you can add/remove people from there.

**Source file in the repo:** [`supabase/migrations/20260727_report_recipients.sql`](https://github.com/tusharchd29/meraki-meta-dashboard/blob/main/supabase/migrations/20260727_report_recipients.sql)

---

## Part 2: Google Ads Auto-Sync (no developer token needed)

**Why:** Google Ads' live API requires a developer token, which needs a weeks-long Google approval process. Google Ads *Scripts* are a completely separate, first-party mechanism — they run inside your Google Ads account itself, need zero approval, and can write data into a Google Sheet on a free schedule. This gets that Sheet feeding the dashboard automatically.

### Step 1 — Find your setup info in the dashboard

1. Open the dashboard → **Google Ads** tab.
2. Find the card titled **"Auto-sync from Google Ads Scripts."**
3. It will show a **service account email** that looks like `something@some-project.iam.gserviceaccount.com`. Copy this — you'll need it in Step 2.

This email already has permission to read/write Google Sheets (it's reused from the dashboard's existing Meta reporting setup) — nothing new to create in Google Cloud.

### Step 2 — Create and share a Google Sheet

1. Go to **[sheets.google.com](https://sheets.google.com)** → **Blank spreadsheet**. Name it anything (e.g. "Meraki Google Ads Sync").
2. Click **Share** (top right).
3. Paste in the service account email from Step 1.
4. Set its role to **Editor**.
5. Click **Send** (uncheck "Notify people" if you don't want a notification email going to a service account — it won't read it anyway).
6. Copy the Sheet's URL from your browser's address bar — you'll need it in Step 3.

### Step 3 — Add the script in Google Ads

1. Log into your Google Ads **Manager (MCC) account** — the one that manages your client accounts — at **[ads.google.com](https://ads.google.com)**.
2. Click the tools icon (🔧) in the top right → under **Bulk Actions**, click **Scripts**.
   - Direct path: **Tools & Settings → Bulk Actions → Scripts**
3. Click the blue **+** button to create a new script.
4. Open the script file in the dashboard's repo: [`google-ads-script/meraki-sync.gs`](https://github.com/tusharchd29/meraki-meta-dashboard/blob/main/google-ads-script/meraki-sync.gs) — copy its **entire contents**.
5. Paste the whole thing into the Google Ads script editor, replacing whatever's there.
6. Near the top of the script, find this line:
   ```js
   var SPREADSHEET_URL = 'PASTE_YOUR_SHEET_URL_HERE';
   ```
   Replace `PASTE_YOUR_SHEET_URL_HERE` with the Sheet URL you copied in Step 2 (keep the quotes).
7. Click **Save**.
8. Click **Authorize** when prompted — this is Google asking your Ads account to allow the script to run; it's a normal one-time step for any Ads Script, not related to the API/developer-token issue at all.
9. Click **Preview** to do a test run without saving any changes. Watch the log output at the bottom for errors.
   - If it completes without errors, you're done with this step.
   - If it errors, **copy the exact error message and send it back** — the script hasn't been tested against a real account, so this Preview step is the first real test of its Google Ads Query Language (GAQL) syntax, and it's a five-minute fix if something's slightly off.

**Reference docs (if you want to understand what the script is doing):**
- [Google Ads Scripts — Get started](https://developers.google.com/google-ads/scripts/docs/getting-started)
- [Manager account scripts (`AdsManagerApp`)](https://developers.google.com/google-ads/scripts/docs/concepts/manager-scripts)
- [Reporting concepts (`AdsApp.report`, GAQL)](https://developers.google.com/google-ads/scripts/docs/concepts/reports)
- [`AdsApp.report()` reference](https://developers.google.com/google-ads/scripts/docs/reference/adsapp/adsapp_report) — Google's own example here uses `FROM customer WHERE segments.date DURING LAST_MONTH`, the same pattern this script uses for each account's daily total, which is a good sign the syntax is right.

One limit worth knowing: Ads Scripts have a hard 30-minute run limit (60 minutes for some manager-account script types). With ~20-50 client accounts doing two lightweight report queries each, this script should run in well under a minute — but if you ever manage a much larger number of accounts and the script starts timing out, that's the cause.

### Step 4 — Schedule it

1. Back on the Scripts page, find your script in the list.
2. Click the **frequency/clock icon** next to it (may show "Never run" or similar until scheduled).
3. Set it to run **every 6 hours** (a reasonable default — more often doesn't help since the dashboard's automatic pull is once daily anyway; the "Sync now" button in the dashboard covers on-demand refreshes).
4. Save.

### Step 5 — Tell the dashboard which Sheet to read

1. Get the Sheet's ID: it's the long string of letters/numbers in the Sheet's URL, between `/d/` and `/edit`:
   ```
   https://docs.google.com/spreadsheets/d/THIS_LONG_STRING_IS_THE_ID/edit
   ```
2. Go to **[vercel.com](https://vercel.com)** → your project (**meraki-meta-internal-dashboard**) → **Settings → Environment Variables**.
   - Direct path pattern: `vercel.com/<your-team>/meraki-meta-internal-dashboard/settings/environment-variables`
3. Click **Add New**.
4. Name: `GOOGLE_ADS_SHEET_ID`
5. Value: paste the ID from step 1 above.
6. Environments: check **Production** and **Preview** (matching how the other env vars are set).
7. Save. Vercel will need a redeploy to pick up the new variable — either wait for the next deploy, or trigger one manually (Vercel → Deployments → ⋯ on the latest → Redeploy).

### Step 6 — Run the first sync

1. Back in the dashboard's **Google Ads** tab, the setup card should now show a **"Sync now"** button instead of the setup checklist (once the new env var has deployed).
2. Click it.
3. You should see a result like "Synced N daily row(s) and M campaign row(s)." If any account IDs come back as "not mapped to a client yet," map them on the **Clients (Blended)** tab so their data shows up.

---

## What happens automatically after this

- The Google Ads Script re-runs on whatever schedule you set in Step 4, refreshing the Sheet.
- The dashboard pulls from that Sheet once a day automatically (Vercel's free/Hobby plan caps how often scheduled jobs can run — this is why it's once daily rather than hourly).
- Anytime you want fresher data than that, click **Sync now** on the Google Ads tab.
- All of this feeds the same system already built: account cards, budget pacing (month-to-date, adjusted for how far through the month it is), and the PDF/email reports.

## If something breaks

| Symptom | Likely cause | Fix |
|---|---|---|
| "GOOGLE_ADS_DEVELOPER_TOKEN not configured" banner still showing | Expected — that's the *live API* path, separate from this Sheet-based one. Ignore unless you later get a real developer token. | N/A |
| Recipients panel shows a "not set up" message | Part 1 migration hasn't been run | Do Part 1 above |
| "Sync now" says `GOOGLE_ADS_SHEET_ID not configured` | Step 5 not done yet, or Vercel hasn't redeployed | Recheck Step 5, trigger a redeploy |
| Sync says accounts "not mapped to a client" | Those Google Ads account IDs aren't linked to a client in the roster | Map them on Clients (Blended) |
| Google Ads Script Preview shows an error | GAQL syntax may need a small fix | Send the exact error message back |
| Numbers look stale | Script hasn't run recently, or hasn't been scheduled | Recheck Step 4's schedule, or click "Sync now" |

## All links in one place

- Supabase projects: https://supabase.com/dashboard/projects
- Google Sheets: https://sheets.google.com
- Google Ads: https://ads.google.com
- Vercel dashboard: https://vercel.com
- This repo: https://github.com/tusharchd29/meraki-meta-dashboard
  - Migration SQL: https://github.com/tusharchd29/meraki-meta-dashboard/blob/main/supabase/migrations/20260727_report_recipients.sql
  - Google Ads Script: https://github.com/tusharchd29/meraki-meta-dashboard/blob/main/google-ads-script/meraki-sync.gs
- Google Ads Scripts — Get started: https://developers.google.com/google-ads/scripts/docs/getting-started
- Manager account scripts: https://developers.google.com/google-ads/scripts/docs/concepts/manager-scripts
- Reporting concepts (GAQL): https://developers.google.com/google-ads/scripts/docs/concepts/reports
- `AdsApp.report()` reference: https://developers.google.com/google-ads/scripts/docs/reference/adsapp/adsapp_report
