# ChefHire CRM Onboarding App

A lightweight custom onboarding form for ChefHire.

## Architecture

- **GitHub** — stores the source code
- **Cloudflare Pages** — hosts the form
- **Cloudflare Pages Function** — securely proxies form submissions
- **Google Apps Script** — writes the submission to your Google Sheet and sends Gmail notification
- **Google Sheet** — existing response database:
  `ChefHire - GHL Client Onboarding Responses`

This keeps the Google Apps Script URL and shared secret out of the browser.

## Google Sheet + Gmail configuration

The repository does **not** store your Google Sheet ID or notification email. Configure both as Google Apps Script Script Properties.

Default sheet tab: `Responses`

---

# 1. Set up the Google Apps Script backend

1. Open https://script.google.com/
2. Create a **New project**
3. Replace the default code with `apps-script/Code.gs`
4. Open **Project Settings**
5. Under **Script Properties**, create:

   - `FORM_SHARED_SECRET` — a long random secret (at least 32 characters)
   - `SPREADSHEET_ID` — the destination Google Sheet ID
   - `NOTIFY_EMAIL` — the email that should receive submission alerts
   - `SHEET_NAME` — optional; defaults to `Responses`

6. Save.
7. Click **Deploy → New deployment**
8. Type: **Web app**
9. Execute as: **Me**
10. Who has access: **Anyone**
11. Deploy and approve the requested Google permissions.
12. Copy the generated Web App URL. It normally ends in `/exec`.

The script runs as your Google account, so it can write to your Sheet and send the notification email from Gmail.

---

# 2. Put the code in GitHub

Create a new repository such as:

`chefhire-onboarding`

Upload this project preserving the folder structure.

Recommended: keep the repository private until you're comfortable making it public.

---

# 3. Deploy through Cloudflare Pages

1. Cloudflare Dashboard → **Workers & Pages**
2. Create application → **Pages → Connect to Git**
3. Select the `chefhire-onboarding` repository
4. Framework preset: **None**
5. Build command: leave blank
6. Build output directory: `public`
7. Deploy

The `/functions` directory is automatically deployed as Cloudflare Pages Functions.

---

# 4. Add Cloudflare environment variables

In your Pages project:

**Settings → Variables and Secrets**

Add:

### `APPS_SCRIPT_URL`
The Apps Script `/exec` URL created in Step 1.

### `FORM_SHARED_SECRET`
The exact same secret stored in Apps Script Project Settings.

Use encrypted/secrets where Cloudflare allows it.

After adding variables, redeploy the project.

---

# 5. Test

Open the Cloudflare Pages URL and submit the form.

Expected result:

1. User sees a success screen.
2. A new row appears in the `Responses` tab.
3. `CRM Setup Status` is automatically set to `New`.
4. The email configured in `NOTIFY_EMAIL` receives a notification.
5. The email contains a button linking to the response Sheet.

---

## Why Cloudflare Pages instead of only GitHub Pages?

GitHub Pages is static hosting only. It cannot safely store secrets or run a backend.

Cloudflare Pages gives us a server-side Function at `/api/submit`, so:

- the Apps Script URL isn't exposed to the visitor,
- the shared secret isn't exposed in browser JavaScript,
- server-side validation can reject bad submissions,
- later we can add Cloudflare Turnstile, rate limiting or custom domains.

GitHub is still ideal as the source-code repository, while Cloudflare handles the live deployment.

---

## Folder structure

```text
chefhire-onboarding/
├─ public/
│  ├─ index.html
│  ├─ styles.css
│  └─ app.js
├─ functions/
│  └─ api/
│     └─ submit.js
├─ apps-script/
│  └─ Code.gs
└─ README.md
```

## Future improvements

The same app can later become a reusable agency onboarding system by moving the client-specific questions into a configuration file. It can then generate a different onboarding flow for each new GHL client while writing all submissions to a central database.
