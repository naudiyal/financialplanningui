import React, { useState } from 'react'
import { balanceItems, creditAccounts as initialCreditAccounts, incomeItems } from './data/financialData'

const currency = (value: number) =>
  value.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

export default function App() {
  const [creditAccounts, setCreditAccounts] = useState(initialCreditAccounts)

  const updateAccount = (index: number, field: string, value: any) => {
    const updated = [...creditAccounts]
    updated[index] = { ...updated[index], [field]: value }
    setCreditAccounts(updated)
  }

  const totalAvailable = creditAccounts.reduce((sum, account) => sum + account.availableCredit, 0)
  const totalDue = creditAccounts.reduce((sum, account) => sum + account.totalDue, 0)
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
            <p>Monthly salary estimate</p>
            <strong>{currency(totalSalary)}</strong>
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
                <th>Available Credit</th>
                <th>Next Payment Date</th>
                <th>Payment Made</th>
                <th>STMT Cycled After Payment</th>
                <th>Last Statement Date</th>
                <th>Last Statement Balance</th>
                <th>Total Credit Limit</th>
                <th>Total Due</th>
                <th>Current Month Payment</th>
                <th>Next Month Statement Balance</th>
              </tr>
            </thead>
            <tbody>
              {creditAccounts.map((account, index) => {
                const totalDue = account.lastStatementBalance // Simplified calculation
                const currentMonthPayment = account.paidThisMonth ? 0 : totalDue
                const nextMonthStatementBalance = account.statementCycledAfterPayment
                  ? account.lastStatementBalance
                  : totalDue - currentMonthPayment

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
                        type="text"
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
                        type="text"
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
                <p className="card-meta">{item.month}</p>
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
                <p className="card-meta">{item.month}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
