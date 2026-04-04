import React, { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
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
  sectionTitles?: FinancialPlanSectionTitles & { incomeScheduleChase?: string }
  incomeSubsections?: IncomeSubsection[]
  summary?: Record<string, number>
}

type AuthStatusResponse = {
  authenticated: boolean
  email: string | null
  name: string | null
  pictureUrl: string | null
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.DEV ? 'http://localhost:8080' : '')
const LOGIN_URL = `${API_BASE_URL}/oauth2/authorization/google`

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

const formatCurrencyInputValue = (value: number) => value.toFixed(2)

const isPastDate = (value: string) => {
  const [year, month, day] = value.split('-').map(Number)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const targetDate = new Date(year, (month ?? 1) - 1, day ?? 1)
  targetDate.setHours(0, 0, 0, 0)

  return targetDate < today
}

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

type SortDirection = 'asc' | 'desc'

type CreditSortKey =
  | 'name'
  | 'availableCredit'
  | 'nextPaymentDate'
  | 'paidThisMonth'
  | 'statementCycledAfterPayment'
  | 'lastStatementDate'
  | 'lastStatementBalance'
  | 'creditLimit'
  | 'totalDueForCard'
  | 'currentMonthPayment'
  | 'nextMonthStatementBalance'
  | 'utilizationPercent'

type ExpenseSortKey = 'label' | 'payDate' | 'current' | 'next'

type SortState<T extends string> = {
  key: T
  direction: SortDirection
}

type ExpenseRow = {
  item: ExpenseItem
  setter: React.Dispatch<React.SetStateAction<ExpenseItem[]>>
}

const sumExpenses = (items: ExpenseItem[], field: 'current' | 'next') =>
  items.reduce((sum, item) => sum + item[field], 0)

const compareValues = (left: string | number | boolean, right: string | number | boolean) => {
  if (typeof left === 'string' && typeof right === 'string') {
    return left.localeCompare(right)
  }

  if (typeof left === 'boolean' && typeof right === 'boolean') {
    return Number(left) - Number(right)
  }

  return Number(left) - Number(right)
}

const sortItems = <T,>(items: T[], getValue: (item: T) => string | number | boolean, direction: SortDirection) => {
  const multiplier = direction === 'asc' ? 1 : -1
  return [...items].sort((left, right) => multiplier * compareValues(getValue(left), getValue(right)))
}

const getCreditMetrics = (account: CreditAccount) => {
  const totalDueForCard = account.creditLimit - account.availableCredit
  const currentMonthPayment = account.paidThisMonth ? 0 : account.lastStatementBalance
  const nextMonthStatementBalance = account.paidThisMonth
    ? account.statementCycledAfterPayment
      ? account.lastStatementBalance
      : totalDueForCard
    : totalDueForCard - account.lastStatementBalance
  const utilizationPercent = account.creditLimit > 0 ? (totalDueForCard / account.creditLimit) * 100 : 0

  return {
    totalDueForCard,
    currentMonthPayment,
    nextMonthStatementBalance,
    utilizationPercent,
  }
}

const normalizeSectionTitles = (
  sectionTitles?: FinancialPlanData['sectionTitles'],
): FinancialPlanSectionTitles => ({
  ...defaultSectionTitles,
  ...sectionTitles,
  defaultBank: sectionTitles?.defaultBank ?? sectionTitles?.incomeScheduleChase ?? defaultSectionTitles.defaultBank,
})

const serializeSectionTitles = (
  sectionTitles: FinancialPlanSectionTitles,
): FinancialPlanSectionTitles & { incomeScheduleChase: string } => ({
  ...sectionTitles,
  incomeScheduleChase: sectionTitles.defaultBank,
})

const normalizeFinancialPlanData = (data: FinancialPlanData): FinancialPlanData => ({
  creditAccounts: data.creditAccounts,
  incomeItems: data.incomeItems,
  balanceItems: data.balanceItems,
  planoExpenses: data.planoExpenses,
  sanfordExpenses: data.sanfordExpenses,
  otherExpenses: data.otherExpenses,
  columnLabels: data.columnLabels ?? defaultColumnLabels,
  sectionTitles: serializeSectionTitles(normalizeSectionTitles(data.sectionTitles)),
  incomeSubsections: data.incomeSubsections ?? defaultIncomeSubsections,
})

const getFinancialPlanSignature = (data: FinancialPlanData) => JSON.stringify(normalizeFinancialPlanData(data))

const chartCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: Math.abs(value) >= 1000 ? 'compact' : 'standard',
    maximumFractionDigits: 1,
  }).format(value)

const formatShortDate = (value: string) => {
  const [year, month, day] = value.split('-').map(Number)
  const safeDate = new Date(year, (month ?? 1) - 1, day ?? 1)
  return safeDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const shortenLabel = (value: string, maxLength = 18, trailingLength = 0) => {
  if (value.length <= maxLength) {
    return value
  }

  const ellipsis = '....'

  if (trailingLength > 0) {
    const safeTrailingLength = Math.min(trailingLength, Math.max(1, maxLength - ellipsis.length - 1))
    const leadingLength = Math.max(1, maxLength - ellipsis.length - safeTrailingLength)
    return `${value.slice(0, leadingLength)}${ellipsis}${value.slice(-safeTrailingLength)}`
  }

  return `${value.slice(0, maxLength - 3)}...`
}

const getNewBankSubsectionTitle = (index: number) => {
  let labelIndex = index
  let suffix = ''

  do {
    suffix = String.fromCharCode(65 + (labelIndex % 26)) + suffix
    labelIndex = Math.floor(labelIndex / 26) - 1
  } while (labelIndex >= 0)

  return `Bank ${suffix}`
}

const CHART_COLORS = {
  current: '#0f766e',
  next: '#2563eb',
  deferred: '#f59e0b',
  utilization: '#dc2626',
  overdue: '#b91c1c',
  positive: '#15803d',
  negative: '#b45309',
  forecast: '#1d4ed8',
  grid: '#dbe4f0',
  text: '#334155',
}

const defaultFinancialPlanData = normalizeFinancialPlanData({
  creditAccounts: initialCreditAccounts,
  incomeItems: initialIncomeItems,
  balanceItems: initialBalanceItems,
  planoExpenses: initialPlanoExpenses,
  sanfordExpenses: initialSanfordExpenses,
  otherExpenses: initialOtherExpenses,
  columnLabels: defaultColumnLabels,
  sectionTitles: defaultSectionTitles,
  incomeSubsections: defaultIncomeSubsections,
})

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
  const [newBankSubsectionIds, setNewBankSubsectionIds] = useState<Set<string>>(new Set())
  const [selectedCreditIds, setSelectedCreditIds] = useState<Set<string>>(new Set())
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<Set<string>>(new Set())
  const [creditSort, setCreditSort] = useState<SortState<CreditSortKey>>({
    key: 'statementCycledAfterPayment',
    direction: 'desc',
  })
  const [expenseSort, setExpenseSort] = useState<SortState<ExpenseSortKey>>({ key: 'label', direction: 'asc' })
  const [saveState, setSaveState] = useState<'idle' | 'loading' | 'saving' | 'saved' | 'error'>('loading')
  const [saveMessage, setSaveMessage] = useState('Loading saved plan...')
  const [loadedPlanSignature, setLoadedPlanSignature] = useState<string | null>(null)
  const [authState, setAuthState] = useState<'checking' | 'authenticated' | 'unauthenticated' | 'error'>('checking')
  const [authenticatedUser, setAuthenticatedUser] = useState<AuthStatusResponse | null>(null)
  const [authMessage, setAuthMessage] = useState('Checking sign-in status...')

  useEffect(() => {
    let isMounted = true
    const loginStatus = new URLSearchParams(window.location.search).get('login')

    if (loginStatus) {
      const nextUrl = new URL(window.location.href)
      nextUrl.searchParams.delete('login')
      window.history.replaceState({}, '', `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`)
    }

    const applyFinancialPlan = (data: FinancialPlanData) => {
      setCreditAccounts(data.creditAccounts)
      setIncomeItemsState(data.incomeItems)
      setBalanceItemsState(data.balanceItems)
      setPlanoExpenses(data.planoExpenses)
      setSanfordExpenses(data.sanfordExpenses)
      setOtherExpenses(data.otherExpenses)
      setColumnLabels(data.columnLabels ?? defaultColumnLabels)
      setSectionTitles(normalizeSectionTitles(data.sectionTitles))
      setIncomeSubsections(data.incomeSubsections ?? defaultIncomeSubsections)
      setNewBankSubsectionIds(new Set())
    }

    const loadFinancialPlan = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/financial-plan`, {
          credentials: 'include',
        })

        if (response.status === 401) {
          if (!isMounted) {
            return
          }

          setAuthenticatedUser(null)
          setAuthState('unauthenticated')
          setAuthMessage('Session expired. Sign in with Google to continue.')
          setSaveState('idle')
          setSaveMessage('')
          return
        }

        if (!response.ok) {
          throw new Error(`Failed to load financial plan: ${response.status}`)
        }

        const data: FinancialPlanData = await response.json()
        if (!isMounted) {
          return
        }

        applyFinancialPlan(data)
        setLoadedPlanSignature(getFinancialPlanSignature(data))
        setAuthState('authenticated')
        setSaveState('idle')
        setSaveMessage('')
      } catch {
        if (!isMounted) {
          return
        }

        setLoadedPlanSignature(getFinancialPlanSignature(defaultFinancialPlanData))
        setAuthState('error')
        setAuthMessage('Authentication or API service unavailable.')
        setSaveState('error')
        setSaveMessage('API unavailable. Using local defaults.')
      }
    }

    const loadAuthAndPlan = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
          credentials: 'include',
        })

        if (!response.ok) {
          throw new Error(`Failed to check authentication: ${response.status}`)
        }

        const authData: AuthStatusResponse = await response.json()
        if (!isMounted) {
          return
        }

        if (!authData.authenticated) {
          setAuthenticatedUser(null)
          setAuthState('unauthenticated')
          setAuthMessage(loginStatus === 'error' ? 'Google sign-in failed. Try again.' : 'Sign in with Google to continue.')
          setSaveState('idle')
          setSaveMessage('')
          return
        }

        setAuthenticatedUser(authData)
        setAuthState('authenticated')
        setAuthMessage('')
        await loadFinancialPlan()
      } catch {
        if (!isMounted) {
          return
        }

        setAuthenticatedUser(null)
        setAuthState('error')
        setAuthMessage('Authentication service unavailable.')
        setSaveState('error')
        setSaveMessage('API unavailable. Using local defaults.')
      }
    }

    void loadAuthAndPlan()

    return () => {
      isMounted = false
    }
  }, [])

  const updateAccountById = (accountId: string, field: string, value: number | string | boolean) => {
    setCreditAccounts((current) =>
      current.map((account) => (account.id === accountId ? { ...account, [field]: value } : account)),
    )
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

  const updateExpenseItemById = (
    setter: React.Dispatch<React.SetStateAction<ExpenseItem[]>>,
    itemId: string,
    field: 'current' | 'next' | 'payDate',
    value: number | string,
  ) => {
    setter((current) => current.map((item) => (item.id === itemId ? { ...item, [field]: value } : item)))
  }

  const updateExpenseLabelById = (
    setter: React.Dispatch<React.SetStateAction<ExpenseItem[]>>,
    itemId: string,
    label: string,
  ) => {
    setter((current) => current.map((item) => (item.id === itemId ? { ...item, label } : item)))
  }

  const toggleCreditSort = (key: CreditSortKey) => {
    setCreditSort((current) => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }))
  }

  const toggleExpenseSort = (key: ExpenseSortKey) => {
    setExpenseSort((current) => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }))
  }

  const getSortIndicator = <T extends string,>(sortState: SortState<T>, key: T) => {
    if (sortState.key !== key) {
      return '↕'
    }

    return sortState.direction === 'asc' ? '↑' : '↓'
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
    const subsectionId = `income-subsection-${Date.now()}`
    const newBankCount = incomeSubsections.filter((subsection) => newBankSubsectionIds.has(subsection.id)).length
    const nextSubsections = [
      ...incomeSubsections,
      {
        id: subsectionId,
        title: getNewBankSubsectionTitle(newBankCount),
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
    setNewBankSubsectionIds((current) => new Set(current).add(subsectionId))
  }

  const deleteIncomeSubsection = (subsectionId: string) => {
    if (!window.confirm('Delete this subsection?')) {
      return
    }

    setNewBankSubsectionIds((current) => {
      const next = new Set(current)
      next.delete(subsectionId)
      return next
    })

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
  const monthAfterNextMonthExpense = totalCardDue - creditCardCurrentMonthPayments - creditCardNextMonthBalance
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

  const overdueCreditAccounts = creditAccounts.filter(
    (account) => isPastDate(account.nextPaymentDate) && !account.paidThisMonth,
  )
  const overdueExpenses = debitCardExpenseItems.filter(
    (item) => isPastDate(item.payDate) && Math.abs(item.current) > 0.004,
  )

  const overdueAlertData = [
    {
      label: 'Overdue Cards',
      value: overdueCreditAccounts.length,
      detail: overdueCreditAccounts.length === 1 ? '1 account needs payment' : `${overdueCreditAccounts.length} accounts need payment`,
      ratio: Math.min(100, creditAccounts.length === 0 ? 0 : (overdueCreditAccounts.length / creditAccounts.length) * 100),
    },
    {
      label: 'Overdue Expenses',
      value: overdueExpenses.length,
      detail: overdueExpenses.length === 1 ? '1 debit row is late' : `${overdueExpenses.length} debit rows are late`,
      ratio: Math.min(100, debitCardExpenseItems.length === 0 ? 0 : (overdueExpenses.length / debitCardExpenseItems.length) * 100),
    },
    {
      label: 'Current Month Exposure',
      value: chartCurrency(j36),
      detail: 'Cards plus current debit expenses',
      ratio: Math.min(100, totalLimits === 0 ? 0 : (j36 / totalLimits) * 100),
    },
    {
      label: 'Next Month Exposure',
      value: chartCurrency(k36),
      detail: 'Projected next statement pressure',
      ratio: Math.min(100, totalLimits === 0 ? 0 : (k36 / totalLimits) * 100),
    },
  ]

  const paymentTimelineData = [...creditAccounts]
    .map((account) => {
      const metrics = getCreditMetrics(account)
      return {
        name: shortenLabel(account.name, 16, 7),
        payDate: account.nextPaymentDate,
        payDateLabel: formatShortDate(account.nextPaymentDate),
        paymentDue: Number(metrics.currentMonthPayment.toFixed(2)),
        nextBalance: Number(metrics.nextMonthStatementBalance.toFixed(2)),
      }
    })
    .filter((account) => account.paymentDue > 0 || account.nextBalance > 0)
    .sort((left, right) => left.payDate.localeCompare(right.payDate))

  const creditTotalDueData = [...creditAccounts]
    .map((account) => {
      const metrics = getCreditMetrics(account)
      return {
        fullName: account.name,
        name: shortenLabel(account.name, 25, 12),
        totalDue: Number(metrics.totalDueForCard.toFixed(2)),
        paymentDue: Number(metrics.currentMonthPayment.toFixed(2)),
        nextStmtBalance: Number(metrics.nextMonthStatementBalance.toFixed(2)),
      }
    })
    .filter((account) => account.totalDue > 0)
    .sort(
      (left, right) =>
        right.totalDue - left.totalDue ||
        right.paymentDue - left.paymentDue ||
        right.nextStmtBalance - left.nextStmtBalance,
    )

  const creditVerticalChartHeight = Math.max(320, creditAccounts.length * 30)

  const expenseCategoryData = [
    {
      name: 'Plano',
      current: Number(sumExpenses(planoExpenses, 'current').toFixed(2)),
      next: Number(sumExpenses(planoExpenses, 'next').toFixed(2)),
    },
    {
      name: 'Sanford',
      current: Number(sumExpenses(sanfordExpenses, 'current').toFixed(2)),
      next: Number(sumExpenses(sanfordExpenses, 'next').toFixed(2)),
    },
    {
      name: 'Other',
      current: Number(sumExpenses(otherExpenses, 'current').toFixed(2)),
      next: Number(sumExpenses(otherExpenses, 'next').toFixed(2)),
    },
  ]

  const expenseCategoryShareData = expenseCategoryData
    .map((item, index) => ({
      name: item.name,
      value: Number((item.current + item.next).toFixed(2)),
      color: [CHART_COLORS.current, CHART_COLORS.next, CHART_COLORS.deferred][index],
    }))
    .filter((item) => item.value > 0)

  const cashFlowDriverData = [
    { name: 'Checking', amount: Number(checkingAccountBalanceChase.toFixed(2)), fill: CHART_COLORS.positive },
    { name: 'Salary 15th', amount: Number(salary15th.toFixed(2)), fill: CHART_COLORS.positive },
    { name: 'Salary 1st', amount: Number(salary1st.toFixed(2)), fill: CHART_COLORS.positive },
    { name: 'Add. Income', amount: Number(additionalIncomeChase.toFixed(2)), fill: CHART_COLORS.positive },
    { name: 'Add. Payments', amount: Number((-additionalPaymentsChase).toFixed(2)), fill: CHART_COLORS.negative },
    { name: 'Expenses', amount: Number((-j36).toFixed(2)), fill: CHART_COLORS.overdue },
    { name: 'Month End', amount: Number(checkingAccountBalanceMonthEndChase.toFixed(2)), fill: CHART_COLORS.forecast },
  ]

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
              value={formatCurrencyInputValue(item.amount)}
              step="0.01"
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
              value={formatCurrencyInputValue(item.amount)}
              step="0.01"
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
    const monthEndBalance = totalBalance + subsection.additionalIncome

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
                value={formatCurrencyInputValue(subsection.biMonthlySalary)}
                step="0.01"
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
                value={formatCurrencyInputValue(subsection.checkingBalance)}
                step="0.01"
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
                value={formatCurrencyInputValue(subsection.additionalPayments)}
                step="0.01"
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
                value={formatCurrencyInputValue(subsection.additionalIncome)}
                step="0.01"
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

  const sortedCreditAccounts = sortItems(creditAccounts, (account) => {
    const metrics = getCreditMetrics(account)

    switch (creditSort.key) {
      case 'name':
        return account.name.toLowerCase()
      case 'availableCredit':
        return account.availableCredit
      case 'nextPaymentDate':
        return account.nextPaymentDate
      case 'paidThisMonth':
        return account.paidThisMonth
      case 'statementCycledAfterPayment':
        return account.statementCycledAfterPayment
      case 'lastStatementDate':
        return account.lastStatementDate
      case 'lastStatementBalance':
        return account.lastStatementBalance
      case 'creditLimit':
        return account.creditLimit
      case 'totalDueForCard':
        return metrics.totalDueForCard
      case 'currentMonthPayment':
        return metrics.currentMonthPayment
      case 'nextMonthStatementBalance':
        return metrics.nextMonthStatementBalance
      case 'utilizationPercent':
        return metrics.utilizationPercent
    }
  }, creditSort.direction)

  const expenseRows: ExpenseRow[] = expenseGroups.flatMap((group) =>
    group.items.map((item) => ({
      item,
      setter: group.setter,
    })),
  )

  const sortedExpenseRows = sortItems(expenseRows, ({ item }) => {
    switch (expenseSort.key) {
      case 'label':
        return item.label.toLowerCase()
      case 'payDate':
        return item.payDate
      case 'current':
        return item.current
      case 'next':
        return item.next
    }
  }, expenseSort.direction)

  const buildPayload = (overrides: Partial<FinancialPlanData> = {}): FinancialPlanData => ({
    creditAccounts: overrides.creditAccounts ?? creditAccounts,
    incomeItems: overrides.incomeItems ?? adjustedIncomeItems,
    balanceItems: overrides.balanceItems ?? adjustedBalanceItems,
    planoExpenses: overrides.planoExpenses ?? planoExpenses,
    sanfordExpenses: overrides.sanfordExpenses ?? sanfordExpenses,
    otherExpenses: overrides.otherExpenses ?? otherExpenses,
    columnLabels: overrides.columnLabels ?? columnLabels,
    sectionTitles: serializeSectionTitles(normalizeSectionTitles(overrides.sectionTitles ?? sectionTitles)),
    incomeSubsections: overrides.incomeSubsections ?? incomeSubsections,
    summary: overrides.summary,
  })

  const currentPlanSignature = useMemo(
    () => getFinancialPlanSignature(buildPayload()),
    [
      adjustedBalanceItems,
      adjustedIncomeItems,
      columnLabels,
      creditAccounts,
      incomeSubsections,
      otherExpenses,
      planoExpenses,
      sanfordExpenses,
      sectionTitles,
    ],
  )

  const hasUnsavedChanges = loadedPlanSignature !== null && currentPlanSignature !== loadedPlanSignature

  const statusText =
    saveState === 'loading' || saveState === 'saving'
      ? saveMessage
      : hasUnsavedChanges
        ? 'Unsaved changes'
        : saveState === 'error' || saveState === 'saved'
          ? saveMessage
          : ''

  const statusClassName = `status-text status-${hasUnsavedChanges && saveState === 'idle' ? 'saved' : saveState}`

  const applyFinancialPlan = (data: FinancialPlanData) => {
    setCreditAccounts(data.creditAccounts)
    setIncomeItemsState(data.incomeItems)
    setBalanceItemsState(data.balanceItems)
    setPlanoExpenses(data.planoExpenses)
    setSanfordExpenses(data.sanfordExpenses)
    setOtherExpenses(data.otherExpenses)
    setColumnLabels(data.columnLabels ?? defaultColumnLabels)
    setSectionTitles(normalizeSectionTitles(data.sectionTitles))
    setIncomeSubsections(data.incomeSubsections ?? defaultIncomeSubsections)
    setNewBankSubsectionIds(new Set())
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
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (response.status === 401) {
        setAuthenticatedUser(null)
        setAuthState('unauthenticated')
        setAuthMessage('Session expired. Sign in with Google to continue.')
        setSaveState('idle')
        setSaveMessage('')
        return false
      }

      if (!response.ok) {
        throw new Error(`Failed to save financial plan: ${response.status}`)
      }

      const savedData: FinancialPlanData = await response.json()
      applyFinancialPlan(savedData)
  setLoadedPlanSignature(getFinancialPlanSignature(savedData))
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

  const handleLogin = () => {
    window.location.href = LOGIN_URL
  }

  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      })
    } catch {
      // Logout should still clear local auth state even if the network fails.
    }

    setAuthenticatedUser(null)
    setAuthState('unauthenticated')
    setAuthMessage('Signed out.')
    setSaveState('idle')
    setSaveMessage('')
  }

  if (authState !== 'authenticated') {
    return (
      <div className="auth-shell">
        <section className="auth-card">
          <p className="eyebrow">Financial Planning</p>
          <h1>Personal Finance Tracker</h1>
          <p className="auth-copy">
            Sign in with Google to access the shared financial planning dashboard.
          </p>
          <button type="button" className="toolbar-button auth-button" onClick={handleLogin} disabled={authState === 'checking'}>
            {authState === 'checking' ? 'Checking...' : 'Sign in with Google'}
          </button>
          <p className={`auth-message auth-${authState}`}>{authMessage}</p>
        </section>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="hero">
        <div>
          <p className="eyebrow">Financial Planning</p>
          <h1>Personal Finance Tracker</h1>
          <p className="intro">
            Track cards, statements, payments, income, balances, and spreadsheet-style expense totals in one dashboard.
          </p>
        </div>
        <div className="hero-actions">
          {authenticatedUser ? (
            <div className="user-chip">
              {authenticatedUser.pictureUrl ? (
                <img src={authenticatedUser.pictureUrl} alt={authenticatedUser.name ?? authenticatedUser.email ?? 'Signed in user'} className="user-avatar" />
              ) : null}
              <div>
                <strong>{authenticatedUser.name ?? authenticatedUser.email}</strong>
                <span>{authenticatedUser.email}</span>
              </div>
            </div>
          ) : null}
          <button type="button" className="toolbar-button" onClick={handleSave} disabled={saveState === 'loading' || saveState === 'saving'}>
            {saveState === 'saving' ? 'Saving...' : 'Save Changes'}
          </button>
          <button type="button" className="toolbar-button" onClick={handleLogout}>Sign Out</button>
          <span className={statusClassName}>{statusText}</span>
        </div>
      </header>

      <section className="analytics-strip" aria-label="Top financial alerts">
        {overdueAlertData.map((item) => (
          <article key={item.label} className="analytics-kpi-card">
            <div className="analytics-kpi-header">
              <p>{item.label}</p>
              <strong>{item.value}</strong>
            </div>
            <span>{item.detail}</span>
            <div className="analytics-kpi-bar">
              <div style={{ width: `${item.ratio}%` }} />
            </div>
          </article>
        ))}
      </section>

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
                      <div className="sortable-header">
                        <input
                          type="text"
                          value={column.label}
                          onChange={(e) => updateColumnLabel('creditAccounts', index, e.target.value)}
                          className="label-input table-header-input"
                          style={{ width: getHeaderInputWidth(column.label) }}
                        />
                        <button
                          type="button"
                          className="sort-button"
                          onClick={() => toggleCreditSort([
                            'name',
                            'availableCredit',
                            'nextPaymentDate',
                            'paidThisMonth',
                            'statementCycledAfterPayment',
                            'lastStatementDate',
                            'lastStatementBalance',
                            'creditLimit',
                            'totalDueForCard',
                            'currentMonthPayment',
                            'nextMonthStatementBalance',
                            'utilizationPercent',
                          ][index] as CreditSortKey)}
                          aria-label={`Sort credit accounts by ${column.label}`}
                        >
                          {getSortIndicator(creditSort, [
                            'name',
                            'availableCredit',
                            'nextPaymentDate',
                            'paidThisMonth',
                            'statementCycledAfterPayment',
                            'lastStatementDate',
                            'lastStatementBalance',
                            'creditLimit',
                            'totalDueForCard',
                            'currentMonthPayment',
                            'nextMonthStatementBalance',
                            'utilizationPercent',
                          ][index] as CreditSortKey)}
                        </button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedCreditAccounts.map((account) => {
                const { totalDueForCard, currentMonthPayment, nextMonthStatementBalance, utilizationPercent } = getCreditMetrics(account)
                const isPastDueUnpaid = isPastDate(account.nextPaymentDate) && !account.paidThisMonth

                return (
                  <tr key={account.id} className={selectedCreditIds.has(account.id) ? 'row-selected' : ''}>
                    <td className="select-col">
                      <input type="checkbox" checked={selectedCreditIds.has(account.id)} onChange={() => toggleCreditSelection(account.id)} />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={account.name}
                        onChange={(e) => updateAccountById(account.id, 'name', e.target.value)}
                        className="label-input"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={account.availableCredit}
                        onChange={(e) => updateAccountById(account.id, 'availableCredit', parseFloat(e.target.value) || 0)}
                      />
                    </td>
                    <td>
                      <input
                        type="date"
                        value={account.nextPaymentDate}
                        onChange={(e) => updateAccountById(account.id, 'nextPaymentDate', e.target.value)}
                      />
                    </td>
                    <td className={isPastDueUnpaid ? 'overdue-checkbox-cell' : undefined}>
                      <input
                        type="checkbox"
                        checked={account.paidThisMonth}
                        onChange={(e) => updateAccountById(account.id, 'paidThisMonth', e.target.checked)}
                        className={isPastDueUnpaid ? 'overdue-checkbox' : undefined}
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={account.statementCycledAfterPayment}
                        onChange={(e) => updateAccountById(account.id, 'statementCycledAfterPayment', e.target.checked)}
                      />
                    </td>
                    <td>
                      <input
                        type="date"
                        value={account.lastStatementDate}
                        onChange={(e) => updateAccountById(account.id, 'lastStatementDate', e.target.value)}
                      />
                    </td>
                    <td>
                      <div className="currency-input-wrap">
                        <span className="currency-prefix">$</span>
                        <input
                          type="number"
                          value={formatCurrencyInputValue(account.lastStatementBalance)}
                          step="0.01"
                          onChange={(e) => updateAccountById(account.id, 'lastStatementBalance', parseFloat(e.target.value) || 0)}
                          className="currency-amount-input"
                        />
                      </div>
                    </td>
                    <td>
                      <div className="currency-input-wrap">
                        <span className="currency-prefix">$</span>
                        <input
                          type="number"
                          value={formatCurrencyInputValue(account.creditLimit)}
                          step="0.01"
                          onChange={(e) => updateAccountById(account.id, 'creditLimit', parseFloat(e.target.value) || 0)}
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
          <div className="chart-grid credit-chart-grid">
            <article className="chart-card">
              <div className="chart-card-header">
                <h3>Total Due by Card</h3>
                <span>Highest total due cards shown first</span>
              </div>
              <div className="chart-shell" style={{ height: `${creditVerticalChartHeight}px` }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={creditTotalDueData} layout="vertical" margin={{ top: 4, right: 12, left: 8, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} horizontal={false} />
                    <XAxis type="number" tickFormatter={(value) => chartCurrency(Number(value))} stroke={CHART_COLORS.text} fontSize={11} />
                    <YAxis type="category" dataKey="name" width={170} stroke={CHART_COLORS.text} fontSize={11} />
                    <Tooltip formatter={(value: number) => currency(value)} labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName ?? ''} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Bar dataKey="paymentDue" name="Payment Due" stackId="totalDue" fill={CHART_COLORS.current} radius={[0, 0, 0, 0]} />
                    <Bar dataKey="nextStmtBalance" name="Next Stmt Balance" stackId="totalDue" fill={CHART_COLORS.deferred} radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </article>
            <article className="chart-card">
              <div className="chart-card-header">
                <h3>Payment Due Timeline</h3>
                <span>Upcoming payment pressure by pay date</span>
              </div>
              <div className="chart-shell">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={paymentTimelineData} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
                    <XAxis dataKey="payDateLabel" stroke={CHART_COLORS.text} fontSize={11} />
                    <YAxis tickFormatter={(value) => chartCurrency(Number(value))} stroke={CHART_COLORS.text} fontSize={11} width={48} />
                    <Tooltip formatter={(value: number) => currency(value)} labelFormatter={(_, payload) => payload?.[0]?.payload?.name ?? ''} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Bar dataKey="paymentDue" name="Payment Due" fill={CHART_COLORS.current} radius={[6, 6, 0, 0]} />
                    <Bar dataKey="nextBalance" name="Next Stmt" fill={CHART_COLORS.next} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </article>
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
                      <div className="sortable-header">
                        <input
                          type="text"
                          value={column.label}
                          onChange={(e) => updateColumnLabel('debitExpenses', index, e.target.value)}
                          className="label-input table-header-input"
                        />
                        <button
                          type="button"
                          className="sort-button"
                          onClick={() => toggleExpenseSort(['label', 'payDate', 'current', 'next'][index] as ExpenseSortKey)}
                          aria-label={`Sort debit expenses by ${column.label}`}
                        >
                          {getSortIndicator(expenseSort, ['label', 'payDate', 'current', 'next'][index] as ExpenseSortKey)}
                        </button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                    {sortedExpenseRows.map(({ item, setter }) => {
                      const isPastDueCurrentExpense = isPastDate(item.payDate) && Math.abs(item.current) > 0.004

                      return (
                      <tr key={item.id} className={selectedExpenseIds.has(item.id) ? 'row-selected' : ''}>
                        <td className="select-col">
                          <input type="checkbox" checked={selectedExpenseIds.has(item.id)} onChange={() => toggleExpenseSelection(item.id)} />
                        </td>
                        <td>
                          <div className="editable-label-row">
                            <input
                              type="text"
                              value={item.label}
                              onChange={(e) => updateExpenseLabelById(setter, item.id, e.target.value)}
                              className="label-input"
                            />
                          </div>
                        </td>
                        <td>
                          <input
                            type="date"
                            value={item.payDate}
                            onChange={(e) => updateExpenseItemById(setter, item.id, 'payDate', e.target.value)}
                          />
                        </td>
                        <td>
                          <div className="currency-input-wrap expense-currency-input-wrap">
                            <span className="currency-prefix">$</span>
                            <input
                              type="number"
                              value={formatCurrencyInputValue(item.current)}
                              step="0.01"
                              onChange={(e) => updateExpenseItemById(setter, item.id, 'current', parseFloat(e.target.value) || 0)}
                              className={`currency-amount-input${isPastDueCurrentExpense ? ' overdue-amount-input' : ''}`}
                            />
                          </div>
                        </td>
                        <td>
                          <div className="currency-input-wrap expense-currency-input-wrap">
                            <span className="currency-prefix">$</span>
                            <input
                              type="number"
                              value={formatCurrencyInputValue(item.next)}
                              step="0.01"
                              onChange={(e) => updateExpenseItemById(setter, item.id, 'next', parseFloat(e.target.value) || 0)}
                              className="currency-amount-input"
                            />
                          </div>
                        </td>
                      </tr>
                      )
                })}
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
          <div className="expense-summary-section">
            <h3>Expense Grand Total</h3>
            <div className="summary-grid expense-summary-grid">
              <div className="summary-card">
                <p>Current Month</p>
                <strong>{currency(j36)}</strong>
              </div>
              <div className="summary-card">
                <p>Next Month</p>
                <strong>{currency(k36)}</strong>
              </div>
              <div className="summary-card">
                <p>Month After Next Month</p>
                <strong>{currency(monthAfterNextMonthExpense)}</strong>
              </div>
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
                    value={sectionTitles.defaultBank}
                    onChange={(e) => updateSectionTitle('defaultBank', e.target.value)}
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

      <div className="chart-grid cross-section-chart-grid">
        <article className="chart-card">
          <div className="chart-card-header">
            <h3>Expense Category Share</h3>
            <span>Plano, Sanford, and Other across current and next month</span>
          </div>
          <div className="chart-shell">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={expenseCategoryShareData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={54}
                  outerRadius={84}
                  paddingAngle={2}
                >
                  {expenseCategoryShareData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => currency(value)} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </article>
        <article className="chart-card">
          <div className="chart-card-header">
            <h3>Cash In vs Cash Out</h3>
            <span>Month-end balance drivers</span>
          </div>
          <div className="chart-shell chart-shell-bank">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cashFlowDriverData} margin={{ top: 4, right: 8, left: -12, bottom: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
                <XAxis dataKey="name" angle={-18} textAnchor="end" height={54} stroke={CHART_COLORS.text} fontSize={10} />
                <YAxis tickFormatter={(value) => chartCurrency(Number(value))} stroke={CHART_COLORS.text} fontSize={11} width={48} />
                <Tooltip formatter={(value: number) => currency(value)} />
                <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                  {cashFlowDriverData.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
      </div>
    </div>
  )
}
