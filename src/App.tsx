import React, { useState } from 'react'
import { balanceItems, creditAccounts as initialCreditAccounts, incomeItems } from './data/financialData'

const currency = (value: number) =>
  value.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

// Convert DD-MMM format to YYYY-MM-DD
const convertToISODate = (dateStr: string) => {
  const months: { [key: string]: string } = {
    'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04', 'May': '05', 'Jun': '06',
    'Jul': '07', 'Aug': '08', 'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
  }
  const [day, month] = dateStr.split('-')
  return `2026-${months[month]}-${day.padStart(2, '0')}`
}

// Convert YYYY-MM-DD to DD-MMM format
const convertFromISODate = (isoDate: string) => {
  const date = new Date(isoDate)
  const day = date.getDate()
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const month = monthNames[date.getMonth()]
  return `${day}-${month}`
}

export default function App() {
  const [creditAccounts, setCreditAccounts] = useState(initialCreditAccounts)

  const updateAccount = (index: number, field: string, value: any) => {
    const updated = [...creditAccounts]
    updated[index] = { ...updated[index], [field]: value }
    setCreditAccounts(updated)
  }

  const totalAvailable = creditAccounts.reduce((sum, account) => sum + account.availableCredit, 0)
  const totalDue = creditAccounts.reduce((sum, account) => sum + account.lastStatementBalance, 0)
  const totalLimits = creditAccounts.reduce((sum, account) => sum + account.creditLimit, 0)
  const totalUtilization = totalLimits > 0 ? (totalDue / totalLimits) * 100 : 0
  const averageUtilization = creditAccounts.length > 0 ? totalUtilization / creditAccounts.length : 0
  const totalMinPayments = creditAccounts.reduce((sum, account) => {
    const minPayment = Math.max(account.lastStatementBalance * 0.02, 25) // 2% or $25 minimum
    return sum + (account.paidThisMonth ? 0 : minPayment)
  }, 0)
  const totalSalary = incomeItems.find((item) => item.label === 'Total Salary Per Month')?.amount ?? 0

  return (
    <div className="app">
      <header className="hero">
        <div>
          <p className="eyebrow">Personal Finance Tracker</p>
          <h1>Financial Planning</h1>
          <p className="intro">
            Track cards, statements, payments, income, and balances from your current spreadsheet in a single dashboard.
          </p>
        </div>
        <div className="summary-grid">
          <div className="summary-card">
            <p>Total available credit</p>
            <strong>{currency(totalAvailable)}</strong>
          </div>
          <div className="summary-card">
            <p>Total current due</p>
            <strong>{currency(totalDue)}</strong>
          </div>
          <div className="summary-card">
            <p>Credit utilization</p>
            <strong>{totalUtilization.toFixed(1)}%</strong>
          </div>
          <div className="summary-card">
            <p>Min. payments due</p>
            <strong>{currency(totalMinPayments)}</strong>
          </div>
          <div className="summary-card">
            <p>Monthly salary estimate</p>
            <strong>{currency(totalSalary)}</strong>
          </div>
          <div className="summary-card">
            <p>Avg utilization</p>
            <strong>{averageUtilization.toFixed(1)}%</strong>
          </div>
        </div>
      </header>

      <section>
        <h2>Credit & Card Accounts</h2>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Account</th>
                <th>Avail Credit</th>
                <th>Pay Date</th>
                <th>Paid</th>
                <th>Stmt Cycled</th>
                <th>Stmt Date</th>
                <th>Stmt Balance</th>
                <th>Limit</th>
                <th>Due</th>
                <th>Curr Payment</th>
                <th>Next Balance</th>
                <th>Util %</th>
                <th>Min Payment</th>
              </tr>
            </thead>
            <tbody>
              {creditAccounts.map((account, index) => {
                const totalDue = account.lastStatementBalance // Simplified calculation
                const currentMonthPayment = account.paidThisMonth ? 0 : totalDue
                const nextMonthStatementBalance = account.statementCycledAfterPayment
                  ? account.lastStatementBalance
                  : totalDue - currentMonthPayment
                const utilizationPercent = account.creditLimit > 0 ? (account.lastStatementBalance / account.creditLimit) * 100 : 0
                const minPayment = account.paidThisMonth ? 0 : Math.max(account.lastStatementBalance * 0.02, 25)

                return (
                  <tr key={account.name}>
                    <td>{account.name}</td>
                    <td>
                      <input
                        type="number"
                        value={account.availableCredit}
                        onChange={(e) => updateAccount(index, 'availableCredit', parseFloat(e.target.value) || 0)}
                      />
                    </td>
                    <td>
                      <input
                        type="date"
                        value={account.nextPaymentDate}
                        onChange={(e) => updateAccount(index, 'nextPaymentDate', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={account.paidThisMonth}
                        onChange={(e) => updateAccount(index, 'paidThisMonth', e.target.checked)}
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={account.statementCycledAfterPayment}
                        onChange={(e) => updateAccount(index, 'statementCycledAfterPayment', e.target.checked)}
                      />
                    </td>
                    <td>
                      <input
                        type="date"
                        value={account.lastStatementDate}
                        onChange={(e) => updateAccount(index, 'lastStatementDate', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={account.lastStatementBalance}
                        onChange={(e) => updateAccount(index, 'lastStatementBalance', parseFloat(e.target.value) || 0)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={account.creditLimit}
                        onChange={(e) => updateAccount(index, 'creditLimit', parseFloat(e.target.value) || 0)}
                      />
                    </td>
                    <td>{currency(totalDue)}</td>
                    <td>{currency(currentMonthPayment)}</td>
                    <td>{currency(nextMonthStatementBalance)}</td>
                    <td>{utilizationPercent.toFixed(1)}%</td>
                    <td>{currency(minPayment)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="split-section">
        <section>
          <h2>Income Schedule</h2>
          <div className="card-list">
            {incomeItems.map((item) => (
              <article key={item.label} className="info-card">
                <p className="card-title">{item.label}</p>
                <p className="card-value">{currency(item.amount)}</p>
                {item.month ? <p className="card-meta">{item.month}</p> : null}
                {item.note ? <p className="card-note">{item.note}</p> : null}
              </article>
            ))}
          </div>
        </section>

        <section>
          <h2>Balance Summary</h2>
          <div className="card-list">
            {balanceItems.map((item) => (
              <article key={item.label} className="info-card">
                <p className="card-title">{item.label}</p>
                <p className="card-value">{currency(item.amount)}</p>
                {item.month ? <p className="card-meta">{item.month}</p> : null}
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
