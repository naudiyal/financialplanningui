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
- The first-time setup screen also allows exiting; that exit resets accepted terms and signs the user out so they must accept terms again on the next login.
- The visible Terms and Conditions text is currently defined in `src/App.tsx`.

## Changing Terms And Conditions

- Edit the displayed legal copy in `src/App.tsx`.
- Bump the backend version flag `app.terms.current-version` in `../FinancialPlanningApi/src/main/resources/application.properties` so users are required to accept the updated terms.
- Deploy both the UI and API together when terms text changes.
