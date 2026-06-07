# Remaining Cash Flow This Cycle

## Purpose

The Remaining Cash Flow This Cycle chart shows how each bank's available balance changes across the rest of the active cycle.

It is a UI-only chart computed in `src/App.tsx` from the live plan state.

## Starting Balance

- Each bank line starts from that bank's current checking balance.
- The default bank starts from `checking-balance-chase`.
- Bank subsections start from their own `checkingBalance` value.

## Event Sources

Each bank line is built from dated inflow and outflow events.

### Inflows

- First Paycheck
- Second Paycheck
- Additional Income

Default bank paycheck events come from the pending `FIRST_PAYCHECK_ID` and `SECOND_PAYCHECK_ID` income item amounts plus `firstPaycheckDate` and `secondPaycheckDate`.

Subsection bank paycheck events come from:

- `biMonthlySalary`
- `firstPaycheckDate`
- `secondPaycheckDate`
- `midMonthSalaryArrived`
- `monthEndSalaryArrived`

### Outflows

- Debit card expenses assigned to that bank
- Credit card payments for the default bank using each account's `nextPaymentDate`
- Additional payments for the default bank

Past-due dated events are clamped to `today` for projection purposes.

## Ordering

- Events are sorted by date.
- For the same date, inflows are applied before outflows.
- This keeps paycheck deposits from appearing after same-day payments.

## Tooltip

Hovering a dot shows:

- first row: event label and event amount
- bank row: bank account name and that bank's available balance at that point

Current labels used for paycheck events:

- `First Paycheck`
- `Second Paycheck`

## Validation

Use `npm run build` from `FinancialPlanningUI` to validate chart changes.