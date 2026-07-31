// ============================================================
// Meraki Ads — Google Ads SINGLE-ACCOUNT Script → Google Sheets Sync
// ============================================================
// Unlike meraki-sync.gs (the Manager/MCC version), this runs inside ONE
// client account directly — no AdsManagerApp, no account iteration, no
// dependency on that account being linked under any particular Manager
// account. Install this exact same script separately into EVERY client
// account you want data from, regardless of which Manager (if any) it's
// linked to, or whether you only have direct personal login access to it.
//
// All accounts write into the SAME shared Sheet (same SPREADSHEET_URL),
// each tagged by its own Customer ID — so the dashboard sees one combined
// dataset no matter how many separate accounts are feeding it.
//
// Once scheduled (step 5 below), this needs no further attention — new
// rows just keep landing in the Sheet automatically, same as how Meta
// data flows in on its own.
//
// SETUP (repeat once per client account):
// 1. Switch into that specific client account in Google Ads (not a
//    Manager account — go directly into e.g. "Krishna Volvo" itself).
// 2. Paste SPREADSHEET_URL below — same Sheet URL every time, reused
//    across every account.
// 3. Tools & Settings > Bulk Actions > Scripts > + > paste this whole
//    file in > Authorize when prompted > Preview to confirm no errors.
// 4. Save.
// 5. Click the schedule/clock icon and set a frequency (every 6 hours is
//    a reasonable default). Staggering each account's schedule by a few
//    minutes (e.g. 6:00, 6:05, 6:10...) avoids every account trying to
//    write to the Sheet in the exact same instant — not required, but a
//    little tidier.
// 6. Move to the next client account and repeat from step 1. The Sheet
//    and dashboard side only need to be set up once, ever.
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

  var now = new Date();
  var account = AdsApp.currentAccount();
  var customerId = account.getCustomerId();

  // Only this account's own rows get cleared and rewritten in the
  // Campaigns tab (not the whole sheet) — since every other client
  // account's script is writing into the same shared tab independently,
  // wiping the entire tab here would erase everyone else's data too.
  clearThisAccountsCampaignRows(campSheet, customerId);

  try {
    syncAccount(account, dailySheet, campSheet, now);
    Logger.log('Synced OK: ' + account.getName() + ' (' + customerId + ')');
  } catch (e) {
    campSheet.appendRow([customerId, account.getName(), '', 'ERROR: ' + e.message, '', '', '', '', '', now]);
    Logger.log('FAILED: ' + account.getName() + ' (' + customerId + ') — ' + e.message);
  }
}

function getOrCreateTab(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
  }
  return sheet;
}

// Removes only rows belonging to THIS account's customer ID (column A),
// leaving every other account's rows in the shared tab untouched.
function clearThisAccountsCampaignRows(sheet, customerId) {
  var data = sheet.getDataRange().getValues();
  for (var i = data.length - 1; i >= 1; i--) { // bottom-up, skip header row
    if (String(data[i][0]) === String(customerId)) {
      sheet.deleteRow(i + 1);
    }
  }
}

// Same as the MCC version — removes any existing row for this account+date
// before appending, so re-running the same day updates today's figure
// instead of creating duplicates.
function removeDailyRowForToday(sheet, customerId, dateStr) {
  var data = sheet.getDataRange().getValues();
  for (var i = data.length - 1; i >= 1; i--) {
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
