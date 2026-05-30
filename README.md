# financialplanning

A React + TypeScript dashboard for tracking credit card balances, payments, statements, income, and account balances.

The UI also owns the visible Terms and Conditions copy shown after sign-in when acceptance is required.

## Setup

```bash
cd FinancialPlanningUI
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

A local run helper is also available:

```powershell
.\run-local-ui.bat
```

This script stops any existing process on port 5173, runs `npm run build`, then starts the Vite dev server.

## PWA (Progressive Web App)

The UI is configured as an installable PWA using `vite-plugin-pwa`. The generated service worker precaches all static assets for offline support and faster repeat loads.

**Installing on a phone:**

- **iPhone:** Open `https://mybetterbudget.com` in Safari, tap Share → "Add to Home Screen" → "Add". The app opens full-screen like a native app.
- **Android:** Open in Chrome, tap the install banner or menu → "Install app". The app appears on the home screen and in the app drawer.

**PWA assets (in `public/`):**

| File | Purpose |
|------|---------|
| `favicon.svg` | Browser tab icon |
| `manifest.json` | PWA manifest (name, icons, theme color, display mode) |
| `pwa-192x192.png` | Small home-screen icon |
| `pwa-512x512.png` | Large home-screen icon |
| `pwa-icon-source.svg` | Source SVG for regenerating icons |

To regenerate the PNG icons, run:

```powershell
node scripts/create-pwa-icons.js
```

For production-quality icons, upload `public/pwa-icon-source.svg` to [maskable.app](https://maskable.app/) and replace the generated PNGs.

## What this app tracks

- Credit card available credit, statement dates, and due amounts
- Debit-card expenses, including whether a current-cycle debit expense has already been paid
- Monthly income and salary transfer items
- Account balance summaries and month-end projections

## First-Time Setup And Terms

- First-time encrypted users are prompted for a 4-character alphanumeric PIN, currency, and cycle type.
- The first-time setup screen also allows exiting; exiting signs the user out (it does not reset Terms acceptance).
- Returning encrypted users now also see a `Sign Out` option in the post-login `Enter Encryption Key` prompt, so they can leave the account before unlocking data.
- The visible Terms and Conditions text is currently defined in `src/App.tsx`.

## Auth And Delete Flow

- The default unauthenticated card now uses `Register or Sign-in with Google` wording.
- Session-expired messages use the same `Register or Sign-in with Google` wording for consistency.
- After Google sign-in, the UI now exchanges the browser session for a tab-scoped auth token and stores it in `sessionStorage`.
- Authenticated API requests now send `Authorization: Bearer <tab token>`, so separate tabs or windows in the same browser profile can stay signed into different accounts.
- Personal save and cycle-mutation requests also send the signed-in Google `userSub`; if the backend detects that the tab is trying to write for a different identity, it rejects the request instead of saving into the wrong account.
- When a user deletes their own tracker, they are signed out and shown a goodbye screen with an option to register or sign in again.

## Recent UI Updates

- Authenticated users no longer briefly see the app behind a blocking PIN flow; blocking PIN states render a locked shell and the app waits for plan readiness before showing finance content.
- First-time setup and PIN flows show the signed-in email address, and the first-time setup flow includes both the currency selector and cycle-type selection.
- Supported currencies were expanded beyond the original short list so the app can be used with many more global currencies.
- Shared tracker administration was expanded: admins can see tracker-owner email addresses, review each shared tracker's latest update timestamp, and delete any shared tracker when necessary.
- In the Trackers view, selecting a user immediately attempts to open that tracker. If that tracker is encrypted, the admin is prompted for that tracker's 4-character Encryption Key before any data is shown.
- Cycle visibility is now tiered by user type: regular users see the active cycle plus the latest closed cycle, while premium users can view up to 12 closed cycles in addition to the current cycle.
- Admins can change any user's type between `Regular` and `Premium` from the signed-in user menu via `Change User Type`; the same search flow also allows an admin to update their own account.
- `Change User Type` and `Delete User Tracker` both use the same debounced email-search flow, and each dialog now shows at most 10 matching email suggestions after the user pauses typing.
- Admins can also open `Delete User Tracker` from the signed-in user menu, search by email, confirm first and last name, and permanently delete a user's saved tracker data from the same admin search flow. Deleting another user's tracker from the personal view does not clear the admin's own loaded tracker data.
- Debit Card Expenses now include a `Paid` checkbox. Checking it forces that row's `Current Month Payment` to `0`. Unchecking restores `Current Month Payment` from that row's `Next Month Payment`. When older saved data does not have an explicit `Paid` flag yet, the UI infers it from whether `Current Month Payment` is `0`.
- On phones, unsaved changes now surface a sticky bottom `Save Changes` / `Reset` action bar only after the original top action buttons have scrolled out of view, so users do not lose quick access while editing deep in the page.
- Tapping a shared dollar-value input now places the caret at the end of the formatted amount so users can append or replace values from the cents side more predictably on mobile.
- The user menu, help copy, and goodbye/delete experience were updated to match the current navigation and sign-in wording.

## Cycle History And Revert

- Premium history support keeps full closed-cycle snapshots so premium users can open older closed cycles directly from the cycle selector.
- The `Change in Bank Balance` chart now prefetches every visible closed cycle on load, so premium users see all visible cycle points immediately instead of only after opening older cycles manually.
- When viewing any closed cycle, the tracker remains read-only for financial data, but users can still switch between table and tab layouts and click across credit, debit, and bank tabs locally without saving those view changes.
- Revert remains a one-step rollback of the most recent close-cycle action only; it does not revert directly to an arbitrary older closed cycle.

## Credit Logic

- Credit-card `Next Stmt Balance` is owned in `src/App.tsx` by `getCreditMetrics(...)`.
- Sorting, totals, charts, the credit table, and the credit tab all reuse that same helper path so the displayed values stay aligned.
- The current rules are documented in `docs/credit-next-balance-logic.md`.
- Exposure metric formulas (Current/Next/Cycle After Next) are documented in `docs/exposure-metrics.md`.

## Debit Expense Logic

- Debit expense `Paid` is a persisted row field, not just a temporary display toggle.
- The current-cycle debit exposure math still uses the row's `Current Month Payment`; the checkbox is a convenience control that updates that amount consistently.
- Legacy saved rows that predate the `Paid` field are normalized by treating `Current Month Payment = 0` as paid.

## Cycle Switching And Help

- The user menu now labels the timeline action as `Switch cycle to Start-End of Month` or `Switch cycle to Mid-Mid of Month`.
- The in-app Help dialog mock visuals were updated to match the current layout more closely: save/reset stay in the top bar, while sample/timeline/help actions live in the signed-in user menu.

## Changing Terms And Conditions

- Edit the displayed legal copy in `src/App.tsx`.
- Bump the backend version flag `app.terms.current-version` in `../FinancialPlanningApi/src/main/resources/application.properties` so users are required to accept the updated terms.
- Deploy both the UI and API together when terms text changes.
