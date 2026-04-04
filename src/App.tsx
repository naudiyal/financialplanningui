import React, { useEffect, useState } from 'react'
import {
  BalanceItem,
  balanceItems as initialBalanceItems,
  ColumnLabel,
  CreditAccount,
  creditAccounts as initialCreditAccounts,
  defaultColumnLabels,
  defaultIncomeSubsections,
  defaultSectionTitles,
  FinancialPlanColumnLabels,
  FinancialPlanSectionTitles,
  IncomeSubsection,
  IncomeItem,
  incomeItems as initialIncomeItems,
} from './data/financialData'

type ExpenseItem = {
  id: string
  label: string
  payDate: string
  current: number
  next: number
}

type FinancialPlanData = {
  creditAccounts: CreditAccount[]
  incomeItems: IncomeItem[]
  balanceItems: BalanceItem[]
  planoExpenses: ExpenseItem[]
  sanfordExpenses: ExpenseItem[]
  otherExpenses: ExpenseItem[]
  columnLabels?: FinancialPlanColumnLabels
  sectionTitles?: FinancialPlanSectionTitles
  incomeSubsections?: IncomeSubsection[]
  summary?: Record<string, number>
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'

const convertToISODate = (dateStr: string) => {
  const months: Record<string, string> = {
    Jan: '01',
    Feb: '02',
    Mar: '03',
    Apr: '04',
    May: '05',
    Jun: '06',
    Jul: '07',
    Aug: '08',
    Sep: '09',
    Oct: '10',
    Nov: '11',
    Dec: '12',
  }
  const [day, month] = dateStr.split('-')
  return `2026-${months[month]}-${day.padStart(2, '0')}`
}

const currency = (value: number) =>
  value.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

const getHeaderInputWidth = (label: string, minChars = 8) => `${Math.max(label.length + 2, minChars)}ch`

const initialPlanoExpenses: ExpenseItem[] = [
  { id: 'plano-water', label: 'Water (Chase)', payDate: convertToISODate('24-Mar'), current: 0, next: 87.94 },
  { id: 'plano-internet-att', label: 'Internet ATT(Chase)', payDate: convertToISODate('19-Mar'), current: 0, next: 42.43 },
  { id: 'plano-hoa', label: 'HOA (Chase)', payDate: convertToISODate('11-Apr'), current: 355, next: 355 },
  { id: 'plano-electricity', label: 'Electricity (WellsFargo CC Tran)', payDate: convertToISODate('14-Apr'), current: 111, next: 111 },
]

const initialSanfordExpenses: ExpenseItem[] = [
  { id: 'sanford-water', label: 'Water (Chase)', payDate: convertToISODate('19-Mar'), current: 0, next: 90.48 },
  { id: 'sanford-electricity', label: 'Electricity (Chase)', payDate: convertToISODate('19-Mar'), current: 0, next: 188.82 },
  { id: 'sanford-internet-att', label: 'Internet ATT (Chase)', payDate: convertToISODate('24-Mar'), current: 0, next: 64.87 },
  { id: 'sanford-hoa-quarterly', label: 'HOA -($628.64/Qtr) (Chase)', payDate: convertToISODate('7-Apr'), current: 628.64, next: 0 },
]

const initialOtherExpenses: ExpenseItem[] = [
  { id: 'other-att-mobile', label: 'ATT - Mobile (Chase)', payDate: convertToISODate('4-Apr'), current: 65.35, next: 65.35 },
  { id: 'other-529-college-savings', label: '529 College Savings', payDate: convertToISODate('5-Apr'), current: 0, next: 0 },
  { id: 'other-geico-car-insurance', label: 'Geico Car Insurance (WellsFargo CC Tran)', payDate: convertToISODate('9-Apr'), current: 328.58, next: 328.58 },
]

type ExpenseGroupConfig = {
  title: string
  prefix: string
  items: ExpenseItem[]
  setter: React.Dispatch<React.SetStateAction<ExpenseItem[]>>
}

const sumExpenses = (items: ExpenseItem[], field: 'current' | 'next') =>
  items.reduce((sum, item) => sum + item[field], 0)

export default function App() {
  const [creditAccounts, setCreditAccounts] = useState(initialCreditAccounts)
  const [incomeItemsState, setIncomeItemsState] = useState(initialIncomeItems)
  const [balanceItemsState, setBalanceItemsState] = useState(initialBalanceItems)
  const [planoExpenses, setPlanoExpenses] = useState(initialPlanoExpenses)
  const [sanfordExpenses, setSanfordExpenses] = useState(initialSanfordExpenses)
  const [otherExpenses, setOtherExpenses] = useState(initialOtherExpenses)
  const [columnLabels, setColumnLabels] = useState(defaultColumnLabels)
  const [sectionTitles, setSectionTitles] = useState(defaultSectionTitles)
  const [incomeSubsections, setIncomeSubsections] = useState(defaultIncomeSubsections)
  const [selectedCreditIds, setSelectedCreditIds] = useState<Set<string>>(new Set())
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<Set<string>>(new Set())
  const [saveState, setSaveState] = useState<'idle' | 'loading' | 'saving' | 'saved' | 'error'>('loading')
  const [saveMessage, setSaveMessage] = useState('Loading saved plan...')

  useEffect(() => {
    let isMounted = true

    const applyFinancialPlan = (data: FinancialPlanData) => {
      setCreditAccounts(data.creditAccounts)
      setIncomeItemsState(data.incomeItems)
      setBalanceItemsState(data.balanceItems)
      setPlanoExpenses(data.planoExpenses)
      setSanfordExpenses(data.sanfordExpenses)
      setOtherExpenses(data.otherExpenses)
      setColumnLabels(data.columnLabels ?? defaultColumnLabels)
      setSectionTitles(data.sectionTitles ?? defaultSectionTitles)
      setIncomeSubsections(data.incomeSubsections ?? defaultIncomeSubsections)
    }

    const loadFinancialPlan = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/financial-plan`)
        if (!response.ok) {
          throw new Error(`Failed to load financial plan: ${response.status}`)
        }

        const data: FinancialPlanData = await response.json()
        if (!isMounted) {
          return
        }

        applyFinancialPlan(data)
        setSaveState('idle')
        setSaveMessage('Loaded saved plan')
      } catch {
        if (!isMounted) {
          return
        }

        setSaveState('error')
        setSaveMessage('API unavailable. Using local defaults.')
      }
    }

    void loadFinancialPlan()

    return () => {
      isMounted = false
    }
  }, [])

  const updateAccount = (index: number, field: string, value: number | string | boolean) => {
    const updated = [...creditAccounts]
    updated[index] = { ...updated[index], [field]: value }
    setCreditAccounts(updated)
  }

  const updateIncomeItem = (index: number, amount: number) => {
    const updated = [...incomeItemsState]
    updated[index] = { ...updated[index], amount }
    setIncomeItemsState(updated)
  }

  const updateIncomeItemById = (id: string, amount: number) => {
    setIncomeItemsState((current) =>
      current.map((item) => (item.id === id ? { ...item, amount } : item)),
    )
  }

  const updateIncomeLabel = (index: number, label: string) => {
    const updated = [...incomeItemsState]
    updated[index] = { ...updated[index], label }
    setIncomeItemsState(updated)
  }

  const updateBalanceItem = (index: number, amount: number) => {
    const updated = [...balanceItemsState]
    updated[index] = { ...updated[index], amount }
    setBalanceItemsState(updated)
  }

  const updateBalanceLabel = (index: number, label: string) => {
    const updated = [...balanceItemsState]
    updated[index] = { ...updated[index], label }
    setBalanceItemsState(updated)
  }

  const updateExpenseItem = (
    setter: React.Dispatch<React.SetStateAction<ExpenseItem[]>>,
    items: ExpenseItem[],
    index: number,
    field: 'current' | 'next' | 'payDate',
    value: number | string,
  ) => {
    const updated = [...items]
    updated[index] = { ...updated[index], [field]: value }
    setter(updated)
  }

  const updateExpenseLabel = (
    setter: React.Dispatch<React.SetStateAction<ExpenseItem[]>>,
    items: ExpenseItem[],
    index: number,
    label: string,
  ) => {
    const updated = [...items]
    updated[index] = { ...updated[index], label }
    setter(updated)
  }

  const updateColumnLabel = (tableKey: keyof FinancialPlanColumnLabels, index: number, label: string) => {
    setColumnLabels((current) => {
      const updatedLabels = [...current[tableKey]]
      updatedLabels[index] = { ...updatedLabels[index], label }
      return {
        ...current,
        [tableKey]: updatedLabels,
      }
    })
  }

  const updateSectionTitle = (sectionKey: keyof FinancialPlanSectionTitles, value: string) => {
    setSectionTitles((current) => ({
      ...current,
      [sectionKey]: value,
    }))
  }

  const updateIncomeSubsectionTitle = (index: number, title: string) => {
    setIncomeSubsections((current) => {
      const updated = [...current]
      updated[index] = { ...updated[index], title }
      return updated
    })
  }

  const updateIncomeSubsection = <K extends keyof IncomeSubsection>(index: number, field: K, value: IncomeSubsection[K]) => {
    setIncomeSubsections((current) => {
      const updated = [...current]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  const addIncomeSubsection = () => {
    const nextSubsections = [
      ...incomeSubsections,
      {
        id: `income-subsection-${Date.now()}`,
        title: `Subsection ${incomeSubsections.length + 1}`,
        biMonthlySalaryLabel: 'Bi-monthly salary',
        biMonthlySalary: 0,
        midMonthSalaryLabel: 'Mid month salary Arrived',
        midMonthSalaryArrived: false,
        monthEndSalaryLabel: 'Month end salary Arrived',
        monthEndSalaryArrived: false,
        checkingBalanceLabel: 'Checking Account Balance',
        checkingBalance: 0,
        additionalPaymentsLabel: 'Additional Payments',
        additionalPayments: 0,
        totalBalanceLabel: 'Total Balance',
        additionalIncomeLabel: 'Additional Income',
        additionalIncome: 0,
        monthEndBalanceLabel: 'Month End Balance',
      },
    ]

    setIncomeSubsections(nextSubsections)
    setSaveState('idle')
    setSaveMessage('Unsaved subsection added')
  }

  const deleteIncomeSubsection = (subsectionId: string) => {
    if (!window.confirm('Delete this subsection?')) {
      return
    }

    void persistFinancialPlan(
      buildPayload({
        incomeSubsections: incomeSubsections.filter((subsection) => subsection.id !== subsectionId),
      }),
      'Subsection deleted',
    )
  }

  const toggleCreditSelection = (id: string) => {
    setSelectedCreditIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleExpenseSelection = (id: string) => {
    setSelectedExpenseIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const deleteSelectedCredits = () => {
    if (selectedCreditIds.size === 0) {
      return
    }

    if (!window.confirm('Delete the selected credit accounts?')) {
      return
    }

    void persistFinancialPlan(
      buildPayload({
        creditAccounts: creditAccounts.filter((account) => !selectedCreditIds.has(account.id)),
      }),
      'Deleted from server',
      () => setSelectedCreditIds(new Set()),
    )
  }

  const deleteSelectedExpenses = () => {
    if (selectedExpenseIds.size === 0) {
      return
    }

    if (!window.confirm('Delete the selected expense rows?')) {
      return
    }

    void persistFinancialPlan(
      buildPayload({
        planoExpenses: planoExpenses.filter((item) => !selectedExpenseIds.has(item.id)),
        sanfordExpenses: sanfordExpenses.filter((item) => !selectedExpenseIds.has(item.id)),
        otherExpenses: otherExpenses.filter((item) => !selectedExpenseIds.has(item.id)),
      }),
      'Deleted from server',
      () => setSelectedExpenseIds(new Set()),
    )
  }

  const editableIncomeIds = new Set([
    'bi-monthly-salary',
  ])
  const checkboxIncomeIds = new Set(['salary-15th', 'salary-1st'])

  const editableBalanceIds = new Set([
    'checking-balance-chase',
    'additional-payments-chase',
    'additional-income-chase',
    'checking-balance-pnc',
    'additional-other-income',
    'chase-cd-balance',
  ])

  const totalAvailable = creditAccounts.reduce((sum, account) => sum + account.availableCredit, 0)
  const totalDue = creditAccounts.reduce((sum, account) => sum + account.lastStatementBalance, 0)
  const totalCardDue = creditAccounts.reduce((sum, account) => sum + (account.creditLimit - account.availableCredit), 0)
  const totalLimits = creditAccounts.reduce((sum, account) => sum + account.creditLimit, 0)
  const totalUtilization = totalLimits > 0 ? (totalCardDue / totalLimits) * 100 : 0

  const biMonthlySalary = incomeItemsState.find((item) => item.id === 'bi-monthly-salary')?.amount ?? 0
  const salary15th = (incomeItemsState.find((item) => item.id === 'salary-15th')?.amount ?? 0) === 0 ? 0 : biMonthlySalary
  const salary1st = (incomeItemsState.find((item) => item.id === 'salary-1st')?.amount ?? 0) === 0 ? 0 : biMonthlySalary
  const salaryTransferToChase = biMonthlySalary * 2
  const salaryTransfersToPNC = 2000 * 2
  const totalSalaryPerMonth = salaryTransferToChase

  const checkingAccountBalanceChase = balanceItemsState.find((item) => item.id === 'checking-balance-chase')?.amount ?? 0
  const additionalPaymentsChase = balanceItemsState.find((item) => item.id === 'additional-payments-chase')?.amount ?? 0
  const additionalIncomeChase = balanceItemsState.find((item) => item.id === 'additional-income-chase')?.amount ?? 0
  const chaseCDBalance = balanceItemsState.find((item) => item.id === 'chase-cd-balance')?.amount ?? 0
  const checkingAccountBalancePNC = balanceItemsState.find((item) => item.id === 'checking-balance-pnc')?.amount ?? 0
  const additionalOtherIncome = balanceItemsState.find((item) => item.id === 'additional-other-income')?.amount ?? 0

  const totalBalanceChase = salary15th + salary1st + checkingAccountBalanceChase - additionalPaymentsChase

  const creditCardCurrentMonthPayments = creditAccounts.reduce((sum, account) => {
    const currentMonthPayment = account.paidThisMonth ? 0 : account.lastStatementBalance
    return sum + currentMonthPayment
  }, 0)

  const creditCardNextMonthBalance = creditAccounts.reduce((sum, account) => {
    const totalDueForCard = account.creditLimit - account.availableCredit
    const nextMonthBalance = account.paidThisMonth
      ? account.statementCycledAfterPayment
        ? account.lastStatementBalance
        : totalDueForCard
      : totalDueForCard - account.lastStatementBalance
    return sum + nextMonthBalance
  }, 0)

  const debitCardExpenseItems = [...planoExpenses, ...sanfordExpenses, ...otherExpenses]
  const debitCardExpensesTotalCurrent = sumExpenses(debitCardExpenseItems, 'current')
  const debitCardExpensesTotalNext = sumExpenses(debitCardExpenseItems, 'next')
  const j15 = creditCardCurrentMonthPayments
  const k15 = creditCardNextMonthBalance
  const j36 = j15 + debitCardExpensesTotalCurrent
  const k36 = k15 + debitCardExpensesTotalNext

  const checkingAccountBalanceMonthEndChase = totalBalanceChase + additionalIncomeChase - j36
  const netBalanceMonthEnd = checkingAccountBalanceMonthEndChase + chaseCDBalance + checkingAccountBalancePNC + additionalOtherIncome
  const netBalanceNextMonth = netBalanceMonthEnd + salaryTransferToChase - k36

  const adjustedIncomeItems = incomeItemsState.map((item) => {
    switch (item.id) {
      case 'salary-15th':
        return { ...item, amount: salary15th }
      case 'salary-1st':
        return { ...item, amount: salary1st }
      case 'salary-transfer-chase-month':
        return { ...item, amount: salaryTransferToChase }
      case 'salary-transfer-pnc-home-loans':
        return { ...item, amount: salaryTransfersToPNC }
      case 'total-salary-per-month':
        return { ...item, amount: totalSalaryPerMonth }
      default:
        return item
    }
  })

  const adjustedBalanceItems = balanceItemsState.map((item) => {
    switch (item.id) {
      case 'total-balance-chase':
        return { ...item, amount: totalBalanceChase }
      case 'checking-balance-month-end-chase':
        return { ...item, amount: checkingAccountBalanceMonthEndChase }
      case 'net-balance-month-end':
        return { ...item, amount: netBalanceMonthEnd }
      case 'net-balance-next-month-end':
        return { ...item, amount: netBalanceNextMonth }
      default:
        return item
    }
  })

  const displayedIncomeItems = adjustedIncomeItems.filter(
    (item) => item.id !== 'salary-transfer-pnc-home-loans' && item.id !== 'salary-transfer-chase-month',
  )
  const chaseIncomeOrder = [
    'bi-monthly-salary',
    'salary-15th',
    'salary-1st',
  ]
  const chaseBalanceIds = new Set([
    'checking-balance-chase',
    'additional-payments-chase',
    'total-balance-chase',
    'additional-income-chase',
    'checking-balance-month-end-chase',
  ])
  const chaseIncomeItems = chaseIncomeOrder
    .map((id) => displayedIncomeItems.find((item) => item.id === id))
    .filter((item): item is IncomeItem => item !== undefined)
  const chaseBalanceItems = adjustedBalanceItems.filter((item) => chaseBalanceIds.has(item.id))
  const otherIncomeItems = displayedIncomeItems.filter(
    (item) => !chaseIncomeOrder.includes(item.id) && item.id !== 'total-salary-per-month',
  )

  const renderIncomeCard = (item: IncomeItem) => {
    const itemIndex = incomeItemsState.findIndex((entry) => entry.id === item.id)
    const isCheckboxIncome = checkboxIncomeIds.has(item.id)

    return (
      <article key={item.id} className="info-card">
        <input
          type="text"
          value={item.label}
          onChange={(e) => updateIncomeLabel(itemIndex, e.target.value)}
          className="card-title label-input"
        />
        {isCheckboxIncome ? (
          <input
            type="checkbox"
            checked={item.amount === 0}
            onChange={(e) => updateIncomeItemById(item.id, e.target.checked ? 0 : biMonthlySalary)}
            className="salary-toggle-checkbox"
          />
        ) : editableIncomeIds.has(item.id) ? (
          <div className="currency-input-wrap">
            <span className="currency-prefix">$</span>
            <input
              type="number"
              value={item.amount}
              onChange={(e) => updateIncomeItem(itemIndex, parseFloat(e.target.value) || 0)}
              className="amount-input currency-amount-input"
            />
          </div>
        ) : (
          <p className="card-value">{currency(item.amount)}</p>
        )}
        {item.month ? <p className="card-meta">{item.month}</p> : null}
        {item.note ? <p className="card-note">{item.note}</p> : null}
      </article>
    )
  }

  const renderBalanceCard = (item: BalanceItem) => {
    const itemIndex = balanceItemsState.findIndex((entry) => entry.id === item.id)

    return (
      <article key={item.id} className="info-card">
        <input
          type="text"
          value={item.label}
          onChange={(e) => updateBalanceLabel(itemIndex, e.target.value)}
          className="card-title label-input"
        />
        {editableBalanceIds.has(item.id) ? (
          <div className="currency-input-wrap">
            <span className="currency-prefix">$</span>
            <input
              type="number"
              value={item.amount}
              onChange={(e) => updateBalanceItem(itemIndex, parseFloat(e.target.value) || 0)}
              className="amount-input currency-amount-input"
            />
          </div>
        ) : (
          <p className="card-value">{currency(item.amount)}</p>
        )}
        {item.month ? <p className="card-meta">{item.month}</p> : null}
      </article>
    )
  }

  const renderIncomeSubsection = (subsection: IncomeSubsection, index: number) => {
    const midMonthSalary = subsection.midMonthSalaryArrived ? 0 : subsection.biMonthlySalary
    const monthEndSalary = subsection.monthEndSalaryArrived ? 0 : subsection.biMonthlySalary
    const totalBalance = midMonthSalary + monthEndSalary + subsection.checkingBalance - subsection.additionalPayments
    const monthEndBalance = totalBalance + subsection.additionalIncome - j36

    return (
      <div key={subsection.id} className="subsection-block">
        <div className="subsection-header">
          <h3>
            <input
              type="text"
              value={subsection.title}
              onChange={(e) => updateIncomeSubsectionTitle(index, e.target.value)}
              className="label-input subsection-title-input"
            />
          </h3>
          <button type="button" className="delete-row-button" onClick={() => deleteIncomeSubsection(subsection.id)}>
            Delete
          </button>
        </div>
        <div className="card-list">
          <article className="info-card">
            <input
              type="text"
              value={subsection.biMonthlySalaryLabel}
              onChange={(e) => updateIncomeSubsection(index, 'biMonthlySalaryLabel', e.target.value)}
              className="card-title label-input"
            />
            <div className="currency-input-wrap">
              <span className="currency-prefix">$</span>
              <input
                type="number"
                value={subsection.biMonthlySalary}
                onChange={(e) => updateIncomeSubsection(index, 'biMonthlySalary', parseFloat(e.target.value) || 0)}
                className="amount-input currency-amount-input"
              />
            </div>
          </article>
          <article className="info-card">
            <input
              type="text"
              value={subsection.midMonthSalaryLabel}
              onChange={(e) => updateIncomeSubsection(index, 'midMonthSalaryLabel', e.target.value)}
              className="card-title label-input"
            />
            <input
              type="checkbox"
              checked={subsection.midMonthSalaryArrived}
              onChange={(e) => updateIncomeSubsection(index, 'midMonthSalaryArrived', e.target.checked)}
              className="salary-toggle-checkbox"
            />
          </article>
          <article className="info-card">
            <input
              type="text"
              value={subsection.monthEndSalaryLabel}
              onChange={(e) => updateIncomeSubsection(index, 'monthEndSalaryLabel', e.target.value)}
              className="card-title label-input"
            />
            <input
              type="checkbox"
              checked={subsection.monthEndSalaryArrived}
              onChange={(e) => updateIncomeSubsection(index, 'monthEndSalaryArrived', e.target.checked)}
              className="salary-toggle-checkbox"
            />
          </article>
          <article className="info-card">
            <input
              type="text"
              value={subsection.checkingBalanceLabel}
              onChange={(e) => updateIncomeSubsection(index, 'checkingBalanceLabel', e.target.value)}
              className="card-title label-input"
            />
            <div className="currency-input-wrap">
              <span className="currency-prefix">$</span>
              <input
                type="number"
                value={subsection.checkingBalance}
                onChange={(e) => updateIncomeSubsection(index, 'checkingBalance', parseFloat(e.target.value) || 0)}
                className="amount-input currency-amount-input"
              />
            </div>
          </article>
          <article className="info-card">
            <input
              type="text"
              value={subsection.additionalPaymentsLabel}
              onChange={(e) => updateIncomeSubsection(index, 'additionalPaymentsLabel', e.target.value)}
              className="card-title label-input"
            />
            <div className="currency-input-wrap">
              <span className="currency-prefix">$</span>
              <input
                type="number"
                value={subsection.additionalPayments}
                onChange={(e) => updateIncomeSubsection(index, 'additionalPayments', parseFloat(e.target.value) || 0)}
                className="amount-input currency-amount-input"
              />
            </div>
          </article>
          <article className="info-card">
            <input
              type="text"
              value={subsection.totalBalanceLabel}
              onChange={(e) => updateIncomeSubsection(index, 'totalBalanceLabel', e.target.value)}
              className="card-title label-input"
            />
            <p className="card-value">{currency(totalBalance)}</p>
          </article>
          <article className="info-card">
            <input
              type="text"
              value={subsection.additionalIncomeLabel}
              onChange={(e) => updateIncomeSubsection(index, 'additionalIncomeLabel', e.target.value)}
              className="card-title label-input"
            />
            <div className="currency-input-wrap">
              <span className="currency-prefix">$</span>
              <input
                type="number"
                value={subsection.additionalIncome}
                onChange={(e) => updateIncomeSubsection(index, 'additionalIncome', parseFloat(e.target.value) || 0)}
                className="amount-input currency-amount-input"
              />
            </div>
          </article>
          <article className="info-card">
            <input
              type="text"
              value={subsection.monthEndBalanceLabel}
              onChange={(e) => updateIncomeSubsection(index, 'monthEndBalanceLabel', e.target.value)}
              className="card-title label-input"
            />
            <p className="card-value">{currency(monthEndBalance)}</p>
          </article>
        </div>
      </div>
    )
  }

  const addCreditAccount = () => {
    const today = new Date().toISOString().split('T')[0]
    const newAccount: CreditAccount = {
      id: `credit-${Date.now()}`,
      name: 'New Account',
      availableCredit: 0,
      nextPaymentDate: today,
      paidThisMonth: false,
      statementCycledAfterPayment: false,
      lastStatementDate: today,
      lastStatementBalance: 0,
      creditLimit: 0,
    }
    setCreditAccounts([...creditAccounts, newAccount])
  }

  const addExpenseRow = (
    setter: React.Dispatch<React.SetStateAction<ExpenseItem[]>>,
    items: ExpenseItem[],
    prefix: string,
  ) => {
    const today = new Date().toISOString().split('T')[0]
    const newItem: ExpenseItem = {
      id: `${prefix}-${Date.now()}`,
      label: 'New Expense',
      payDate: today,
      current: 0,
      next: 0,
    }
    setter([...items, newItem])
  }

  const expenseGroups: ExpenseGroupConfig[] = [
    {
      title: 'Plano',
      prefix: 'plano',
      items: planoExpenses,
      setter: setPlanoExpenses,
    },
    {
      title: 'Sanford',
      prefix: 'sanford',
      items: sanfordExpenses,
      setter: setSanfordExpenses,
    },
    {
      title: 'Other',
      prefix: 'other',
      items: otherExpenses,
      setter: setOtherExpenses,
    },
  ]

  const buildPayload = (overrides: Partial<FinancialPlanData> = {}): FinancialPlanData => ({
    creditAccounts: overrides.creditAccounts ?? creditAccounts,
    incomeItems: overrides.incomeItems ?? adjustedIncomeItems,
    balanceItems: overrides.balanceItems ?? adjustedBalanceItems,
    planoExpenses: overrides.planoExpenses ?? planoExpenses,
    sanfordExpenses: overrides.sanfordExpenses ?? sanfordExpenses,
    otherExpenses: overrides.otherExpenses ?? otherExpenses,
    columnLabels: overrides.columnLabels ?? columnLabels,
    sectionTitles: overrides.sectionTitles ?? sectionTitles,
    incomeSubsections: overrides.incomeSubsections ?? incomeSubsections,
    summary: overrides.summary,
  })

  const applyFinancialPlan = (data: FinancialPlanData) => {
    setCreditAccounts(data.creditAccounts)
    setIncomeItemsState(data.incomeItems)
    setBalanceItemsState(data.balanceItems)
    setPlanoExpenses(data.planoExpenses)
    setSanfordExpenses(data.sanfordExpenses)
    setOtherExpenses(data.otherExpenses)
    setColumnLabels(data.columnLabels ?? defaultColumnLabels)
    setSectionTitles(data.sectionTitles ?? defaultSectionTitles)
    setIncomeSubsections(data.incomeSubsections ?? defaultIncomeSubsections)
  }

  const persistFinancialPlan = async (
    payload: FinancialPlanData,
    successMessage = 'Saved to server',
    onSuccess?: () => void,
  ) => {
    setSaveState('saving')
    setSaveMessage('Saving...')

    try {
      const response = await fetch(`${API_BASE_URL}/api/financial-plan`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error(`Failed to save financial plan: ${response.status}`)
      }

      const savedData: FinancialPlanData = await response.json()
      applyFinancialPlan(savedData)
      onSuccess?.()
      setSaveState('saved')
      setSaveMessage(successMessage)
      return true
    } catch {
      setSaveState('error')
      setSaveMessage('Save failed. Check the API server.')
      return false
    }
  }

  const handleSave = async () => {
    await persistFinancialPlan(buildPayload())
  }

  return (
    <div className="app">
      <header className="hero">
        <div>
          <p className="eyebrow">Personal Finance Tracker</p>
          <h1>Financial Planning</h1>
          <p className="intro">
            Track cards, statements, payments, income, balances, and spreadsheet-style expense totals in one dashboard.
          </p>
        </div>
        <div className="hero-actions">
          <button type="button" className="toolbar-button" onClick={handleSave} disabled={saveState === 'loading' || saveState === 'saving'}>
            {saveState === 'saving' ? 'Saving...' : 'Save Changes'}
          </button>
          <span className={`status-text status-${saveState}`}>{saveMessage}</span>
        </div>
      </header>

      <section className="credit-accounts-section">
        <div className="section-content-fit">
          <div className="section-header">
            <h2>
              <input
                type="text"
                value={sectionTitles.creditAccounts}
                onChange={(e) => updateSectionTitle('creditAccounts', e.target.value)}
                className="label-input section-title-input"
              />
            </h2>
            <div className="section-header-actions">
              {selectedCreditIds.size > 0 && (
                <button type="button" className="delete-row-button" onClick={deleteSelectedCredits}>Delete ({selectedCreditIds.size})</button>
              )}
              <button type="button" className="add-row-button" onClick={addCreditAccount}>+ Add</button>
            </div>
          </div>
          <div className="table-wrapper compact-credit-table">
            <table className="credit-accounts-table">
              <thead>
                <tr>
                  <th className="select-col"></th>
                  {columnLabels.creditAccounts.map((column, index) => (
                    <th key={column.id}>
                      <input
                        type="text"
                        value={column.label}
                        onChange={(e) => updateColumnLabel('creditAccounts', index, e.target.value)}
                        className="label-input table-header-input"
                        style={{ width: getHeaderInputWidth(column.label) }}
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {creditAccounts.map((account, index) => {
                const totalDueForCard = account.creditLimit - account.availableCredit
                const currentMonthPayment = account.paidThisMonth ? 0 : account.lastStatementBalance
                const nextMonthStatementBalance = account.paidThisMonth
                  ? account.statementCycledAfterPayment
                    ? account.lastStatementBalance
                    : totalDueForCard
                  : totalDueForCard - account.lastStatementBalance
                const utilizationPercent = account.creditLimit > 0 ? (totalDueForCard / account.creditLimit) * 100 : 0

                return (
                  <tr key={account.id} className={selectedCreditIds.has(account.id) ? 'row-selected' : ''}>
                    <td className="select-col">
                      <input type="checkbox" checked={selectedCreditIds.has(account.id)} onChange={() => toggleCreditSelection(account.id)} />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={account.name}
                        onChange={(e) => updateAccount(index, 'name', e.target.value)}
                        className="label-input"
                      />
                    </td>
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
                      <div className="currency-input-wrap">
                        <span className="currency-prefix">$</span>
                        <input
                          type="number"
                          value={account.lastStatementBalance}
                          onChange={(e) => updateAccount(index, 'lastStatementBalance', parseFloat(e.target.value) || 0)}
                          className="currency-amount-input"
                        />
                      </div>
                    </td>
                    <td>
                      <div className="currency-input-wrap">
                        <span className="currency-prefix">$</span>
                        <input
                          type="number"
                          value={account.creditLimit}
                          onChange={(e) => updateAccount(index, 'creditLimit', parseFloat(e.target.value) || 0)}
                          className="currency-amount-input"
                        />
                      </div>
                    </td>
                    <td>{currency(totalDueForCard)}</td>
                    <td>{currency(currentMonthPayment)}</td>
                    <td>{currency(nextMonthStatementBalance)}</td>
                    <td>{utilizationPercent.toFixed(1)}%</td>
                  </tr>
                )
              })}
                <tr className="table-summary-row">
                  <td></td>
                  <td>Credit Card Totals</td>
                  <td>{currency(totalAvailable)}</td>
                  <td></td>
                  <td></td>
                  <td></td>
                  <td></td>
                  <td>{currency(totalDue)}</td>
                  <td>{currency(totalLimits)}</td>
                  <td>{currency(totalCardDue)}</td>
                  <td>{currency(creditCardCurrentMonthPayments)}</td>
                  <td>{currency(creditCardNextMonthBalance)}</td>
                  <td>{totalUtilization.toFixed(1)}%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <div className="finance-overview-row">
        <section className="expense-section compact-section">
          <div className="section-header">
            <h2>
              <input
                type="text"
                value={sectionTitles.debitExpenses}
                onChange={(e) => updateSectionTitle('debitExpenses', e.target.value)}
                className="label-input section-title-input"
              />
            </h2>
            <div className="section-header-actions">
              {selectedExpenseIds.size > 0 && (
                <button type="button" className="delete-row-button" onClick={deleteSelectedExpenses}>Delete ({selectedExpenseIds.size})</button>
              )}
              <button type="button" className="add-row-button" onClick={() => addExpenseRow(setOtherExpenses, otherExpenses, 'other')}>+ Add</button>
            </div>
          </div>
          <div className="table-wrapper compact-expense-table">
            <table className="debit-expenses-table">
              <thead>
                <tr>
                  <th className="select-col"></th>
                  {columnLabels.debitExpenses.map((column, index) => (
                    <th key={column.id}>
                      <input
                        type="text"
                        value={column.label}
                        onChange={(e) => updateColumnLabel('debitExpenses', index, e.target.value)}
                        className="label-input table-header-input"
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {expenseGroups.map((group) => (
                  <React.Fragment key={group.title}>
                    {group.items.map((item, index) => (
                      <tr key={item.id} className={selectedExpenseIds.has(item.id) ? 'row-selected' : ''}>
                        <td className="select-col">
                          <input type="checkbox" checked={selectedExpenseIds.has(item.id)} onChange={() => toggleExpenseSelection(item.id)} />
                        </td>
                        <td>
                          <div className="editable-label-row">
                            <input
                              type="text"
                              value={item.label}
                              onChange={(e) => updateExpenseLabel(group.setter, group.items, index, e.target.value)}
                              className="label-input"
                            />
                          </div>
                        </td>
                        <td>
                          <input
                            type="date"
                            value={item.payDate}
                            onChange={(e) => updateExpenseItem(group.setter, group.items, index, 'payDate', e.target.value)}
                          />
                        </td>
                        <td>
                          <div className="currency-input-wrap expense-currency-input-wrap">
                            <span className="currency-prefix">$</span>
                            <input
                              type="number"
                              value={item.current}
                              onChange={(e) => updateExpenseItem(group.setter, group.items, index, 'current', parseFloat(e.target.value) || 0)}
                              className="currency-amount-input"
                            />
                          </div>
                        </td>
                        <td>
                          <div className="currency-input-wrap expense-currency-input-wrap">
                            <span className="currency-prefix">$</span>
                            <input
                              type="number"
                              value={item.next}
                              onChange={(e) => updateExpenseItem(group.setter, group.items, index, 'next', parseFloat(e.target.value) || 0)}
                              className="currency-amount-input"
                            />
                          </div>
                        </td>
                      </tr>
                    ))}

                  </React.Fragment>
                ))}
                <tr className="table-summary-row">
                  <td></td>
                  <td>Debit Card Expenses Total</td>
                  <td></td>
                  <td>{currency(debitCardExpensesTotalCurrent)}</td>
                  <td>{currency(debitCardExpensesTotalNext)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="summary-grid expense-summary-grid">
            <div className="summary-card">
              <p>Expense Grand Total</p>
              <strong>{currency(j36)}</strong>
            </div>
            <div className="summary-card">
              <p>Next Month Expense Grand Total</p>
              <strong>{currency(k36)}</strong>
            </div>
          </div>
        </section>

        <section className="compact-section compact-side-panel bank-accounts-section">
          <div className="section-content-fit">
            <div className="section-header">
              <h2>
                <input
                  type="text"
                  value={sectionTitles.incomeSchedule}
                  onChange={(e) => updateSectionTitle('incomeSchedule', e.target.value)}
                  className="label-input section-title-input"
                />
              </h2>
              <div className="section-header-actions">
                <button type="button" className="add-row-button" onClick={addIncomeSubsection}>+ Add</button>
              </div>
            </div>
            <div className="income-subsection-grid">
              <div className="subsection-block chase-subsection">
                <h3>
                  <input
                    type="text"
                    value={sectionTitles.incomeScheduleChase}
                    onChange={(e) => updateSectionTitle('incomeScheduleChase', e.target.value)}
                    className="label-input subsection-title-input"
                  />
                </h3>
                <div className="card-list">
                  {chaseIncomeItems.map(renderIncomeCard)}
                  {chaseBalanceItems.map(renderBalanceCard)}
                </div>
              </div>
              {incomeSubsections.map(renderIncomeSubsection)}
            </div>
            {otherIncomeItems.length > 0 ? (
              <div className="subsection-block">
                <div className="card-list">
                  {otherIncomeItems.map(renderIncomeCard)}
                </div>
              </div>
            ) : null}
          </div>
        </section>

      </div>
    </div>
  )
}
