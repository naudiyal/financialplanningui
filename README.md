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

## What this app tracks

- Credit card available credit, statement dates, and due amounts
- Monthly income and salary transfer items
- Account balance summaries and month-end projections

## First-Time Setup And Terms

- First-time encrypted users are prompted for a 4-character alphanumeric PIN, currency, and cycle type.
- The first-time setup screen also allows exiting; exiting signs the user out (it does not reset Terms acceptance).
- The visible Terms and Conditions text is currently defined in `src/App.tsx`.

## Auth And Delete Flow

- The default unauthenticated card now uses `Register or Sign-in with Google` wording.
- Session-expired messages use the same `Register or Sign-in with Google` wording for consistency.
- When a user deletes their own tracker, they are signed out and shown a goodbye screen with an option to register or sign in again.

## Recent UI Updates

- Authenticated users no longer briefly see the app behind a blocking PIN flow; blocking PIN states render a locked shell and the app waits for plan readiness before showing finance content.
- First-time setup and PIN flows show the signed-in email address, and the first-time setup flow includes both the currency selector and cycle-type selection.
- Supported currencies were expanded beyond the original short list so the app can be used with many more global currencies.
- Shared tracker administration was expanded: admins can see tracker-owner email addresses, review each shared tracker's latest update timestamp, and delete any shared tracker when necessary.
- The user menu, help copy, and goodbye/delete experience were updated to match the current navigation and sign-in wording.

## Credit Logic

- Credit-card `Next Stmt Balance` is owned in `src/App.tsx` by `getCreditMetrics(...)`.
- Sorting, totals, charts, the credit table, and the credit tab all reuse that same helper path so the displayed values stay aligned.
- The current rules are documented in `docs/credit-next-balance-logic.md`.
- Exposure metric formulas (Current/Next/Cycle After Next) are documented in `docs/exposure-metrics.md`.

## Cycle Switching And Help

- The user menu now labels the timeline action as `Switch cycle to Start-End of Month` or `Switch cycle to Mid-Mid of Month`.
- The in-app Help dialog mock visuals were updated to match the current layout more closely: save/reset stay in the top bar, while sample/timeline/help actions live in the signed-in user menu.

## Changing Terms And Conditions

- Edit the displayed legal copy in `src/App.tsx`.
- Bump the backend version flag `app.terms.current-version` in `../FinancialPlanningApi/src/main/resources/application.properties` so users are required to accept the updated terms.
- Deploy both the UI and API together when terms text changes.
