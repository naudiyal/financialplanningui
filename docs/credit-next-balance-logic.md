# Credit Card Next Balance Logic

## Source Of Truth

- UI implementation owner: `src/App.tsx`
- Main helper: `getCreditMetrics(account, cycleStartDate)`
- Reused by sorting, totals, charts, table rows, and tab rendering so all credit views stay on the same calculation path.

## Exact Rule Provided By The User

```text
If statementDate >= cycle start date
(if paymentDate < statementDate:
    (if paidThisMonth and not statementHasCycled:
        nextBalance = totalDueForCard
    else if paidThisMonth and statementHasCycled:
        nextBalance = totalDueForCard - lastStatementBalance
    else if not paidThisMonth and not statementHasCycled:
        nextBalance = totalDueForCard
    else:
        # impossible state in your model
        nextBalance = INVALID)
else if statementDate < paymentDate:
    (if statementHasCycled and not paidThisMonth:
        nextBalance = totalDueForCard - lastStatementBalance
    else if statementHasCycled and paidThisMonth:
        nextBalance = totalDueForCard
    else if not statementHasCycled and not paidThisMonth:
        nextBalance = 0
    else:
        # impossible state in your model
        nextBalance = INVALID)
else:
    (# paymentDate == statementDate
    if statementHasCycled and paidThisMonth:
        nextBalance = totalDueForCard
    else if not statementHasCycled and not paidThisMonth:
        nextBalance = totalDueForCard - lastStatementBalance
    else if statementHasCycled and not paidThisMonth:
        nextBalance = totalDueForCard
    else:
        # not statementHasCycled and paidThisMonth
        nextBalance = totalDueForCard - lastStatementBalance)
)
else If statementDate < cycle start date
(
if statementDate < paymentDate:
    (if statementHasCycled = false and paidThisMonth = false:
        nextBalance = totalDueForCard - lastStatementBalance
    else if paidThisMonth = true and statementHasCycled = false:
        nextBalance = totalDueForCard
    else if statementHasCycled = true and paidThisMonth = true:
        nextBalance = totalDueForCard - lastStatementBalance
    else if paidThisMonth = false and statementHasCycled = true:
        nextBalance = totalDueForCard
)
else if paymentDate < statementDate: Not possible as statement date is before cycle start
else paymentDate = statementDate: Not possible as statement date is before cycle start
)
```

## Current Implementation Notes

- `totalDueForCard` is calculated as `creditLimit - availableCredit`.
- `statementHasCycled` is represented in code as `statementCycledAfterPayment`.
- The current UI keeps numeric fallbacks for impossible manual-input combinations so the app always renders safely.
- The latest accepted change in this rule set is the current-cycle branch where `statementDate < paymentDate`, `statementHasCycled = false`, and `paidThisMonth = false`; that case now returns `0`.