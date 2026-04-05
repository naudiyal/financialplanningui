import React, { useEffect, useMemo, useRef, useState } from 'react'
import { NumericFormat } from 'react-number-format'
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

type PlanViewMode = 'personal' | 'sample'

type PersonalPlanSnapshot = {
  data: FinancialPlanData
  loadedSignature: string | null
  saveState: 'idle' | 'loading' | 'saving' | 'saved' | 'error'
  saveMessage: string
}

type AnalyticsKpiCard = {
  label: string
  value: string | number
  detail: string
  ratio: number
  cardStyle?: React.CSSProperties
  labelStyle?: React.CSSProperties
  valueStyle?: React.CSSProperties
  detailStyle?: React.CSSProperties
  barStyle?: React.CSSProperties
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

const advanceIsoDateByOneMonth = (value: string) => {
  const [year, month, day] = value.split('-').map(Number)

  if (!year || !month || !day) {
    return value
  }

  const targetMonth = month
  const targetDate = new Date(year, targetMonth, 1)
  const lastDayOfTargetMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0).getDate()
  targetDate.setDate(Math.min(day, lastDayOfTargetMonth))

  return `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`
}

const joinClassNames = (...classNames: Array<string | undefined>) => classNames.filter(Boolean).join(' ')

type CurrencyInputProps = {
  value: number
  onValueChange: (value: number) => void
  wrapClassName?: string
  inputClassName?: string
}

const CurrencyInput = ({ value, onValueChange, wrapClassName, inputClassName }: CurrencyInputProps) => (
  <div className={joinClassNames('currency-input-wrap', wrapClassName)}>
    <span className="currency-prefix">$</span>
    <NumericFormat
      value={value}
      thousandSeparator
      decimalScale={2}
      fixedDecimalScale
      allowNegative={false}
      inputMode="decimal"
      onValueChange={({ floatValue }) => onValueChange(floatValue ?? 0)}
      className={inputClassName ?? 'currency-amount-input'}
    />
  </div>
)

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

const formatLongDate = (value: Date) =>
  value.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

const formatCompactCycleDate = (value: Date) =>
  value.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

const createLocalDate = (year: number, monthIndex: number, day: number) => new Date(year, monthIndex, day, 12)

const getBudgetCycleTimeline = (today: Date) => {
  const cycleAnchorDay = 15
  const currentDate = createLocalDate(today.getFullYear(), today.getMonth(), today.getDate())
  const previousMidMonth =
    currentDate.getDate() >= cycleAnchorDay
      ? createLocalDate(currentDate.getFullYear(), currentDate.getMonth(), cycleAnchorDay)
      : createLocalDate(currentDate.getFullYear(), currentDate.getMonth() - 1, cycleAnchorDay)
  const nextMidMonth = createLocalDate(previousMidMonth.getFullYear(), previousMidMonth.getMonth() + 1, cycleAnchorDay)
  const endOfMonth = createLocalDate(previousMidMonth.getFullYear(), previousMidMonth.getMonth() + 1, 0)
  const millisecondsPerDay = 24 * 60 * 60 * 1000
  const totalDays = Math.max(1, Math.round((nextMidMonth.getTime() - previousMidMonth.getTime()) / millisecondsPerDay))
  const elapsedDays = Math.min(totalDays, Math.max(0, Math.round((currentDate.getTime() - previousMidMonth.getTime()) / millisecondsPerDay)))
  const remainingDays = Math.max(0, totalDays - elapsedDays)
  const progressPercent = Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100))
  const markerPercent = Math.min(96, Math.max(4, progressPercent))
  const endOfMonthPercent = Math.min(
    96,
    Math.max(4, (Math.round((endOfMonth.getTime() - previousMidMonth.getTime()) / millisecondsPerDay) / totalDays) * 100),
  )

  return {
    previousMidMonth,
    currentDate,
    endOfMonth,
    nextMidMonth,
    elapsedDays,
    remainingDays,
    totalDays,
    progressPercent,
    markerPercent,
    endOfMonthPercent,
  }
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

const getExpenseCategoryFromLabel = (label: string) => {
  if (!label.includes(' - ')) {
    return 'Other'
  }

  const [prefix] = label.split(' - ', 1)
  const normalizedPrefix = prefix.trim()
  return normalizedPrefix.length > 0 ? normalizedPrefix : 'Other'
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

const getSavingsNextMonthCardStyles = (amount: number, monthlyIncome: number) => {
  const neutralBand = Math.max(monthlyIncome * 0.05, 250)

  if (amount < -neutralBand) {
    const severity = Math.min(1, (Math.abs(amount) - neutralBand) / Math.max(monthlyIncome * 0.25, 1))
    return {
      cardStyle: {
        borderColor: `hsl(0 72% ${58 - severity * 10}%)`,
        background: `linear-gradient(180deg, hsl(0 100% ${98 - severity * 2}%) 0%, hsl(8 100% ${94 - severity * 4}%) 100%)`,
      },
      labelStyle: { color: `hsl(0 42% ${34 - severity * 4}%)` },
      valueStyle: { color: `hsl(0 72% ${30 - severity * 4}%)` },
      detailStyle: { color: `hsl(0 30% ${42 - severity * 6}%)` },
      barStyle: {
        background: `linear-gradient(90deg, hsl(14 90% ${62 - severity * 8}%), hsl(0 78% ${50 - severity * 6}%))`,
      },
    }
  }

  if (amount <= neutralBand) {
    const calm = 1 - Math.min(1, Math.abs(amount) / Math.max(neutralBand, 1))
    return {
      cardStyle: {
        borderColor: `hsl(42 72% ${66 - calm * 6}%)`,
        background: `linear-gradient(180deg, hsl(42 100% ${98 - calm}%) 0%, hsl(44 100% ${94 - calm * 2}%) 100%)`,
      },
      labelStyle: { color: 'hsl(32 28% 34%)' },
      valueStyle: { color: 'hsl(30 52% 30%)' },
      detailStyle: { color: 'hsl(34 22% 42%)' },
      barStyle: {
        background: `linear-gradient(90deg, hsl(42 90% ${62 - calm * 4}%), hsl(34 86% ${56 - calm * 4}%))`,
      },
    }
  }

  const strength = Math.min(1, (amount - neutralBand) / Math.max(monthlyIncome * 0.3, 1))
  return {
    cardStyle: {
      borderColor: `hsl(${124 + strength * 12} 52% ${48 - strength * 4}%)`,
      background: `linear-gradient(180deg, hsl(140 55% ${98 - strength * 2}%) 0%, hsl(138 60% ${93 - strength * 5}%) 100%)`,
    },
    labelStyle: { color: `hsl(145 36% ${30 - strength * 4}%)` },
    valueStyle: { color: `hsl(150 62% ${26 - strength * 4}%)` },
    detailStyle: { color: `hsl(146 22% ${40 - strength * 4}%)` },
    barStyle: {
      background: `linear-gradient(90deg, hsl(90 58% ${48 - strength * 4}%), hsl(152 68% ${40 - strength * 4}%))`,
    },
  }
}

const getCountRiskCardStyles = (count: number, warningCount = 4) => {
  if (count <= 0) {
    return {
      cardStyle: {
        borderColor: 'hsl(145 44% 52%)',
        background: 'linear-gradient(180deg, hsl(142 53% 98%) 0%, hsl(144 53% 94%) 100%)',
      },
      labelStyle: { color: 'hsl(145 34% 30%)' },
      valueStyle: { color: 'hsl(149 58% 26%)' },
      detailStyle: { color: 'hsl(145 18% 40%)' },
      barStyle: {
        background: 'linear-gradient(90deg, hsl(104 48% 50%), hsl(154 63% 40%))',
      },
    }
  }

  const severity = Math.min(1, count / Math.max(warningCount, 1))
  return {
    cardStyle: {
      borderColor: `hsl(2 72% ${58 - severity * 10}%)`,
      background: `linear-gradient(180deg, hsl(0 100% ${98 - severity * 2}%) 0%, hsl(10 100% ${94 - severity * 4}%) 100%)`,
    },
    labelStyle: { color: `hsl(0 42% ${34 - severity * 4}%)` },
    valueStyle: { color: `hsl(1 72% ${30 - severity * 4}%)` },
    detailStyle: { color: `hsl(0 28% ${42 - severity * 6}%)` },
    barStyle: {
      background: `linear-gradient(90deg, hsl(22 92% ${60 - severity * 8}%), hsl(0 76% ${48 - severity * 6}%))`,
    },
  }
}

const getExposureCardStyles = (exposureAmount: number, monthlySalary: number) => {
  if (monthlySalary <= 0) {
    return {
      cardStyle: {
        borderColor: 'hsl(214 32% 78%)',
        background: 'linear-gradient(180deg, hsl(210 20% 98%) 0%, hsl(215 24% 94%) 100%)',
      },
      labelStyle: { color: 'hsl(215 20% 34%)' },
      valueStyle: { color: 'hsl(215 32% 26%)' },
      detailStyle: { color: 'hsl(215 16% 42%)' },
      barStyle: {
        background: 'linear-gradient(90deg, hsl(210 18% 66%), hsl(215 24% 56%))',
      },
    }
  }

  const exposureRatio = exposureAmount / monthlySalary

  if (exposureRatio > 1) {
    const severity = Math.min(1, exposureRatio - 1)
    return {
      cardStyle: {
        borderColor: `hsl(0 72% ${58 - severity * 10}%)`,
        background: `linear-gradient(180deg, hsl(0 100% ${98 - severity * 2}%) 0%, hsl(10 100% ${94 - severity * 4}%) 100%)`,
      },
      labelStyle: { color: `hsl(0 42% ${34 - severity * 4}%)` },
      valueStyle: { color: `hsl(0 72% ${30 - severity * 4}%)` },
      detailStyle: { color: `hsl(0 28% ${42 - severity * 6}%)` },
      barStyle: {
        background: `linear-gradient(90deg, hsl(22 92% ${60 - severity * 8}%), hsl(0 76% ${48 - severity * 6}%))`,
      },
    }
  }

  if (exposureRatio >= 0.75) {
    const concern = Math.min(1, (exposureRatio - 0.75) / 0.25)
    return {
      cardStyle: {
        borderColor: `hsl(34 76% ${62 - concern * 8}%)`,
        background: `linear-gradient(180deg, hsl(40 100% ${98 - concern}%) 0%, hsl(38 100% ${94 - concern * 3}%) 100%)`,
      },
      labelStyle: { color: `hsl(30 30% ${34 - concern * 3}%)` },
      valueStyle: { color: `hsl(28 54% ${30 - concern * 4}%)` },
      detailStyle: { color: `hsl(30 22% ${42 - concern * 4}%)` },
      barStyle: {
        background: `linear-gradient(90deg, hsl(48 90% ${60 - concern * 6}%), hsl(24 88% ${52 - concern * 4}%))`,
      },
    }
  }

  const comfort = Math.min(1, (0.75 - exposureRatio) / 0.75)
  return {
    cardStyle: {
      borderColor: `hsl(${126 + comfort * 10} 48% ${50 - comfort * 4}%)`,
      background: `linear-gradient(180deg, hsl(142 53% ${98 - comfort * 2}%) 0%, hsl(144 53% ${94 - comfort * 5}%) 100%)`,
    },
    labelStyle: { color: `hsl(145 34% ${30 - comfort * 3}%)` },
    valueStyle: { color: `hsl(149 58% ${26 - comfort * 4}%)` },
    detailStyle: { color: `hsl(145 18% ${40 - comfort * 4}%)` },
    barStyle: {
      background: `linear-gradient(90deg, hsl(104 48% ${50 - comfort * 4}%), hsl(154 63% ${40 - comfort * 4}%))`,
    },
  }
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
  const [selectedBankSubsectionIds, setSelectedBankSubsectionIds] = useState<Set<string>>(new Set())
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
  const [planViewMode, setPlanViewMode] = useState<PlanViewMode>('personal')
  const [personalPlanSnapshot, setPersonalPlanSnapshot] = useState<PersonalPlanSnapshot | null>(null)
  const [hasSavedPersonalPlan, setHasSavedPersonalPlan] = useState(false)
  const [authState, setAuthState] = useState<'checking' | 'authenticated' | 'unauthenticated' | 'error'>('checking')
  const [authenticatedUser, setAuthenticatedUser] = useState<AuthStatusResponse | null>(null)
  const [authMessage, setAuthMessage] = useState('Checking sign-in status...')
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [showSamplePrompt, setShowSamplePrompt] = useState(false)
  const [isHelpDialogOpen, setIsHelpDialogOpen] = useState(false)
  const [isSampleConfirmDialogOpen, setIsSampleConfirmDialogOpen] = useState(false)
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [deleteState, setDeleteState] = useState<'idle' | 'deleting' | 'error'>('idle')
  const [deleteMessage, setDeleteMessage] = useState('')
  const [creditTableWidth, setCreditTableWidth] = useState<number | null>(null)
  const userMenuRef = useRef<HTMLDivElement | null>(null)
  const creditTableWrapperRef = useRef<HTMLDivElement | null>(null)
  const dismissSamplePromptOnMenuCloseRef = useRef(false)

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
      setSelectedBankSubsectionIds(new Set())
      setSelectedCreditIds(new Set())
      setSelectedExpenseIds(new Set())
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
        const hasSavedPlanHeader = response.headers.get('X-Has-Saved-Plan')
        if (!isMounted) {
          return
        }

        applyFinancialPlan(data)
        setPlanViewMode('personal')
        setPersonalPlanSnapshot({
          data,
          loadedSignature: getFinancialPlanSignature(data),
          saveState: 'idle',
          saveMessage: '',
        })
        setHasSavedPersonalPlan(hasSavedPlanHeader === 'true')
        setShowSamplePrompt(hasSavedPlanHeader !== 'true')
        setLoadedPlanSignature(getFinancialPlanSignature(data))
        setAuthState('authenticated')
        setSaveState('idle')
        setSaveMessage('')
      } catch {
        if (!isMounted) {
          return
        }

        setLoadedPlanSignature(getFinancialPlanSignature(defaultFinancialPlanData))
        setHasSavedPersonalPlan(false)
        setShowSamplePrompt(false)
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
          setHasSavedPersonalPlan(false)
          setShowSamplePrompt(false)
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
        setHasSavedPersonalPlan(false)
        setShowSamplePrompt(false)
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

  useEffect(() => {
    if (!isUserMenuOpen) {
      if (dismissSamplePromptOnMenuCloseRef.current && showSamplePrompt) {
        dismissSamplePromptOnMenuCloseRef.current = false
        setShowSamplePrompt(false)
      }
      return
    }

    if (showSamplePrompt) {
      dismissSamplePromptOnMenuCloseRef.current = true
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
    }
  }, [isUserMenuOpen, showSamplePrompt])

  useEffect(() => {
    const wrapper = creditTableWrapperRef.current

    if (!wrapper) {
      return
    }

    const updateCreditTableWidth = () => {
      setCreditTableWidth(wrapper.getBoundingClientRect().width)
    }

    updateCreditTableWidth()

    const resizeObserver = new ResizeObserver(() => {
      updateCreditTableWidth()
    })

    resizeObserver.observe(wrapper)

    return () => {
      resizeObserver.disconnect()
    }
  }, [columnLabels.creditAccounts, creditAccounts])

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
        checkingBalanceLabel: 'Account Balance',
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

  const toggleBankSubsectionSelection = (subsectionId: string) => {
    setSelectedBankSubsectionIds((prev) => {
      const next = new Set(prev)
      if (next.has(subsectionId)) {
        next.delete(subsectionId)
      } else {
        next.add(subsectionId)
      }
      return next
    })
  }

  const deleteSelectedBankSubsections = () => {
    if (selectedBankSubsectionIds.size === 0) {
      return
    }

    if (!window.confirm(`Delete ${selectedBankSubsectionIds.size} selected subsection${selectedBankSubsectionIds.size === 1 ? '' : 's'}?`)) {
      return
    }

    setNewBankSubsectionIds((current) => {
      const next = new Set(current)
      selectedBankSubsectionIds.forEach((subsectionId) => next.delete(subsectionId))
      return next
    })

    setSelectedBankSubsectionIds(new Set())

    void persistFinancialPlan(
      buildPayload({
        incomeSubsections: incomeSubsections.filter((subsection) => !selectedBankSubsectionIds.has(subsection.id)),
      }),
      selectedBankSubsectionIds.size === 1 ? 'Subsection deleted' : 'Subsections deleted',
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
  const savingsNextMonth = salaryTransferToChase - k36

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
      case 'savings-next-month':
        return { ...item, amount: savingsNextMonth }
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

  const savingsNextMonthCardStyles = getSavingsNextMonthCardStyles(savingsNextMonth, salaryTransferToChase)
  const overdueCardsStyles = getCountRiskCardStyles(overdueCreditAccounts.length, 4)
  const overdueExpensesStyles = getCountRiskCardStyles(overdueExpenses.length, 6)
  const currentMonthExposureStyles = getExposureCardStyles(j36, checkingAccountBalanceChase)
  const nextMonthExposureStyles = getExposureCardStyles(k36, salaryTransferToChase)
  const monthAfterNextMonthStyles = getExposureCardStyles(monthAfterNextMonthExpense, salaryTransferToChase)

  const overdueAlertData: AnalyticsKpiCard[] = [
    {
      label: 'Savings Next Month',
      value: currency(savingsNextMonth),
      detail: 'Projected leftover after next month expenses',
      ratio: Math.min(100, salaryTransferToChase === 0 ? 0 : Math.max(0, (savingsNextMonth / salaryTransferToChase) * 100)),
      ...savingsNextMonthCardStyles,
    },
    {
      label: 'Overdue Cards',
      value: overdueCreditAccounts.length,
      detail: overdueCreditAccounts.length === 1 ? '1 account needs payment' : `${overdueCreditAccounts.length} accounts need payment`,
      ratio: Math.min(100, creditAccounts.length === 0 ? 0 : (overdueCreditAccounts.length / creditAccounts.length) * 100),
      ...overdueCardsStyles,
    },
    {
      label: 'Overdue Expenses',
      value: overdueExpenses.length,
      detail: overdueExpenses.length === 1 ? '1 debit row is late' : `${overdueExpenses.length} debit rows are late`,
      ratio: Math.min(100, debitCardExpenseItems.length === 0 ? 0 : (overdueExpenses.length / debitCardExpenseItems.length) * 100),
      ...overdueExpensesStyles,
    },
    {
      label: 'Current Month Exposure',
      value: currency(j36),
      detail: 'Cards plus current debit expenses',
      ratio: Math.min(100, totalLimits === 0 ? 0 : (j36 / totalLimits) * 100),
      ...currentMonthExposureStyles,
    },
    {
      label: 'Next Month Exposure',
      value: currency(k36),
      detail: 'Projected next statement pressure',
      ratio: Math.min(100, totalLimits === 0 ? 0 : (k36 / totalLimits) * 100),
      ...nextMonthExposureStyles,
    },
    {
      label: 'Month After Next Month Exposure',
      value: currency(monthAfterNextMonthExpense),
      detail: 'Projected carry beyond next month',
      ratio: Math.min(100, totalLimits === 0 ? 0 : (monthAfterNextMonthExpense / totalLimits) * 100),
      ...monthAfterNextMonthStyles,
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

  const budgetCycleTimeline = useMemo(() => getBudgetCycleTimeline(new Date()), [])
  const budgetCycleTitle = `${formatCompactCycleDate(budgetCycleTimeline.previousMidMonth)} - ${formatCompactCycleDate(budgetCycleTimeline.nextMidMonth)}`
  const budgetCycleProgressLabel = `${Math.round(budgetCycleTimeline.progressPercent)}% through cycle • ${budgetCycleTimeline.remainingDays} days left`

  const savingsNextMonthPieData = savingsNextMonth >= 0
    ? [
        {
          name: 'Next Month Expenses',
          value: Number(Math.max(0, k36).toFixed(2)),
          color: CHART_COLORS.next,
        },
        {
          name: 'Savings Next Month',
          value: Number(Math.max(0, savingsNextMonth).toFixed(2)),
          color: CHART_COLORS.positive,
        },
      ].filter((entry) => entry.value > 0)
    : [
        {
          name: 'Chase Transfer',
          value: Number(Math.max(0, salaryTransferToChase).toFixed(2)),
          color: CHART_COLORS.forecast,
        },
        {
          name: 'Shortfall',
          value: Number(Math.abs(savingsNextMonth).toFixed(2)),
          color: CHART_COLORS.overdue,
        },
      ].filter((entry) => entry.value > 0)

  const hasSavingsNextMonthPieData = savingsNextMonthPieData.length > 0

  const creditChartHeight = 200
  const overviewChartHeight = 200

  const expenseCategoryPalette = [
    CHART_COLORS.current,
    CHART_COLORS.next,
    CHART_COLORS.deferred,
    CHART_COLORS.positive,
    CHART_COLORS.negative,
    CHART_COLORS.forecast,
    CHART_COLORS.overdue,
  ]

  const expenseCategoryTotals = debitCardExpenseItems.reduce<Map<string, { current: number; next: number }>>((totals, item) => {
    const categoryName = getExpenseCategoryFromLabel(item.label)
    const existingTotals = totals.get(categoryName) ?? { current: 0, next: 0 }

    totals.set(categoryName, {
      current: existingTotals.current + item.current,
      next: existingTotals.next + item.next,
    })

    return totals
  }, new Map())

  const expenseCategoryData = [...expenseCategoryTotals.entries()]
    .map(([name, totals]) => ({
      name,
      current: Number(totals.current.toFixed(2)),
      next: Number(totals.next.toFixed(2)),
    }))
    .sort((left, right) => right.current + right.next - (left.current + left.next) || left.name.localeCompare(right.name))

  const expenseCategoryShareData = expenseCategoryData
    .map((item, index) => ({
      name: item.name,
      value: Number((item.current + item.next).toFixed(2)),
      color: expenseCategoryPalette[index % expenseCategoryPalette.length],
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
          <CurrencyInput
            value={item.amount}
            onValueChange={(value) => updateIncomeItem(itemIndex, value)}
            inputClassName="amount-input currency-amount-input"
          />
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
          <CurrencyInput
            value={item.amount}
            onValueChange={(value) => updateBalanceItem(itemIndex, value)}
            inputClassName="amount-input currency-amount-input"
          />
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
      <div key={subsection.id} className={selectedBankSubsectionIds.has(subsection.id) ? 'subsection-block row-selected' : 'subsection-block'}>
        <div className="subsection-header">
          <label className="subsection-select-toggle">
            <input
              type="checkbox"
              checked={selectedBankSubsectionIds.has(subsection.id)}
              onChange={() => toggleBankSubsectionSelection(subsection.id)}
            />
          </label>
          <h3>
            <input
              type="text"
              value={subsection.title}
              onChange={(e) => updateIncomeSubsectionTitle(index, e.target.value)}
              className="label-input subsection-title-input"
            />
          </h3>
        </div>
        <div className="card-list">
          <article className="info-card">
            <input
              type="text"
              value={subsection.biMonthlySalaryLabel}
              onChange={(e) => updateIncomeSubsection(index, 'biMonthlySalaryLabel', e.target.value)}
              className="card-title label-input"
            />
            <CurrencyInput
              value={subsection.biMonthlySalary}
              onValueChange={(value) => updateIncomeSubsection(index, 'biMonthlySalary', value)}
              inputClassName="amount-input currency-amount-input"
            />
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
            <CurrencyInput
              value={subsection.checkingBalance}
              onValueChange={(value) => updateIncomeSubsection(index, 'checkingBalance', value)}
              inputClassName="amount-input currency-amount-input"
            />
          </article>
          <article className="info-card">
            <input
              type="text"
              value={subsection.additionalPaymentsLabel}
              onChange={(e) => updateIncomeSubsection(index, 'additionalPaymentsLabel', e.target.value)}
              className="card-title label-input"
            />
            <CurrencyInput
              value={subsection.additionalPayments}
              onValueChange={(value) => updateIncomeSubsection(index, 'additionalPayments', value)}
              inputClassName="amount-input currency-amount-input"
            />
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
            <CurrencyInput
              value={subsection.additionalIncome}
              onValueChange={(value) => updateIncomeSubsection(index, 'additionalIncome', value)}
              inputClassName="amount-input currency-amount-input"
            />
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

  const canStartNewBudgetCycle =
    creditAccounts.length > 0 &&
    creditAccounts.every((account) => account.paidThisMonth && account.statementCycledAfterPayment) &&
    debitCardExpenseItems.every((item) => Math.abs(item.current) < 0.004)

  const budgetCycleButtonTooltip = canStartNewBudgetCycle
    ? 'Start New Budget Cycle\n- Clears all paid checkboxes\n- Clears all statement cycled checkboxes\n- Copies next month debit expenses to current month\n- Moves debit pay dates ahead by one month\n- Leaves debit next month expense values unchanged'
    : 'Start New Budget Cycle is disabled until:\n- All credit cards are marked paid\n- All statements are marked statement cycled\n- All debit card current month expenses are 0\n\nWhen enabled, it will:\n- Clears all paid checkboxes\n- Clears all statement cycled checkboxes\n- Copies next month debit expenses to current month\n- Moves debit pay dates ahead by one month\n- Leaves debit next month expense values unchanged'

  const handleStartNewBudgetCycle = () => {
    if (!canStartNewBudgetCycle) {
      return
    }

    setCreditAccounts((current) =>
      current.map((account) => ({
        ...account,
        paidThisMonth: false,
        statementCycledAfterPayment: false,
      })),
    )

    const rollExpenseItems = (items: ExpenseItem[]) =>
      items.map((item) => ({
        ...item,
        current: item.next,
        payDate: advanceIsoDateByOneMonth(item.payDate),
      }))

    setPlanoExpenses((current) => rollExpenseItems(current))
    setSanfordExpenses((current) => rollExpenseItems(current))
    setOtherExpenses((current) => rollExpenseItems(current))
  }

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

  const isSampleMode = planViewMode === 'sample'
  const sampleHasLocalChanges = isSampleMode && loadedPlanSignature !== null && currentPlanSignature !== loadedPlanSignature

  const hasUnsavedChanges = !isSampleMode && loadedPlanSignature !== null && currentPlanSignature !== loadedPlanSignature

  const statusText =
    isSampleMode
      ? sampleHasLocalChanges
        ? 'Sample changes are local only'
        : 'Viewing sample plan'
      : saveState === 'loading' || saveState === 'saving'
      ? saveMessage
      : hasUnsavedChanges
        ? 'Unsaved changes'
        : saveState === 'error' || saveState === 'saved'
          ? saveMessage
          : ''

  const statusClassName = `status-text status-${isSampleMode ? 'saved' : hasUnsavedChanges && saveState === 'idle' ? 'saved' : saveState}`
    const creditWidthCapStyle = creditTableWidth ? { width: `min(100%, ${creditTableWidth}px)` } : undefined
    const creditWidthMaxStyle = creditTableWidth ? { maxWidth: `${creditTableWidth}px` } : undefined

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
    setSelectedBankSubsectionIds(new Set())
    setSelectedCreditIds(new Set())
    setSelectedExpenseIds(new Set())
  }

  const persistFinancialPlan = async (
    payload: FinancialPlanData,
    successMessage = 'Saved to server',
    onSuccess?: () => void,
  ) => {
    if (isSampleMode) {
      applyFinancialPlan(payload)
      onSuccess?.()
      setSaveState('idle')
      setSaveMessage('')
      return true
    }

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
      setPersonalPlanSnapshot({
        data: savedData,
        loadedSignature: getFinancialPlanSignature(savedData),
        saveState: 'saved',
        saveMessage: successMessage,
      })
        setHasSavedPersonalPlan(true)
      setShowSamplePrompt(false)
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
    if (isSampleMode) {
      setSaveState('idle')
      setSaveMessage('')
      return
    }

    await persistFinancialPlan(buildPayload())
  }

  const handleResetClick = () => {
    if (isSampleMode || !hasUnsavedChanges || !personalPlanSnapshot || saveState === 'loading' || saveState === 'saving') {
      return
    }

    setIsResetDialogOpen(true)
  }

  const handleResetCancel = () => {
    if (saveState === 'loading' || saveState === 'saving') {
      return
    }

    setIsResetDialogOpen(false)
  }

  const handleResetConfirm = () => {
    if (!personalPlanSnapshot) {
      setIsResetDialogOpen(false)
      return
    }

    applyFinancialPlan(personalPlanSnapshot.data)
    setLoadedPlanSignature(personalPlanSnapshot.loadedSignature)
    setSaveState('saved')
    setSaveMessage('Reset to last saved version.')
    setIsResetDialogOpen(false)
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
    setPlanViewMode('personal')
    setPersonalPlanSnapshot(null)
    setHasSavedPersonalPlan(false)
    setShowSamplePrompt(false)
    setSaveState('idle')
    setSaveMessage('')
  }

  const openSamplePlan = async () => {
    if (isSampleMode) {
      return
    }

    setIsUserMenuOpen(false)
    setIsSampleConfirmDialogOpen(false)
    setSaveState('loading')
    setSaveMessage('Loading sample plan...')

    try {
      const response = await fetch(`${API_BASE_URL}/api/financial-plan/sample`, {
        credentials: 'include',
      })

      if (response.status === 401) {
        setAuthenticatedUser(null)
        setAuthState('unauthenticated')
        setAuthMessage('Session expired. Sign in with Google to continue.')
        setPlanViewMode('personal')
        setPersonalPlanSnapshot(null)
        setSaveState('idle')
        setSaveMessage('')
        return
      }

      if (!response.ok) {
        throw new Error(`Failed to load sample financial plan: ${response.status}`)
      }

      const sampleData: FinancialPlanData = await response.json()
      applyFinancialPlan(sampleData)
      setPlanViewMode('sample')
      setLoadedPlanSignature(getFinancialPlanSignature(sampleData))
      setSaveState('idle')
      setSaveMessage('')
    } catch {
      setSaveState('error')
      setSaveMessage('Sample plan failed to load. Check the API server.')
    }
  }

  const shouldWarnBeforeSwitchingToSample = !isSampleMode && hasUnsavedChanges

  const handleSampleClick = async () => {
    if (shouldWarnBeforeSwitchingToSample) {
      setIsUserMenuOpen(false)
      setIsSampleConfirmDialogOpen(true)
      return
    }

    await openSamplePlan()
  }

  const handleSampleConfirmCancel = () => {
    if (saveState === 'saving') {
      return
    }

    setIsSampleConfirmDialogOpen(false)
  }

  const handleSampleConfirmProceed = async () => {
    await openSamplePlan()
  }

  const handleSampleConfirmSaveAndProceed = async () => {
    const saved = await persistFinancialPlan(buildPayload(), 'Saved to server')
    if (!saved) {
      return
    }

    await openSamplePlan()
  }

  const handleReturnToMyPlan = async () => {
    setIsUserMenuOpen(false)
    setSaveState('loading')
    setSaveMessage('Loading your plan...')

    try {
      const response = await fetch(`${API_BASE_URL}/api/financial-plan`, {
        credentials: 'include',
      })

      if (response.status === 401) {
        setAuthenticatedUser(null)
        setAuthState('unauthenticated')
        setAuthMessage('Session expired. Sign in with Google to continue.')
        setPlanViewMode('personal')
        setPersonalPlanSnapshot(null)
        setSaveState('idle')
        setSaveMessage('')
        return
      }

      if (!response.ok) {
        throw new Error(`Failed to load financial plan: ${response.status}`)
      }

      const data: FinancialPlanData = await response.json()
      const hasSavedPlanHeader = response.headers.get('X-Has-Saved-Plan')

      applyFinancialPlan(data)
      setLoadedPlanSignature(getFinancialPlanSignature(data))
      setPersonalPlanSnapshot({
        data,
        loadedSignature: getFinancialPlanSignature(data),
        saveState: 'idle',
        saveMessage: '',
      })
      setHasSavedPersonalPlan(hasSavedPlanHeader === 'true')
      setPlanViewMode('personal')
      setSaveState('idle')
      setSaveMessage('')
    } catch {
      if (personalPlanSnapshot) {
        applyFinancialPlan(personalPlanSnapshot.data)
        setLoadedPlanSignature(personalPlanSnapshot.loadedSignature)
        setSaveState(personalPlanSnapshot.saveState === 'loading' || personalPlanSnapshot.saveState === 'saving' ? 'idle' : personalPlanSnapshot.saveState)
        setSaveMessage(personalPlanSnapshot.saveMessage)
        setPlanViewMode('personal')
      } else {
        setSaveState('error')
        setSaveMessage('Failed to reload your plan. Check the API server.')
      }
    }
  }

  const handleDeleteTrackerClick = () => {
    if (isSampleMode) {
      return
    }

    setIsUserMenuOpen(false)
    setDeleteState('idle')
    setDeleteMessage('')
    setIsDeleteDialogOpen(true)
  }

  const handleHelpClick = () => {
    setIsUserMenuOpen(false)
    setIsHelpDialogOpen(true)
  }

  const handleHelpClose = () => {
    setIsHelpDialogOpen(false)
  }

  const handleDeleteTrackerCancel = () => {
    if (deleteState === 'deleting') {
      return
    }

    setIsDeleteDialogOpen(false)
    setDeleteState('idle')
    setDeleteMessage('')
  }

  const handleDeleteTrackerConfirm = async () => {
    if (isSampleMode) {
      setIsDeleteDialogOpen(false)
      return
    }

    setDeleteState('deleting')
    setDeleteMessage('Deleting your tracker data...')
    setSaveState('loading')
    setSaveMessage('Deleting tracker...')

    try {
      const deleteResponse = await fetch(`${API_BASE_URL}/api/financial-plan`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (deleteResponse.status === 401) {
        setAuthenticatedUser(null)
        setAuthState('unauthenticated')
        setAuthMessage('Session expired. Sign in with Google to continue.')
        setIsDeleteDialogOpen(false)
        setDeleteState('idle')
        setDeleteMessage('')
        setSaveState('idle')
        setSaveMessage('')
        return
      }

      if (!deleteResponse.ok) {
        throw new Error(`Failed to delete financial plan: ${deleteResponse.status}`)
      }

      const reloadResponse = await fetch(`${API_BASE_URL}/api/financial-plan`, {
        credentials: 'include',
      })

      if (reloadResponse.status === 401) {
        setAuthenticatedUser(null)
        setAuthState('unauthenticated')
        setAuthMessage('Session expired. Sign in with Google to continue.')
        setIsDeleteDialogOpen(false)
        setDeleteState('idle')
        setDeleteMessage('')
        setSaveState('idle')
        setSaveMessage('')
        return
      }

      if (!reloadResponse.ok) {
        throw new Error(`Failed to reload financial plan: ${reloadResponse.status}`)
      }

      const freshData: FinancialPlanData = await reloadResponse.json()
      applyFinancialPlan(freshData)
      setLoadedPlanSignature(getFinancialPlanSignature(freshData))
      setPersonalPlanSnapshot({
        data: freshData,
        loadedSignature: getFinancialPlanSignature(freshData),
        saveState: 'saved',
        saveMessage: 'Tracker deleted. Started fresh with a new plan.',
      })
      setHasSavedPersonalPlan(false)
      setShowSamplePrompt(false)
      setIsDeleteDialogOpen(false)
      setDeleteState('idle')
      setDeleteMessage('')
      setSaveState('saved')
      setSaveMessage('Tracker deleted. Started fresh with a new plan.')
    } catch {
      setDeleteState('error')
      setDeleteMessage('Delete failed. Check the API server.')
      setSaveState('error')
      setSaveMessage('Delete failed. Check the API server.')
    }
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
      <header className="hero" style={creditWidthCapStyle}>
        <div>
          <p className="eyebrow">Financial Planning</p>
          <h1>Personal Finance Tracker</h1>
          <p className="intro">
            Track cards, statements, payments, income, balances, and spreadsheet-style expense totals in one dashboard.
          </p>
        </div>
        <div className="hero-actions">
          {authenticatedUser ? (
            <div className="user-menu" ref={userMenuRef}>
              <button
                type="button"
                className={joinClassNames('user-chip user-chip-button', showSamplePrompt ? 'user-chip-highlight' : undefined)}
                onClick={() => setIsUserMenuOpen((current) => !current)}
                aria-expanded={isUserMenuOpen}
                aria-haspopup="menu"
              >
                {authenticatedUser.pictureUrl ? (
                  <img src={authenticatedUser.pictureUrl} alt={authenticatedUser.name ?? authenticatedUser.email ?? 'Signed in user'} className="user-avatar" />
                ) : null}
                <div>
                  <strong>{authenticatedUser.name ?? authenticatedUser.email}</strong>
                  <span>{authenticatedUser.email}</span>
                </div>
              </button>
              {isUserMenuOpen ? (
                <div className="user-menu-dropdown" role="menu">
                  {isSampleMode ? (
                    <button type="button" className="user-menu-item" onClick={handleReturnToMyPlan} role="menuitem">
                      Back to My Plan
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={joinClassNames('user-menu-item', showSamplePrompt ? 'user-menu-item-highlight' : undefined)}
                      onClick={handleSampleClick}
                      role="menuitem"
                    >
                      Sample Tracker
                    </button>
                  )}
                  {!isSampleMode ? (
                    <button type="button" className="user-menu-item user-menu-item-danger" onClick={handleDeleteTrackerClick} role="menuitem">
                      Delete My Tracker
                    </button>
                  ) : null}
                  <button type="button" className="user-menu-item" onClick={handleHelpClick} role="menuitem">
                    Help
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
          <span className="toolbar-button-wrap" title={budgetCycleButtonTooltip}>
            <button
              type="button"
              className="toolbar-button budget-cycle-button"
              onClick={handleStartNewBudgetCycle}
              disabled={!canStartNewBudgetCycle || saveState === 'loading' || saveState === 'saving'}
            >
              Start New Budget Cycle
            </button>
          </span>
          <button type="button" className="toolbar-button" onClick={handleSave} disabled={isSampleMode || saveState === 'loading' || saveState === 'saving'}>
            {isSampleMode ? 'Sample Not Saved' : saveState === 'saving' ? 'Saving...' : 'Save Changes'}
          </button>
          <button
            type="button"
            className="toolbar-button"
            onClick={handleResetClick}
            disabled={isSampleMode || !hasUnsavedChanges || !personalPlanSnapshot || saveState === 'loading' || saveState === 'saving'}
          >
            Reset
          </button>
          <button type="button" className="toolbar-button" onClick={handleLogout}>Sign Out</button>
          <span className={statusClassName}>{statusText}</span>
        </div>
      </header>

      {isSampleMode ? (
        <section className="sample-banner" aria-label="Sample plan mode" style={creditWidthCapStyle}>
          <div>
            <strong>Viewing sample plan</strong>
            <span>Changes stay only in this browser session and are not saved to the server.</span>
          </div>
          <button type="button" className="toolbar-button" onClick={handleReturnToMyPlan}>
            Go Back To My Plan
          </button>
        </section>
      ) : null}

      <section className="budget-cycle-panel" aria-label="Current budget cycle timeline" style={creditWidthCapStyle}>
        <div className="budget-cycle-header">
          <span className="budget-cycle-inline-title">Budget Cycle Timeline</span>
          <div className="budget-cycle-title-group">
            <p className="budget-cycle-title">{budgetCycleTitle}</p>
          </div>
          <div className="budget-cycle-header-meta">
            <div className="budget-cycle-progress-pill">{budgetCycleProgressLabel}</div>
          </div>
        </div>

        <div className="budget-cycle-track-stage">
          <div className="budget-cycle-current-label" style={{ left: `${budgetCycleTimeline.markerPercent}%` }}>
            <strong>Today {formatCompactCycleDate(budgetCycleTimeline.currentDate)}</strong>
          </div>

          <div className="budget-cycle-track" aria-hidden="true">
            <div className="budget-cycle-track-fill" style={{ width: `${budgetCycleTimeline.progressPercent}%` }} />
            <div className="budget-cycle-marker budget-cycle-marker-start" />
            <div className="budget-cycle-marker budget-cycle-marker-month-end" style={{ left: `${budgetCycleTimeline.endOfMonthPercent}%` }} />
            <div className="budget-cycle-marker budget-cycle-marker-current" style={{ left: `${budgetCycleTimeline.markerPercent}%` }} />
            <div className="budget-cycle-marker budget-cycle-marker-end" />
          </div>

          <div className="budget-cycle-boundaries">
            <div className="budget-cycle-boundary-card budget-cycle-boundary-card-start">
              <span>Prev {formatCompactCycleDate(budgetCycleTimeline.previousMidMonth)}</span>
            </div>
            <div className="budget-cycle-boundary-card budget-cycle-boundary-card-middle">
              <span>End {formatCompactCycleDate(budgetCycleTimeline.endOfMonth)}</span>
            </div>
            <div className="budget-cycle-boundary-card budget-cycle-boundary-card-end">
              <span>Next {formatCompactCycleDate(budgetCycleTimeline.nextMidMonth)}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="analytics-strip" aria-label="Top financial alerts" style={creditWidthCapStyle}>
        {overdueAlertData.map((item) => (
          <article key={item.label} className="analytics-kpi-card" style={item.cardStyle}>
            <div className="analytics-kpi-header">
              <p style={item.labelStyle}>{item.label}</p>
              <strong style={item.valueStyle}>{item.value}</strong>
            </div>
            <span style={item.detailStyle}>{item.detail}</span>
            <div className="analytics-kpi-bar">
              <div style={{ width: `${item.ratio}%`, ...item.barStyle }} />
            </div>
          </article>
        ))}
      </section>

      {isHelpDialogOpen ? (
        <div className="modal-backdrop" role="presentation">
          <section className="modal-card help-modal" role="dialog" aria-modal="true" aria-labelledby="help-title">
            <p className="eyebrow help-eyebrow">Help</p>
            <h2 id="help-title">How This Financial Tracker Works</h2>
            <p className="help-intro">
              This application helps you manage near-term cash flow by combining credit card obligations, debit card expenses,
              and bank account balances in one place. It is designed to show what needs attention now, what pressure is coming
              next month, and how today&apos;s decisions affect your projected balances.
            </p>

            <div className="help-section">
              <h3>Visual Walkthrough</h3>
              <div className="help-visual-grid">
                <article className="help-visual-card">
                  <div className="help-visual-frame" aria-hidden="true">
                    <div className="help-mock-toolbar">
                      <span className="help-mock-chip">Sample Tracker</span>
                      <span className="help-mock-button">Save Changes</span>
                      <span className="help-mock-button help-mock-button-muted">Reset</span>
                    </div>
                    <div className="help-mock-banner">Viewing sample plan</div>
                  </div>
                  <h4>Top Toolbar</h4>
                  <p>Use this area to save, reset local edits, enter sample mode, or start a new budget cycle.</p>
                </article>

                <article className="help-visual-card">
                  <div className="help-visual-frame" aria-hidden="true">
                    <div className="help-mock-table">
                      <div className="help-mock-table-header">
                        <span>Account</span>
                        <span>Avail Credit</span>
                        <span>Total Due</span>
                      </div>
                      <div className="help-mock-table-row">
                        <span>Chase Freedom</span>
                        <span>$4,250</span>
                        <span>$320</span>
                      </div>
                      <div className="help-mock-table-row">
                        <span>Amex Gold</span>
                        <span>$2,880</span>
                        <span>$145</span>
                      </div>
                      <div className="help-mock-table-total">
                        <span>Credit Card Totals</span>
                        <span>$7,130</span>
                        <span>$465</span>
                      </div>
                    </div>
                  </div>
                  <h4>Credit Card Accounts</h4>
                  <p>Track balances, due dates, and statement-cycle state. Totals at the bottom summarize overall exposure.</p>
                </article>

                <article className="help-visual-card">
                  <div className="help-visual-frame" aria-hidden="true">
                    <div className="help-mock-table help-mock-table-compact">
                      <div className="help-mock-table-header">
                        <span>Expense</span>
                        <span>Current</span>
                        <span>Next</span>
                      </div>
                      <div className="help-mock-table-row">
                        <span>Rent - Plano</span>
                        <span>$1,800</span>
                        <span>$1,800</span>
                      </div>
                      <div className="help-mock-table-row">
                        <span>Utilities - Home</span>
                        <span>$240</span>
                        <span>$210</span>
                      </div>
                    </div>
                    <div className="help-mock-split-bars">
                      <span className="help-mock-bar help-mock-bar-current"></span>
                      <span className="help-mock-bar help-mock-bar-next"></span>
                    </div>
                  </div>
                  <h4>Debit Card Expenses</h4>
                  <p>Separate what belongs to the current month from what should roll into next month.</p>
                </article>

                <article className="help-visual-card">
                  <div className="help-visual-frame" aria-hidden="true">
                    <div className="help-mock-bank-grid">
                      <div className="help-mock-bank-card">
                        <strong>Chase Checking</strong>
                        <span>$6,420</span>
                      </div>
                      <div className="help-mock-bank-card">
                        <strong>Month-End Salary</strong>
                        <span>$3,100</span>
                      </div>
                    </div>
                    <div className="help-mock-chart">
                      <span className="help-mock-chart-bar help-mock-chart-bar-in"></span>
                      <span className="help-mock-chart-bar help-mock-chart-bar-out"></span>
                      <span className="help-mock-chart-bar help-mock-chart-bar-net"></span>
                    </div>
                  </div>
                  <h4>Bank Accounts And Cash Flow</h4>
                  <p>Use balances and income timing together with the chart to understand how much cash remains after expenses.</p>
                </article>
              </div>
            </div>

            <div className="help-section">
              <h3>What This Application Helps You Manage</h3>
              <ul className="help-list">
                <li>Credit card balances, payment dates, statement balances, and projected next statement balances.</li>
                <li>Debit card expenses that belong to the current month and the next month.</li>
                <li>Bank account balances, salary timing, additional income, and additional payments.</li>
                <li>Projected financial exposure across current month, next month, and month after next month.</li>
              </ul>
            </div>

            <div className="help-section">
              <h3>How To Read The Main Sections</h3>
              <ul className="help-list">
                <li>Credit Card Accounts shows what is still owed, what is already paid, and what may roll into the next statement cycle.</li>
                <li>Debit Card Expenses separates expected spending into Current Month and Next Month so you can see near-term cash needs clearly.</li>
                <li>Bank Accounts lets you track balances and salary inflows for each bank subsection so projections reflect how cash is actually distributed.</li>
                <li>Top KPI tiles summarize savings, overdue items, and projected exposure so you can quickly spot risk areas.</li>
              </ul>
            </div>

            <div className="help-section">
              <h3>What The Key Metrics Mean</h3>
              <ul className="help-list">
                <li>Savings Next Month shows the projected amount left after next month expenses are covered from the transfer-to-Chase amount.</li>
                <li>Current Month Exposure shows current month credit card payments plus current month debit card expenses.</li>
                <li>Next Month Exposure shows projected next statement balances plus next month debit card expenses.</li>
                <li>Month After Next Month Exposure shows projected carry-forward pressure beyond next month.</li>
                <li>Overdue Cards and Overdue Expenses show how many items are already past due based on the dates in the tracker.</li>
              </ul>
            </div>

            <div className="help-section">
              <h3>How The Charts Should Be Interpreted</h3>
              <ul className="help-list">
                <li>Savings Next Month compares expected next month expense load against projected leftover savings or shortfall.</li>
                <li>Total Due by Card shows which cards are contributing the most to your total card burden.</li>
                <li>Payment Due Timeline shows when payment pressure is arriving by due date.</li>
                <li>Debit Card Expense Category groups debit expenses by the text before ` - ` in each expense label.</li>
                <li>If an expense label does not include a prefix before ` - `, it is grouped under Other.</li>
                <li>Cash In vs Cash Out shows the major drivers of projected month-end cash position.</li>
              </ul>
            </div>

            <div className="help-section">
              <h3>Important Workflow Actions</h3>
              <ul className="help-list">
                <li>Save Changes writes your current tracker data for your signed-in account and makes that version your new saved baseline.</li>
                <li>Reset discards unsaved local edits and restores the tracker to the last loaded or saved version after you confirm the warning.</li>
                <li>Sample Tracker opens a temporary sample plan view. Changes there stay only in the current browser session and are not written to your saved plan.</li>
                <li>Go Back To My Plan leaves sample mode and reloads your personal tracker.</li>
                <li>Start New Budget Cycle clears paid and statement-cycled flags, copies next month debit expenses into current month, advances pay dates by one month, and keeps debit next month values unchanged.</li>
                <li>Start New Budget Cycle is only enabled when all credit cards are marked paid, all statements are marked statement cycled, and all debit card current month expenses are 0.</li>
                <li>Delete My Tracker removes only your saved tracker data and then starts you fresh with a new seeded tracker.</li>
              </ul>
            </div>

            <div className="help-section">
              <h3>Business Rules To Keep In Mind</h3>
              <ul className="help-list">
                <li>Your data is tied to your signed-in Google account, so each user works with their own saved tracker.</li>
                <li>Unsaved edits are only local until you use Save Changes.</li>
                <li>Projections are only as accurate as the payment dates, balances, and current versus next month assignments you maintain.</li>
                <li>Debit expense labels affect chart grouping, so consistent label prefixes make the category chart more useful.</li>
                <li>Reset only affects your current unsaved edits. Delete My Tracker affects your saved personal data.</li>
                <li>Deleting your tracker does not delete other users&apos; data. It only resets your own saved plan.</li>
              </ul>
            </div>

            <div className="modal-actions">
              <button type="button" className="toolbar-button" onClick={handleHelpClose}>
                Close
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {isSampleConfirmDialogOpen ? (
        <div className="modal-backdrop" role="presentation">
          <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="sample-switch-title">
            <p className="eyebrow help-eyebrow">Unsaved Changes</p>
            <h2 id="sample-switch-title">Switch To Sample Plan?</h2>
            <p className="help-intro">
              You have unsaved changes in your plan. You can save first, or proceed to the sample plan and lose those unsaved changes.
            </p>
            <div className="modal-actions">
              <button type="button" className="toolbar-button" onClick={handleSampleConfirmCancel} disabled={saveState === 'saving'}>
                Cancel
              </button>
              <button type="button" className="toolbar-button" onClick={handleSampleConfirmProceed} disabled={saveState === 'saving'}>
                Proceed To Sample
              </button>
              <button type="button" className="toolbar-button" onClick={handleSampleConfirmSaveAndProceed} disabled={saveState === 'saving'}>
                {saveState === 'saving' ? 'Saving...' : 'Save And Proceed'}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {isResetDialogOpen ? (
        <div className="modal-backdrop" role="presentation">
          <section className="modal-card danger-modal" role="alertdialog" aria-modal="true" aria-labelledby="reset-tracker-title">
            <p className="eyebrow danger-eyebrow">Unsaved Changes</p>
            <h2 id="reset-tracker-title">Reset Tracker Changes?</h2>
            <p className="danger-copy">
              This will discard your unsaved changes and restore the tracker to the last saved version.
            </p>
            <p className="danger-copy-subtle">
              If you continue, you will lose the changes you made since the last load or save.
            </p>
            <div className="modal-actions">
              <button type="button" className="toolbar-button" onClick={handleResetCancel} disabled={saveState === 'loading' || saveState === 'saving'}>
                Cancel
              </button>
              <button
                type="button"
                className="toolbar-button destructive-button"
                onClick={handleResetConfirm}
                disabled={saveState === 'loading' || saveState === 'saving'}
              >
                Reset Changes
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {isDeleteDialogOpen ? (
        <div className="modal-backdrop" role="presentation">
          <section className="modal-card danger-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-tracker-title">
            <p className="eyebrow danger-eyebrow">Danger Zone</p>
            <h2 id="delete-tracker-title">Delete My Tracker?</h2>
            <p className="danger-copy">
              This will delete your saved tracker data from the database. You will have to start everything from scratch.
            </p>
            <p className="danger-copy-subtle">
              If you cancel, nothing happens. If you confirm, your current saved tracker will be removed and a fresh tracker will be created for you.
            </p>
            {deleteState === 'error' ? <p className="auth-message auth-error">{deleteMessage}</p> : null}
            <div className="modal-actions">
              <button type="button" className="toolbar-button" onClick={handleDeleteTrackerCancel} disabled={deleteState === 'deleting'}>
                Cancel
              </button>
              <button
                type="button"
                className="toolbar-button destructive-button"
                onClick={handleDeleteTrackerConfirm}
                disabled={deleteState === 'deleting'}
              >
                {deleteState === 'deleting' ? 'Deleting...' : 'Delete My Tracker'}
              </button>
            </div>
          </section>
        </div>
      ) : null}

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
          <div className="table-wrapper compact-credit-table" ref={creditTableWrapperRef}>
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
                      <CurrencyInput
                        value={account.availableCredit}
                        onValueChange={(value) => updateAccountById(account.id, 'availableCredit', value)}
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
                      <CurrencyInput
                        value={account.lastStatementBalance}
                        onValueChange={(value) => updateAccountById(account.id, 'lastStatementBalance', value)}
                      />
                    </td>
                    <td>
                      <CurrencyInput
                        value={account.creditLimit}
                        onValueChange={(value) => updateAccountById(account.id, 'creditLimit', value)}
                      />
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
          <div className="section-cluster chart-grid credit-chart-grid" style={creditWidthCapStyle}>
            <article className="chart-card">
              <div className="chart-card-header">
                <h3>Savings Next Month</h3>
                <span>{savingsNextMonth >= 0 ? 'Next month expenses vs remaining savings' : 'Next month expenses exceed transfer'}</span>
              </div>
              <div className="chart-shell" style={{ height: `${creditChartHeight}px` }}>
                {hasSavingsNextMonthPieData ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={savingsNextMonthPieData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={54}
                        outerRadius={84}
                        paddingAngle={2}
                      >
                        {savingsNextMonthPieData.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => currency(value)} />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="chart-empty-state">No next month savings data yet</div>
                )}
              </div>
            </article>
            <article className="chart-card">
              <div className="chart-card-header">
                <h3>Total Due by Card</h3>
                <span>Highest total due cards shown first</span>
              </div>
              <div className="chart-shell" style={{ height: `${creditChartHeight}px` }}>
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
              <div className="chart-shell" style={{ height: `${creditChartHeight}px` }}>
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

      <div className="section-cluster finance-overview-row" style={creditWidthCapStyle}>
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
          <div
            className="table-wrapper compact-expense-table"
            style={creditWidthMaxStyle}
          >
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
                          <CurrencyInput
                            value={item.current}
                            onValueChange={(value) => updateExpenseItemById(setter, item.id, 'current', value)}
                            wrapClassName="expense-currency-input-wrap"
                            inputClassName={joinClassNames('currency-amount-input', isPastDueCurrentExpense ? 'overdue-amount-input' : undefined)}
                          />
                        </td>
                        <td>
                          <CurrencyInput
                            value={item.next}
                            onValueChange={(value) => updateExpenseItemById(setter, item.id, 'next', value)}
                            wrapClassName="expense-currency-input-wrap"
                          />
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
        </section>

        <article className="chart-card compact-section expense-category-side-panel">
          <div className="chart-card-header">
            <h3>Debit Card Expense Category</h3>
            <span>Grouped by label prefix across current and next month</span>
          </div>
          <div className="chart-shell" style={{ height: `${overviewChartHeight}px` }}>
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

      </div>

      <div className="section-cluster finance-overview-row" style={creditWidthCapStyle}>

        <section className="compact-section compact-side-panel bank-accounts-section">
          <div className="section-content-fit">
            <div className="section-header bank-section-header">
              <h2>
                <input
                  type="text"
                  value={sectionTitles.incomeSchedule}
                  onChange={(e) => updateSectionTitle('incomeSchedule', e.target.value)}
                  className="label-input section-title-input"
                  style={{ width: getHeaderInputWidth(sectionTitles.incomeSchedule, 14) }}
                />
              </h2>
              <div className="section-header-actions">
                {selectedBankSubsectionIds.size > 0 && (
                  <button type="button" className="delete-row-button" onClick={deleteSelectedBankSubsections}>Delete ({selectedBankSubsectionIds.size})</button>
                )}
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

        <article className="chart-card compact-section cashflow-side-panel">
          <div className="chart-card-header">
            <h3>Cash In vs Cash Out</h3>
            <span>Month-end balance drivers</span>
          </div>
          <div className="chart-shell chart-shell-bank" style={{ height: `${overviewChartHeight}px` }}>
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
