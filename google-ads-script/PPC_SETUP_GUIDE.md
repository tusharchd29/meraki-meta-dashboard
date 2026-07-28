# Google Ads Auto-Sync Setup — For the PPC Team

This connects our Google Ads accounts to the Meraki dashboard automatically, without needing Google's official API approval (which normally takes weeks). It works by using a small script inside Google Ads itself — something any PPC person can set up, no coding background needed. Just follow each step in order and don't skip any.

**Time needed:** about 15 minutes, one-time.

**What you need before starting:**
- Login access to our Google Ads **Manager account** (the one that manages all client accounts — sometimes called the MCC)
- Login access to the Meraki dashboard

There are 6 steps. Do them in order.

---

## Step 1 — Get the "service account email" from the dashboard

1. Open the Meraki dashboard in your browser and log in.
2. Click the **Google Ads** tab at the top.
3. Look for a box titled **"Auto-sync from Google Ads Scripts."**
4. Inside it, you'll see an email address that looks something like:
   ```
   something-random@some-project-name.iam.gserviceaccount.com
   ```
5. Copy this entire email address. You'll paste it in Step 2.

*(This isn't a real person's email — it belongs to the dashboard itself, and it already has permission to read data. We're about to give it access to one specific Sheet.)*

---

## Step 2 — Create a Google Sheet and share it

1. Go to **sheets.google.com**
2. Click **Blank spreadsheet** to create a new one.
3. Give it a name at the top — something like **"Meraki Google Ads Sync"** (top-left, click on "Untitled spreadsheet" to rename).
4. Click the green **Share** button, top-right corner.
5. In the box that appears, paste the email address you copied in Step 1.
6. To the right of where you pasted it, there's a dropdown (it probably says "Editor" already, or might say "Viewer" — **make sure it says "Editor"**).
7. Click **Send**.
   - A popup may ask "This person doesn't have a Google account, share anyway?" or similar — click **Share anyway** / **Send** if asked. This is expected since it's not a real person's Gmail.
8. Now look at the address bar of your browser (the URL at the top). It looks like:
   ```
   https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOp.../edit
   ```
9. **Copy the entire URL.** You'll need it in Step 3.

---

## Step 3 — Add the script inside Google Ads

1. Log into **ads.google.com** using our **Manager account** login (not an individual client account — it must be the Manager/MCC account, since this script needs to see all client accounts at once).
2. In the top-right area, click the **wrench/tools icon** (🔧).
3. In the menu that opens, find the section called **"Bulk Actions"** and click **Scripts** underneath it.
4. Click the blue **+** button (usually top-left of the Scripts page) to start a new script.
5. You'll see a code editor box, possibly with some sample text already in it. **Select all of that sample text and delete it** — the box should be empty.
6. Now you need the actual script text. Ask Tushar for the file called `meraki-sync.gs` (it's in the project's code repository, in a folder called `google-ads-script`) — he can send it to you as a text file, or paste it into a message for you.
7. **Copy the entire script** and **paste it into the empty code editor** in Google Ads.
8. Near the very top of what you pasted, find this line:
   ```
   var SPREADSHEET_URL = 'PASTE_YOUR_SHEET_URL_HERE';
   ```
9. Carefully delete only the text `PASTE_YOUR_SHEET_URL_HERE` (keep the quote marks around it) and paste the Sheet URL you copied in Step 2 in its place. It should now look like:
   ```
   var SPREADSHEET_URL = 'https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOp.../edit';
   ```
10. Click **Save** (usually top-right of the editor, may just be a save icon).
11. A box will pop up asking to **Authorize** the script. Click **Authorize**.
12. It will ask you to pick a Google account — pick the same one you're logged into Google Ads with, and click **Allow** / **Grant access** on the following screens. This is a one-time permission grant so the script can read your account data — it's completely normal and expected for any Google Ads script.
13. Once authorized, click **Preview** (this runs the script as a test, without saving anything permanent).
14. Watch the bottom of the screen — a **Logs** or **Changes/Logs** panel will show what happened.
    - **If it finishes with no red error text** → great, move to Step 4.
    - **If you see a red error message** → copy the *exact* text of the error and send it to Tushar. This is expected to possibly need a small fix the first time it's tested against a real account, so don't worry if this happens — just send the error.

---

## Step 4 — Schedule the script to run automatically

1. Still on the Scripts page in Google Ads, find the script you just created in the list.
2. Next to it, there should be a **frequency** column or a small clock/schedule icon — click it.
3. Choose a schedule. **Every 6 hours** is a good default.
4. Save the schedule.

That's it for the Google Ads side — the script will now run on its own, refreshing the Sheet automatically.

---

## Step 5 — Hand back to Tushar

The remaining steps involve the dashboard's hosting settings (Vercel), which need admin access. Send Tushar:

- ✅ Confirmation that Steps 1–4 above are done
- The **Sheet URL** from Step 2
- **A screenshot of the Logs panel** from Step 3, showing it ran without errors (or the error text, if there was one)

Tushar will finish the last two steps on his end (pointing the dashboard at your Sheet, and turning on the "Sync now" button) — nothing further needed from the PPC side unless he asks you to double check something in Google Ads.

---

## Common issues

| What you see | What it means | What to do |
|---|---|---|
| "This person doesn't have a Google account" when sharing the Sheet | Normal — the email is a service account, not a real Gmail address | Click "Share anyway" / confirm |
| Can't find "Scripts" under Tools | You might be logged into an individual client account instead of the Manager account | Log out, log back in choosing the Manager (MCC) account |
| Red error text after clicking Preview | Something in the script needs a small adjustment | Copy the exact error text, send to Tushar |
| Script runs but Sheet stays empty | Check that the Sheet was shared as **Editor**, not just Viewer | Redo Step 2, steps 5–6 |
| Not sure which account is the "Manager account" | It's the one where, after logging in, you see a list of multiple client accounts rather than one account's campaigns directly | Ask Tushar to confirm the login if unsure |
