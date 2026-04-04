import React from 'react'
import { balanceItems, creditAccounts, incomeItems } from './data/financialData'

const currency = (value: number) =>
  value.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

export default function App() {
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
                <th>Available</th>
                <th>Pay Date</th>
                <th>Paid</th>
                <th>Statement</th>
                <th>Last Balance</th>
                <th>Limit</th>
                <th>Current Due</th>
                <th>Current Payment</th>
                <th>Next Balance</th>
              </tr>
            </thead>
            <tbody>
              {creditAccounts.map((account) => (
                <tr key={account.name}>
                  <td>{account.name}</td>
                  <td>{currency(account.availableCredit)}</td>
                  <td>{account.nextPaymentDate}</td>
                  <td>{account.paidThisMonth ? 'Yes' : 'No'}</td>
                  <td>{account.statementCycledAfterPayment ? 'Yes' : 'No'}</td>
                  <td>{currency(account.lastStatementBalance)}</td>
                  <td>{currency(account.creditLimit)}</td>
                  <td>{currency(account.totalDue)}</td>
                  <td>{currency(account.currentMonthPayment)}</td>
                  <td>{currency(account.nextMonthStatementBalance)}</td>
                </tr>
              ))}
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
