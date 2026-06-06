# Notification System

Notifications alert users to upcoming and overdue financial events, derived automatically from plan data.

## Notification Types

| Type | Trigger | Icon | Severity |
|------|---------|------|----------|
| **Credit Card Payment Due** | Card not marked paid, payment date within 5 days, balance > $0 | 💳 / 🚨 | info → warning → danger |
| **Debit Expense Due** | Expense not marked paid, due within 5 days, amount > $0 | 📋 / 🚨 | info → warning → danger |
| **Bank Negative Balance** | Projected balance drops below threshold or goes negative | 🏦 / 🚨 | warning / danger |
| **Cycle Close Reminder** | Cycle ends within 3 days (or blocked from closing) | 🔄 / 🚨 | info / warning |

## Severity Levels

- **info** (blue) — Upcoming, 3–5 days out
- **warning** (amber) — Due within 2 days, or balance below threshold
- **danger** (red) — Past due / overdue, or balance goes negative

## Display Locations

### 1. Notification Badge (User Chip)
- Circle with count next to user name/email in top-right header
- **Yellow** (`#f59e0b`) when no overdue items exist
- **Red** (`#dc2626`) when any past-due notifications exist
- Pulsing animation in both states

### 2. Notification Banner (Dashboard Top)
- Always visible when notifications exist
- **Collapsed** (yellow/amber bar): summary only — shows count + "View All →" when no overdue items
- **Expanded** (red bar): shows up to 3 overdue items inline when past-due notifications exist

### 3. Notifications Menu Item
- In the user dropdown menu, between "Delete User Tracker" and "Sign Out"
- Highlighted when notifications exist
- Shows count: `Notifications (N)`

### 4. Notification Panel Modal
- Full modal listing all notifications
- Danger items get red background, 🚨 icon, and "OVERDUE" text badge
- Non-danger items use kind-specific icons (💳 📋 🏦 🔄) and neutral styling
- Click backdrop or "Close" to dismiss

## Derivation Rules

- All date comparisons use the **browser's local timezone** (consistent with the `isPastDate` function used for red checkbox styling)
- Credit cards with `paidThisMonth = true` are skipped
- Credit cards with `lastStatementBalance = $0` are skipped entirely (notifications, Overdue Cards tile, and overdue analytics)
- Expenses with `paid = true` or `current = $0` are skipped
- Payment date must be within 5 days of today (past or future)
- Balance warnings come from the existing `buildBankNegativeBalanceWarning` function
- Cycle close is only suggested when `canCloseCurrentCycle` is true

## Files

- `src/App.tsx` — Types, derivation logic, state, badge, banner, menu item, panel modal
- `src/index.css` — Badge animation, banner (collapsed + danger), panel styling, severity colors
