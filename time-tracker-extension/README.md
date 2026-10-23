# GCS Mol Labs Time Tracker extension

This is a Chrome Manifest V3 extension. It keeps the running timer in Chrome local storage, so closing the popup does not stop it.

## One-time setup

1. Copy the updated `doGet`, `doPost`, and `timeTrackerApiResponse_` changes from `code.gs.txt` into Apps Script.
2. Redeploy the web app and copy its **`/exec`** URL.
3. In the web-app deployment settings, select **Execute as: User accessing the web app** and limit access to the intended Roche users. This is required so `Session.getActiveUser()` saves under the timer user's email.
4. Copy `config.example.js` to `config.js`, then replace `PASTE_YOUR_APPS_SCRIPT_EXEC_URL_HERE` with that `/exec` URL. `config.js` is intentionally not committed.
5. In Chrome, open `chrome://extensions`, enable **Developer mode**, select **Load unpacked**, and choose the `time-tracker-extension` folder.

## Use

1. Open the extension popup.
2. Select department and category (and project/instrument when relevant), then start the timer.
3. Stop the timer. Edit the calculated hours if required.
4. Save. The entry is validated and stored through the same Apps Script function as the main application.

Do not put a Supabase key in the extension.
