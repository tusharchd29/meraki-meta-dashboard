// ============================================================
// Meraki Ads — Google Ads Manager Script → Google Sheets Sync
// ============================================================
// Runs natively inside Google Ads under your Manager (MCC) account.
// No Google Ads API developer token needed — this uses Ads Scripts'
// own built-in AdsApp/AdsManagerApp objects, a completely separate,
// token-free mechanism from the Ads API.
//
// Writes two tabs to a Google Sheet, for every client account under
// this Manager account:
//   "Daily"     — one row per account per day (true daily granularity,
//                 so month-to-date figures in the dashboard are always
//                 exact, never double-counted from an overlapping
//                 date-range import).
//   "Campaigns" — current month-to-date campaign-level breakdown per
//                 account (name, status, cost, impressions, clicks,
//                 conversions), replaced fresh on every run.
//
// SETUP (one time):
// 1. Create a new Google Sheet (any name), copy its URL.
// 2. Paste that URL into SPREADSHEET_URL below.
// 3. Share the Sheet (Editor access) with the service account email
//    shown on the Google Ads tab in the Meraki dashboard, under
//    "Auto-sync from Google Ads Scripts".
// 4. In Google Ads: Tools & Settings > Bulk Actions > Scripts > the
//    blue "+" button > paste this whole file in > Authorize when
//    prompted > Preview to test it runs without errors > Save.
// 5. Click the schedule/clock icon next to the script and set a
//    frequency (every 6 hours is a reasonable default).
// 6. Copy the long ID from the Sheet's URL (the part between /d/ and
//    /edit) and add it as GOOGLE_ADS_SHEET_ID in the dashboard's
//    Vercel environment variables.
// 7. Back on the Google Ads tab, click "Sync now" once to pull it in
//    immediately rather than waiting for the daily cron.
//
// NOTE: this script hasn't been run against a real account yet as
// part of building it — Ads Scripts' GAQL field syntax (row['metrics.
// cost_micros'] etc.) is based on Google's documented reporting API,
// but if the Preview step in step 4 shows an error, that's the most
// likely place something needs a small adjustment.
// ============================================================

var SPREADSHEET_URL = 'https://docs.google.com/spreadsheets/d/1_DyKMiPprSLz2KoWIdt8w2rNFzWACOxgoB86sMOvKis/edit';
var DAILY_TAB = 'Daily';
var CAMPAIGNS_TAB = 'Campaigns';

function main() {
  var ss = SpreadsheetApp.openByUrl(SPREADSHEET_URL);
  var dailySheet = getOrCreateTab(ss, DAILY_TAB, [
    'Account ID', 'Account Name', 'Date', 'Cost', 'Impressions', 'Clicks', 'Conversions', 'Currency', 'Synced At'
  ]);
  var campSheet = getOrCreateTab(ss, CAMPAIGNS_TAB, [
    'Account ID', 'Account Name', 'Currency', 'Campaign', 'Status', 'Cost', 'Impressions', 'Clicks', 'Conversions', 'Synced At'
  ]);

  // Campaigns tab is a full month-to-date snapshot each run, not a running
  // history — clear it and rewrite, so it never accumulates stale rows.
  clearBelowHeader(campSheet);

  var now = new Date();

  var accountIterator = AdsManagerApp.accounts().get();
  var processedCount = 0;
  var errorCount = 0;

  while (accountIterator.hasNext()) {
    var account = accountIterator.next();
    // select() and syncAccount() are BOTH inside this try/catch now.
    // Previously select() sat outside it — if selecting a single account
    // threw (e.g. a cancelled/closed account, or any other per-account
    // quirk), the exception propagated straight out of the while loop and
    // silently stopped processing every account after it. That's exactly
    // why only 1 account was ever getting synced: whichever account came
    // right after the first one to fail select() ended the whole run.
    try {
      AdsManagerApp.select(account);
      syncAccount(account, dailySheet, campSheet, now);
      processedCount++;
    } catch (e) {
      errorCount++;
      campSheet.appendRow([account.getCustomerId(), account.getName(), '', 'ERROR: ' + e.message, '', '', '', '', '', now]);
    }
  }

  Logger.log('Sync finished: ' + processedCount + ' account(s) synced OK, ' + errorCount + ' failed (see ERROR rows in the Campaigns tab for details).');
}

function getOrCreateTab(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
  }
  return sheet;
}

function clearBelowHeader(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent();
}

// Removes any existing row for this account+date before appending a fresh
// one, so running the script more than once on the same day updates
// today's figure instead of creating duplicate rows for it.
function removeDailyRowForToday(sheet, customerId, dateStr) {
  var data = sheet.getDataRange().getValues();
  for (var i = data.length - 1; i >= 1; i--) { // bottom-up, skip header row
    if (String(data[i][0]) === String(customerId) && String(data[i][2]) === dateStr) {
      sheet.deleteRow(i + 1);
    }
  }
}

function syncAccount(account, dailySheet, campSheet, now) {
  var customerId = account.getCustomerId();
  var accountName = account.getName();
  var currency = account.getCurrencyCode();
  var tz = account.getTimeZone();
  var todayStr = Utilities.formatDate(now, tz, 'yyyy-MM-dd');

  // --- Today's account-level total, for the Daily tab ---
  var todayReport = AdsApp.report(
    "SELECT metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions " +
    "FROM customer " +
    "WHERE segments.date DURING TODAY"
  );
  var todayRows = todayReport.rows();
  var cost = 0, impr = 0, clicks = 0, conv = 0;
  if (todayRows.hasNext()) {
    var r = todayRows.next();
    cost = Number(r['metrics.cost_micros'] || 0) / 1e6;
    impr = Number(r['metrics.impressions'] || 0);
    clicks = Number(r['metrics.clicks'] || 0);
    conv = Number(r['metrics.conversions'] || 0);
  }
  removeDailyRowForToday(dailySheet, customerId, todayStr);
  dailySheet.appendRow([customerId, accountName, todayStr, cost, impr, clicks, conv, currency, now]);

  // --- Month-to-date campaign breakdown, for the Campaigns tab ---
  var campReport = AdsApp.report(
    "SELECT campaign.name, campaign.status, metrics.cost_micros, " +
    "metrics.impressions, metrics.clicks, metrics.conversions " +
    "FROM campaign " +
    "WHERE segments.date DURING THIS_MONTH"
  );
  var rows = campReport.rows();
  var any = false;
  while (rows.hasNext()) {
    any = true;
    var row = rows.next();
    campSheet.appendRow([
      customerId, accountName, currency,
      row['campaign.name'], row['campaign.status'],
      Number(row['metrics.cost_micros'] || 0) / 1e6,
      Number(row['metrics.impressions'] || 0),
      Number(row['metrics.clicks'] || 0),
      Number(row['metrics.conversions'] || 0),
      now
    ]);
  }
  if (!any) {
    campSheet.appendRow([customerId, accountName, currency, '(no campaigns with data this month)', '', 0, 0, 0, 0, now]);
  }
}
