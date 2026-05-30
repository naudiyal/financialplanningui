# Credit Card Next Balance Logic

## Source Of Truth

- UI implementation owner: `src/App.tsx`
- Main helper: `getCreditMetrics(account, cycleStartDate)` — **this file must match the code exactly**
- Reused by sorting, totals, charts, table rows, and tab rendering so all credit views stay on the same calculation path.

## Variables

| Variable | Source |
|---|---|
| `totalDueForCard` | `creditLimit - availableCredit` |
| `currentMonthPayment` | `paidThisMonth ? 0 : lastStatementBalance` |
| `statementDateInCurrentCycle` | `lastStatementDate >= cycleStartDate` |
| `paymentDateBeforeStatementDate` | `nextPaymentDate < lastStatementDate` |
| `statementDateBeforePaymentDate` | `lastStatementDate < nextPaymentDate` |

## Current Implementation (matches code)

```
totalDueForCard = creditLimit - availableCredit

// === CASE 1: statementDate >= cycleStartDate ===
if statementDateInCurrentCycle:

    // --- paymentDate < statementDate ---
    if paymentDateBeforeStatementDate:
        if paidThisMonth AND statementCycledAfterPayment:
            → totalDueForCard - lastStatementBalance
        else if NOT paidThisMonth AND statementCycledAfterPayment:
            // contradictory input — fall back safely
            → totalDueForCard
        else:
            // paidThisMonth + NOT cycled / NOT paid + NOT cycled
            → totalDueForCard

    // --- statementDate < paymentDate ---
    else if statementDateBeforePaymentDate:
        → totalDueForCard - lastStatementBalance          // unconditional

    // --- paymentDate == statementDate ---
    else if statementCycledAfterPayment:
        → totalDueForCard
    else:
        → totalDueForCard - lastStatementBalance

// === CASE 2: statementDate < cycleStartDate ===
else if statementDateBeforePaymentDate:      // implies paymentDate > statementDate
    if NOT cycled AND NOT paid:
        → totalDueForCard - lastStatementBalance
    else if NOT cycled AND paid:
        → totalDueForCard
    else if cycled AND paid:
        → totalDueForCard - lastStatementBalance
    else if cycled AND NOT paid:
        → totalDueForCard - lastStatementBalance
    else:
        // catch-all safety
        → totalDueForCard

// === CASE 3: fallback (paymentDate <= statementDate, pre-cycle) ===
else:
    → totalDueForCard
```

## Known Bug: Negative Next Stmt Balance

When `statementDate >= cycleStartDate` AND `statementDate < paymentDate`, the formula is `totalDueForCard - lastStatementBalance` unconditionally. This produces a negative value when `totalDueForCard < lastStatementBalance` — which happens when the user has already paid, reducing `totalDueForCard` below the statement balance. See the Chase Slate example where $905.79 − $1,047.33 = −$141.54.

To fix, clamp to `Math.max(0, totalDueForCard - lastStatementBalance)` or check `paidThisMonth` before subtracting.

## Implementation Notes

- `totalDueForCard` = `creditLimit - availableCredit`
- The code field `statementCycledAfterPayment` corresponds to the doc concept `statementHasCycled`
- The code field `paidThisMonth` corresponds to the doc concept `paidThisCycle`
- `else` branches provide safe numeric fallbacks for contradictory manual-input combinations
- This doc was last synced with the code on May 30, 2026