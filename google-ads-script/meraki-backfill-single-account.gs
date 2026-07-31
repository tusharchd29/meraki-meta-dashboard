// ============================================================
// Meraki Ads — ONE-TIME Backfill: last 2 months of daily data
// ============================================================
// Run this ONCE per client account, right after installing the ongoing
// meraki-sync-single-account.gs script there. It fills in history the
// regular script has no way to know about (that one only ever looks at
// "today" and "this month so far").
//
// After running this once successfully, you never need it again — the
// regular scheduled script keeps today's row current going forward, and
// this backfill has already covered everything before that.
//
// SETUP:
// 1. Same account, same Sheet — paste SPREADSHEET_URL below, identical
//    to the one used in meraki-sync-single-account.gs.
// 2. Adjust DAYS_TO_BACKFILL if you want more/less than ~2 months
//    (default 60 days).
// 3. Tools & Settings > Bulk Actions > Scripts > + > paste this in >
//    Authorize > Preview (check Logs for errors) > Run once for real.
// 4. Safe to run more than once by accident — existing rows for a given
//    date get replaced, not duplicated.
// 5. Delete this script afterward, or just leave it there unscheduled
//    (do NOT put it on a recurring schedule — it re-checks 60 days every
//    time, which is unnecessary and slow compared to the daily script).
// ============================================================

var SPREADSHEET_URL = 'https://docs.google.com/spreadsheets/d/1_DyKMiPprSLz2KoWIdt8w2rNFzWACOxgoB86sMOvKis/edit';
var DAILY_TAB = 'Daily';
var DAYS_TO_BACKFILL = 60; // roughly 2 months

function main() {
  var ss = SpreadsheetApp.openByUrl(SPREADSHEET_URL);
  var dailySheet = getOrCreateTab(ss, DAILY_TAB, [
    'Account ID', 'Account Name', 'Date', 'Cost', 'Impressions', 'Clicks', 'Conversions', 'Currency', 'Synced At'
  ]);

  var account = AdsApp.currentAccount();
  var customerId = account.getCustomerId();
  var accountName = account.getName();
  var currency = account.getCurrencyCode();
  var tz = account.getTimeZone();
  var now = new Date();

  var endDate = new Date(now);
  var startDate = new Date(now);
  startDate.setDate(startDate.getDate() - DAYS_TO_BACKFILL);

  var startStr = Utilities.formatDate(startDate, tz, 'yyyy-MM-dd');
  var endStr = Utilities.formatDate(endDate, tz, 'yyyy-MM-dd');

  // segments.date on a customer-level report returns one row PER DAY in
  // the range, each with that day's own totals — not one summed row for
  // the whole range.
  var report = AdsApp.report(
    "SELECT segments.date, metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions " +
    "FROM customer " +
    "WHERE segments.date BETWEEN '" + startStr + "' AND '" + endStr + "'"
  );

  var rows = report.rows();
  var written = 0;
  var syncedAt = new Date();

  while (rows.hasNext()) {
    var row = rows.next();
    var dateStr = row['segments.date'];
    var cost = Number(row['metrics.cost_micros'] || 0) / 1e6;
    var impr = Number(row['metrics.impressions'] || 0);
    var clicks = Number(row['metrics.clicks'] || 0);
    var conv = Number(row['metrics.conversions'] || 0);

    removeExistingRowForDate(dailySheet, customerId, dateStr);
    dailySheet.appendRow([customerId, accountName, dateStr, cost, impr, clicks, conv, currency, syncedAt]);
    written++;
  }

  Logger.log('Backfill complete for ' + accountName + ' (' + customerId + '): ' + written + ' day(s) written, range ' + startStr + ' to ' + endStr + '.');
}

function getOrCreateTab(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
  }
  return sheet;
}

// Same dedup logic as the ongoing script, generalized to any date rather
// than just today — so re-running this backfill is always safe.
function removeExistingRowForDate(sheet, customerId, dateStr) {
  var data = sheet.getDataRange().getValues();
  for (var i = data.length - 1; i >= 1; i--) {
    if (String(data[i][0]) === String(customerId) && String(data[i][2]) === dateStr) {
      sheet.deleteRow(i + 1);
    }
  }
}
