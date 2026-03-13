# Phone-Primary + Email Magic Link Rollout Guide

This guide starts from Firebase Console provider setup and continues to production rollout.

## 1) Enable Email Magic Link in Firebase Console

1. Open Firebase Console -> Authentication -> Sign-in method.
2. Click `Add new provider`.
3. Choose `Email/Password`.
4. Enable `Email link (passwordless sign-in)`.
5. Save.

Notes:
- Keep your app UI phone-first. Enabling this provider does not force email as primary.
- Phone provider can remain enabled as-is.

## 2) Set Authorized Domains (required for email links)

1. Go to Authentication -> Settings -> Authorized domains.
2. Add every domain that may open the magic link:
   - Production: `getgoph.com`, `www.getgoph.com`, `getgoph.web.app`, and/or your custom domain.
   - Staging domain (if used).
   - Local development: `localhost` and `127.0.0.1`.

If a domain is missing, email-link completion fails.

## 2.1) Set Canonical Callback URL for Email Links

Use a single callback domain so magic links always return to the same host.

1. In frontend production env, set:
   - `VITE_SITE_URL=https://getgoph.com`
   - Optional explicit override: `VITE_MAGIC_LINK_CALLBACK_URL=https://getgoph.com`
2. Keep Firebase Auth project/domain as configured (`karga-ph`) and let Firebase handle the `__/auth/action` redirect.

## 2.2) Prevent Service Worker from Intercepting Firebase Reserved Routes

Firebase Auth uses reserved routes under `__/` (for example `__/auth/action`).
Your PWA Workbox config must denylist these routes from `navigateFallback`.

Required setting:

```js
navigateFallbackDenylist: [/^\/api/, /^\/__\//]
```

Without this, magic-link clicks can be routed to `offline.html` instead of Firebase Auth handler pages.

## 3) Deploy Backend and Rules with Feature Flag OFF

Keep backend email-link callable gated first.

1. In `functions/.env.karga-ph`, set:
   - `EMAIL_MAGIC_LINK_ENABLED=false`
2. Deploy:

```bash
firebase use karga-ph
firebase deploy --only functions,firestore:rules
```

## 4) Run One-Time Non-Admin Cleanup Migration

This resets email-auth state for non-admin test users and preserves admin users.

From `functions/`:

```bash
npm run migrate:email-auth:dry
npm run migrate:email-auth:apply
```

Recommended:
- Confirm dry-run output before apply.
- If needed, export Firestore before apply.

## 5) Deploy Frontend with Feature Flag OFF

Set frontend flag off in your production env:
- `VITE_ENABLE_EMAIL_MAGIC_LINK=false`

Build and deploy hosting:

```bash
cd frontend
npm run build
cd ..
firebase deploy --only hosting
```

At this point code is live but email fallback is hidden/disabled.

## 6) Internal Verification (Enable Flags)

Enable both flags:
- Backend: `EMAIL_MAGIC_LINK_ENABLED=true` (functions env)
- Frontend: `VITE_ENABLE_EMAIL_MAGIC_LINK=true` (frontend prod env)

Redeploy:

```bash
firebase deploy --only functions,hosting
```

## 7) Verify Expected Behavior

1. Auth modal default remains phone OTP.
2. `Use email instead` appears as secondary path.
3. Profile -> Backup Email Login:
   - status transitions (`Not configured` -> `Pending` -> `Enabled`)
4. Disable backup email blocks future magic-link sends.
5. Invalid/expired links fail safely.
6. Clicking a magic link no longer lands on offline fallback page.
7. `continueUrl` host in the auth link resolves to `https://getgoph.com` (canonical).
8. For Facebook/Gmail/other in-app browsers, if completion is unstable, open the link in Chrome/Safari.

## 8) Run Regression Tests

```bash
npx playwright test tests/e2e/auth/login-register-logout.spec.js --project=chromium
```

Expected: full auth suite passes with phone flow unaffected.

## 9) Roll Out to All Users

After internal verification, keep flags ON and monitor auth errors/logs.

## 10) Firebase Console Branding Step

To align user-facing copy with GetGo while keeping the current Firebase Auth project:

1. Firebase Console -> Authentication -> Templates.
2. Update subject/body text for email-link template to GetGo branding.
3. Keep technical sender host/domain as provided by Firebase project configuration.
