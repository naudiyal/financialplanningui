# Close Cycle Behavior

## Purpose

The Close Cycle action archives the current cycle as previous, replaces any existing previous cycle, and rolls the tracker forward into a new current cycle.

This behavior is implemented in `src/App.tsx`.

## Button Behavior

- The Close Cycle button remains clickable even when the action is not currently available.
- If the requirements are satisfied, clicking the button opens the normal close-cycle confirmation dialog.
- If the requirements are not satisfied, clicking the button opens a popup titled `Close Cycle Not Available` that lists the unmet requirements.
- The button no longer uses a grayed-out visual disabled state for the unavailable case.

## Close Cycle Requirements

Close Cycle is available only when all of the following are true:

- All credit cards are marked paid.
- All statements for next cycle payments must cycle, meaning `Stmt for Next Cycle Pymnt Cycled?` checkboxes are checked.
- All debit card expenses are marked paid.
- All banks with bi-weekly salary have both paycheck dates entered.
- All banks with bi-weekly salary have both paycheck checkboxes completed.

## Salary-Specific Paycheck Rule

- Banks without bi-weekly salary are excluded from the paycheck-date and paycheck-checkbox requirements.
- For the default bank, paycheck completion comes from the `First Paycheck` and `Second Paycheck` checkbox-backed income items.
- For bank subsections, paycheck completion comes from `midMonthSalaryArrived` and `monthEndSalaryArrived`.

## Popup Content

When Close Cycle is not available, the popup lists the unmet requirements so the user can resolve them directly from the tracker.

The popup title is:

- `Close Cycle Not Available`

## Validation

Use `npm run build` from `FinancialPlanningUI` to validate Close Cycle UI changes.