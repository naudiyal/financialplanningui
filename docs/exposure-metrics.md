# Exposure Metrics Logic

This document describes how the UI computes the *exposure* metrics.

## Field Mapping (UI)

- **Current Cycle Stmt Cycled?** → `creditAccounts[i].statementCycledAfterPayment`
- **Paid** → `creditAccounts[i].paidThisMonth`
- **Latest Stmt Balance** → `creditAccounts[i].lastStatementBalance`
- **Total Due** → `creditLimit - availableCredit`
- **Next Stmt Balance** → `getCreditMetrics(account, cycleStartDate).nextMonthStatementBalance`

## Debit Expense Paid Semantics

- Debit expense rows now also have a `Paid` checkbox in the UI.
- For debit expenses, `Paid` is implemented by controlling `e.current`:
  - checking `Paid` sets `e.current = 0`
  - unchecking `Paid` restores `e.current = e.next`
- If an older saved debit expense row does not contain an explicit `paid` flag yet, the UI/API infer it from the current amount:
  - `e.current == 0` means checked
  - otherwise unchecked

## Next Cycle Exposure

```text
Next Cycle Exposure = NextCycleExposureCredit + DebitCardExpensesNext

DebitCardExpensesNext
  = SUM(for each debit expense row e) e.next

NextCycleExposureCredit
  = SUM(for each credit account a) CreditContribution(a)

CreditContribution(a) =
  IF a.CurrentCycleStmtCycled? == true and a.Paid == false:
      NextStmtBalance(a)
  else IF a.CurrentCycleStmtCycled? == true:
      LatestStmtBalance(a)
  ELSE IF a.Paid == true:
      TotalDue(a)
  ELSE:
      NextStmtBalance(a)

Definitions:
- TotalDue(a) = a.creditLimit - a.availableCredit
- LatestStmtBalance(a) = a.lastStatementBalance
- NextStmtBalance(a) = getCreditMetrics(a, cycleStartDate).nextMonthStatementBalance
```

## Current Cycle Exposure (for reference)

```text
Current Cycle Exposure = UnpaidStmtBalancesCurrent + DebitCardExpensesCurrent + AdditionalPayments

UnpaidStmtBalancesCurrent
  = SUM(for each credit account a) (a.Paid == true ? 0 : LatestStmtBalance(a))

DebitCardExpensesCurrent
  = SUM(for each debit expense row e) e.current

AdditionalPayments
  = value of the "Additional Payments - Chase" input
```

## Cycle After Next Cycle Exposure (for reference)

```text
Cycle After Next Cycle Exposure = DebitCardExpensesNext + SUM(next stmt balances for accounts that are both cycled and paid)

DebitCardExpensesNext
  = SUM(for each debit expense row e) e.next

Credit portion
  = SUM(for each credit account a)
      (a.CurrentCycleStmtCycled? == true AND a.Paid == true) ? NextStmtBalance(a) : 0
```
