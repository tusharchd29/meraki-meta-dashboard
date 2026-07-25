# Meraki Meta Dashboard

Internal advertising dashboard for Meraki Ads. Reads spend and campaign data
across Meta and Google Ads, maps accounts to clients, and reports budget
pacing for billing.

**This dashboard never writes to any ad platform.** See
[READ_ONLY_POLICY.md](./READ_ONLY_POLICY.md) for how that's enforced.

---

## How data gets in

### Meta — live OAuth
Connect a Facebook login once via **🔌 Connections → + Connect Meta**. The app
discovers every ad account that login can reach: directly-assigned accounts,
accounts owned by its business portfolios, and clients' accounts the portfolio
has partner access to. Nothing appears in the dashboard until you explicitly
tick an account as *tracked*.

Tokens are long-lived (60 days) and renewed automatically by a daily cron
(`/api/cron-refresh-tokens`), so reconnecting shouldn't be necessary.

Multiple logins can be connected — each contributes its own accounts.

### Google Ads — manual import
Google Ads API access requires a Developer Token with Basic Access, which
Google approves manually. Until that lands, Google spend is imported from
Campaign report exports on the **Clients (Blended)** tab.

**Export with a `Day` segment** (Segment > Time > Day). This matters:

| Export | What you get |
|---|---|
| With `Day` segment | True month-to-date. Any date range works; overlapping uploads correct each other. |
| Without | Only the export's own period. Month-to-date **cannot** be derived — a date-range total contains no daily detail to split. |

The importer previews what it parsed before writing anything.

Notes on the export format (verified against a real file): UTF-16LE encoded,
tab-delimited despite the .csv extension, no account identifier (so the client
is chosen at import), and `Total: Account` can exceed `Total: Campaigns` when
the export lists only some campaigns — the account total is authoritative.

---

## Concepts

**Connection** — one OAuth login (a person's Facebook or Google account).

**Account** — one ad account. Discovered via a connection, but only included
once explicitly *tracked*.

**Client** — the billing entity, in `meraki_clients`. Maps to a Meta account
and/or a Google account, which is what makes blended reporting possible. Map
them on the **Clients (Blended)** tab.

---

## Tabs

- **Account View** — per-account spend, CTR, frequency, campaign status
- **Campaign Table** — all campaigns, drill into ad sets / demographics / placements / creatives
- **Alerts** — rejected ads, billing issues, zero-spend, frequency fatigue, connection expiry
- **Leads Tracker** — daily lead volume
- **Billing & Pacing** — per-account Today / Week / Month vs approved budget
- **Clients (Blended)** — per-client Meta + Google + combined, and the Google import

---

## Environment variables

| Name | Required | Purpose |
|---|---|---|
| `SUPABASE_URL` | yes | Database |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Server-side DB access (bypasses RLS — never expose client-side) |
| `META_APP_ID` | yes | Meta OAuth |
| `META_APP_SECRET` | yes | Meta OAuth |
| `META_LOGIN_CONFIG_ID` | no | Only if the Meta app uses Facebook Login for Business configurations |
| `CRON_SECRET` | yes | Protects cron endpoints |
| `GOOGLE_ADS_CLIENT_ID` | no | Google OAuth (login only; data still needs the developer token) |
| `GOOGLE_ADS_CLIENT_SECRET` | no | Google OAuth |
| `GOOGLE_ADS_DEVELOPER_TOKEN` | no | Required for live Google Ads API |
| `GOOGLE_ADS_LOGIN_CUSTOMER_ID` | no | MCC id, needed when querying client accounts through a manager account |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | yes | Sheets sync cron |
| `GMAIL_USER` | yes | Sender address for the `cron-meta-email` report (Gmail SMTP) |
| `GMAIL_PASS` | yes | Gmail app password for `GMAIL_USER` (not the regular account password) |

Meta OAuth redirect URIs must be whitelisted **exactly**, for every domain the
app is opened on. Deployment-specific Vercel URLs (`...-abc123.vercel.app`)
change every build and can never be whitelisted — use a stable domain.

---

## Diagnostics

- `/api/auth/meta/debug` — the exact redirect URI being sent, plus which env vars are present
- `/api/debug/chain` — client list, token resolution, and a real Meta API call
- `/api/debug/pages` — which client Pages each tracked account advertises

---

## Known limitations

- **No historical ledger.** Spend is fetched live; nothing preserves a month's
  final figures once it rolls over. Needed before month-end for billing.
- **Two budget fields exist** — per-account (Connections) and per-client
  (`meraki_clients.monthly_budget`). These overlap and should be consolidated.
- **Mixed currencies aren't blended.** A client with THB Meta and INR Google
  shows "mixed currency" rather than a meaningless sum. No FX conversion.
- **Google Ads pacing** depends on Day-segmented exports; without them only
  the export's own period is known.
- **`/billing-debug`** still contains a hardcoded client list from before the
  dynamic-client migration.
