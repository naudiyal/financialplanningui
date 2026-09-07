# Paycheck Model

This document describes how paycheck (salary) dates and amounts are modeled at the bank account level in the web UI, backend, and mobile apps.

## Bank Accounts

Bank accounts are modeled as `IncomeSubsection` records (backend) / `IncomeSubsection` type (frontend), plus the **default bank** which lives on the top-level `FinancialPlanData` record and uses `incomeItems` to track paycheck state.

Each bank account has:

- `Paycheck Amount` (label, formerly "Bi-monthly salary") — the per-paycheck amount stored in `biMonthlySalary`. A single amount is reused for every paycheck.
- `1st Paycheck Arrived?` — `firstPaycheckDate` / `midMonthSalaryArrived` (subsections) or `first-paycheck` income item (default bank).
- `2nd Paycheck Arrived?` — `secondPaycheckDate` / `monthEndSalaryArrived` (subsections) or `second-paycheck` income item (default bank).
- `3rd Paycheck Arrived?` (optional) — `thirdPaycheckDate` / `thirdPaycheckArrived` (subsections) or `third-paycheck` income item + `thirdPaycheckDate` (default bank).
- `Additional Paycheck Expected Next Month?` — `additionalPaycheckExpectedNextMonth` boolean (subsections) or top-level `additionalPaycheckExpectedNextMonth` (default bank).

## Paycheck Labels

- Paycheck labels were renamed from "First/Second/Third Paycheck Arrived?" to "1st/2nd/3rd Paycheck Arrived?".
- The salary amount label was renamed from "Bi-monthly salary" to "Paycheck Amount".

## 3rd Paycheck (Optional, Date-Driven)

People do not receive a 3rd paycheck every month. The **3rd paycheck date is the single source of truth** for whether a 3rd paycheck exists in a given cycle:

- **No 3rd paycheck date** → no 3rd paycheck that month; it contributes `0` to Total Balance regardless of the "arrived" checkbox state.
- **3rd paycheck date set + "arrived" unchecked** → adds one `Paycheck Amount` (`biMonthlySalary`) to Total Balance.
- **3rd paycheck date set + "arrived" checked** → contributes `0` (already received, already reflected in the account balance).

The default bank encodes the "arrived" state in the `third-paycheck` income item amount (`0` = arrived, `biMonthlySalary` = not-arrived), mirroring the 1st/2nd paycheck convention.

## Additional Paycheck Expected Next Month

- When checked, adds one `Paycheck Amount` (`biMonthlySalary`) to next-cycle salary funding (used by the "Savings Next Cycle" tile).
- This is independent of the 3rd paycheck (this month).

## Cross-Account Synchronization

- Setting a paycheck **date** on any bank account applies the same date to all other bank accounts with a non-zero `Paycheck Amount`, and to the default bank (when the default bank has a salary). A transient toast ("Paycheck date applied to all other salary accounts.") confirms this.
- Checking/unchecking **"Additional Paycheck Expected Next Month?"** on any bank account (including the default bank) applies the same value to all other bank accounts.

## Balance and Funding Calculations

### Total Balance

- **Subsections**: `startingBalance = checkingBalance + (1st pending) + (2nd pending) + (3rd pending)`, then `totalBalance = startingBalance - additionalPayments`.
  - The 3rd paycheck is only "pending" when a 3rd paycheck date exists and it is not arrived.
- **Default bank**: `totalBalance = firstPaycheck + secondPaycheck + thirdPaycheck + checkingBalance - additionalPayments`, where the 3rd paycheck is gated on the 3rd paycheck date existing.

### Savings Next Cycle

- Funding = salary transfer to the default bank (`biMonthlySalary * 2`) + other banks (`biMonthlySalary * 2` each), plus one extra `biMonthlySalary` for every bank (default or subsection) whose "Additional Paycheck Expected Next Month?" is checked.

## Tile Renames

- "Current Cycle Exposure" → "Current Cycle Expenses"
- "Next Cycle Exposure" → "Next Cycle Expenses"
- "Cycle After Next Cycle Exposure" → "Cycle After Next Cycle Expenses"

## Column Rename

- Credit Card Accounts column "Stmt for Next Cycle Pymnt Cycled?" → "Next cycle stmt generated?"

## Backend Notes

- `IncomeSubsection.java` and `FinancialPlanData.java` gained the new fields (`thirdPaycheckDate`, `thirdPaycheckArrived`, `additionalPaycheckExpectedLabel`, `additionalPaycheckExpectedNextMonth` for subsections; `thirdPaycheckDate`, `additionalPaycheckExpectedNextMonth` for the default bank).
- `FinancialPlanStorageService.java` normalizes the new fields and `FinancialPlanCalculationService.java` gates the 3rd paycheck contribution on the date, matching the frontend behavior.
