import React, { startTransition, useEffect, useMemo, useRef, useState } from 'react'
import { NumericFormat } from 'react-number-format'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Line,
  LineChart,
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
import { createVerifyToken, decryptJson, deriveKey, encryptJson, verifyPin } from './utils/encryptionUtils'

type ExpenseItem = {
  id: string
  label: string
  payDate: string
  payFromBankId: string
  current: number
  next: number
}

type BankPayFromOption = {
  id: string
  label: string
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
  viewModes?: FinancialPlanViewModes
  incomeSubsections?: IncomeSubsection[]
  summary?: Record<string, number>
  encryptedData?: string
  encryptionIv?: string
  pinVerify?: string
  pinVerifyIv?: string
}

type AuthStatusResponse = {
  authenticated: boolean
  admin: boolean
  encryptionExempt: boolean
  termsAccepted: boolean
  requiredTermsVersion: string | null
  acceptedTermsVersion: string | null
  acceptedTermsAt: string | null
  email: string | null
  name: string | null
  pictureUrl: string | null
}

type SharedViewerUserSummary = {
  userSub: string
  email: string | null
  displayName: string | null
  lastUpdatedAt: string | null
  encryptionExempt: boolean
}

type TimelineType = 'MID_TO_MID' | 'START_TO_END'

type PlanViewMode = 'personal' | 'sample'

const PERSONAL_ROUTE = '/'
const TRACKERS_ROUTE = '/trackers'
const TERMS_LAST_UPDATED_LABEL = 'May 2, 2026'

type AppRoute = typeof PERSONAL_ROUTE | typeof TRACKERS_ROUTE

type CycleSelection = 'current' | 'previous'

type CyclePeriod = {
  startDate: string
  endDate: string
}

type FinancialPlanCycleResponse = {
  data: FinancialPlanData
  selectedCycle: CycleSelection
  timelineType: TimelineType
  currentCycle: CyclePeriod
  previousCycle: CyclePeriod | null
  hasPreviousCycle: boolean
  readOnly: boolean
  hasSavedPlan: boolean
  canCloseCycle: boolean
  lastCycleSavedAt: string | null
}

type BankBalanceHistoryPoint = {
  bankId: string
  bankName: string
  monthEndBalanceMinusDues: number
}

type BankBalanceHistoryCycle = {
  cycle: CyclePeriod
  banks: BankBalanceHistoryPoint[]
  encryptedHistoryData?: string
  encryptionIv?: string
}

type BankBalanceHistoryResponse = {
  timelineType: TimelineType
  cycles: BankBalanceHistoryCycle[]
}

type PersonalPlanSnapshot = {
  data: FinancialPlanData
  loadedSignature: string | null
  saveState: 'idle' | 'loading' | 'saving' | 'saved' | 'error'
  saveMessage: string
}

type PendingCloseCycleReset = {
  currentCycle: CyclePeriod
  previousCycle: CyclePeriod
  previousData: FinancialPlanData
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
const BUILD_VERSION_LABEL = `Build v${__APP_VERSION__}`
const HISTORY_REQUEST_TIMEOUT_MS = 10_000
const FIRST_PAYCHECK_ID = 'first-paycheck'
const SECOND_PAYCHECK_ID = 'second-paycheck'

const normalizeAppRoute = (pathname: string): AppRoute => (pathname === TRACKERS_ROUTE ? TRACKERS_ROUTE : PERSONAL_ROUTE)

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

type CurrencyConfig = { code: string; locale: string; symbol: string; label: string }

const SUPPORTED_CURRENCIES: readonly CurrencyConfig[] = [
  { code: 'USD', locale: 'en-US', symbol: '$', label: 'USD — US Dollar ($)' },
  { code: 'CAD', locale: 'en-CA', symbol: 'CA$', label: 'CAD — Canadian Dollar (CA$)' },
  { code: 'GBP', locale: 'en-GB', symbol: '£', label: 'GBP — British Pound (£)' },
  { code: 'EUR', locale: 'en-IE', symbol: '€', label: 'EUR — Euro (€)' },
  { code: 'AUD', locale: 'en-AU', symbol: 'A$', label: 'AUD — Australian Dollar (A$)' },
  { code: 'NZD', locale: 'en-NZ', symbol: 'NZ$', label: 'NZD — New Zealand Dollar (NZ$)' },
  { code: 'SGD', locale: 'en-SG', symbol: 'S$', label: 'SGD — Singapore Dollar (S$)' },
  { code: 'HKD', locale: 'zh-HK', symbol: 'HK$', label: 'HKD — Hong Kong Dollar (HK$)' },
  { code: 'CHF', locale: 'de-CH', symbol: 'CHF', label: 'CHF — Swiss Franc (CHF)' },
  { code: 'SEK', locale: 'sv-SE', symbol: 'kr', label: 'SEK — Swedish Krona (kr)' },
  { code: 'NOK', locale: 'nb-NO', symbol: 'kr', label: 'NOK — Norwegian Krone (kr)' },
  { code: 'DKK', locale: 'da-DK', symbol: 'kr', label: 'DKK — Danish Krone (kr)' },
  { code: 'INR', locale: 'en-IN', symbol: '₹', label: 'INR — Indian Rupee (₹)' },
  { code: 'PKR', locale: 'en-PK', symbol: '₨', label: 'PKR — Pakistani Rupee (₨)' },
  { code: 'BDT', locale: 'bn-BD', symbol: '৳', label: 'BDT — Bangladeshi Taka (৳)' },
  { code: 'LKR', locale: 'si-LK', symbol: 'Rs', label: 'LKR — Sri Lankan Rupee (Rs)' },
  { code: 'NPR', locale: 'ne-NP', symbol: 'Rs', label: 'NPR — Nepalese Rupee (Rs)' },
  { code: 'JPY', locale: 'ja-JP', symbol: '¥', label: 'JPY — Japanese Yen (¥)' },
  { code: 'CNY', locale: 'zh-CN', symbol: '¥', label: 'CNY — Chinese Yuan (¥)' },
  { code: 'KRW', locale: 'ko-KR', symbol: '₩', label: 'KRW — South Korean Won (₩)' },
  { code: 'TWD', locale: 'zh-TW', symbol: 'NT$', label: 'TWD — Taiwan Dollar (NT$)' },
  { code: 'THB', locale: 'th-TH', symbol: '฿', label: 'THB — Thai Baht (฿)' },
  { code: 'MYR', locale: 'ms-MY', symbol: 'RM', label: 'MYR — Malaysian Ringgit (RM)' },
  { code: 'IDR', locale: 'id-ID', symbol: 'Rp', label: 'IDR — Indonesian Rupiah (Rp)' },
  { code: 'PHP', locale: 'en-PH', symbol: '₱', label: 'PHP — Philippine Peso (₱)' },
  { code: 'VND', locale: 'vi-VN', symbol: '₫', label: 'VND — Vietnamese Dong (₫)' },
  { code: 'AED', locale: 'ar-AE', symbol: 'د.إ', label: 'AED — UAE Dirham (د.إ)' },
  { code: 'SAR', locale: 'ar-SA', symbol: '﷼', label: 'SAR — Saudi Riyal (﷼)' },
  { code: 'QAR', locale: 'ar-QA', symbol: '﷼', label: 'QAR — Qatari Riyal (﷼)' },
  { code: 'KWD', locale: 'ar-KW', symbol: 'د.ك', label: 'KWD — Kuwaiti Dinar (د.ك)' },
  { code: 'BHD', locale: 'ar-BH', symbol: '.د.ب', label: 'BHD — Bahraini Dinar (.د.ب)' },
  { code: 'OMR', locale: 'ar-OM', symbol: '﷼', label: 'OMR — Omani Rial (﷼)' },
  { code: 'JOD', locale: 'ar-JO', symbol: 'د.ا', label: 'JOD — Jordanian Dinar (د.ا)' },
  { code: 'EGP', locale: 'ar-EG', symbol: '£', label: 'EGP — Egyptian Pound (£)' },
  { code: 'TRY', locale: 'tr-TR', symbol: '₺', label: 'TRY — Turkish Lira (₺)' },
  { code: 'ILS', locale: 'he-IL', symbol: '₪', label: 'ILS — Israeli Shekel (₪)' },
  { code: 'ZAR', locale: 'en-ZA', symbol: 'R', label: 'ZAR — South African Rand (R)' },
  { code: 'NGN', locale: 'en-NG', symbol: '₦', label: 'NGN — Nigerian Naira (₦)' },
  { code: 'KES', locale: 'sw-KE', symbol: 'KSh', label: 'KES — Kenyan Shilling (KSh)' },
  { code: 'GHS', locale: 'ak-GH', symbol: '₵', label: 'GHS — Ghanaian Cedi (₵)' },
  { code: 'MXN', locale: 'es-MX', symbol: 'MX$', label: 'MXN — Mexican Peso (MX$)' },
  { code: 'BRL', locale: 'pt-BR', symbol: 'R$', label: 'BRL — Brazilian Real (R$)' },
  { code: 'ARS', locale: 'es-AR', symbol: '$', label: 'ARS — Argentine Peso ($)' },
  { code: 'CLP', locale: 'es-CL', symbol: '$', label: 'CLP — Chilean Peso ($)' },
  { code: 'COP', locale: 'es-CO', symbol: '$', label: 'COP — Colombian Peso ($)' },
  { code: 'PEN', locale: 'es-PE', symbol: 'S/', label: 'PEN — Peruvian Sol (S/)' },
  { code: 'UYU', locale: 'es-UY', symbol: '$U', label: 'UYU — Uruguayan Peso ($U)' },
  { code: 'RON', locale: 'ro-RO', symbol: 'lei', label: 'RON — Romanian Leu (lei)' },
  { code: 'PLN', locale: 'pl-PL', symbol: 'zł', label: 'PLN — Polish Złoty (zł)' },
  { code: 'CZK', locale: 'cs-CZ', symbol: 'Kč', label: 'CZK — Czech Koruna (Kč)' },
  { code: 'HUF', locale: 'hu-HU', symbol: 'Ft', label: 'HUF — Hungarian Forint (Ft)' },
  { code: 'BGN', locale: 'bg-BG', symbol: 'лв', label: 'BGN — Bulgarian Lev (лв)' },
  { code: 'HRK', locale: 'hr-HR', symbol: 'kn', label: 'HRK — Croatian Kuna (kn)' },
  { code: 'RSD', locale: 'sr-RS', symbol: 'din', label: 'RSD — Serbian Dinar (din)' },
  { code: 'UAH', locale: 'uk-UA', symbol: '₴', label: 'UAH — Ukrainian Hryvnia (₴)' },
  { code: 'RUB', locale: 'ru-RU', symbol: '₽', label: 'RUB — Russian Ruble (₽)' },
  { code: 'KZT', locale: 'kk-KZ', symbol: '₸', label: 'KZT — Kazakhstani Tenge (₸)' },
]

const CURRENCY_STORAGE_KEY = 'mbb_currency_code'

let _activeCurrency: CurrencyConfig =
  SUPPORTED_CURRENCIES.find(c => c.code === (localStorage.getItem(CURRENCY_STORAGE_KEY) ?? 'USD'))
  ?? SUPPORTED_CURRENCIES[0]!

const currency = (value: number) =>
  value.toLocaleString(_activeCurrency.locale, { style: 'currency', currency: _activeCurrency.code })

const getIncomeSubsectionStartingBalance = (subsection: IncomeSubsection) => {
  const midMonthSalary = subsection.midMonthSalaryArrived ? 0 : subsection.biMonthlySalary
  const monthEndSalary = subsection.monthEndSalaryArrived ? 0 : subsection.biMonthlySalary

  return subsection.checkingBalance + midMonthSalary + monthEndSalary
}

const getIncomeSubsectionTotalBalance = (subsection: IncomeSubsection) => (
  getIncomeSubsectionStartingBalance(subsection) - subsection.additionalPayments
)

const getDefaultBankStartingBalance = (
  checkingBalance: number,
  salary15thAmount: number,
  salary1stAmount: number,
) => checkingBalance + salary15thAmount + salary1stAmount

type BankBalanceComparisonPoint = {
  bankId: string
  bankName: string
  monthEndBalanceMinusDues: number
}

type BankBalanceHistoryChartRow = {
  cycleLabel: string
  cycleKey: string
  [bankId: string]: string | number
}

type BankComparisonSeriesEntry = {
  bankKey: string
  bankName: string
  values: number[]
  stroke?: string
  strokeDasharray?: string
}

type BudgetCycleTimelineSlot = {
  label: string
  toneClass: string
  date: Date
  hidden: boolean
}

const roundCurrencyAmount = (value: number) => Number(value.toFixed(2))

const buildBankBalanceComparisonPoints = (data: FinancialPlanData): BankBalanceComparisonPoint[] => {
  const normalizedData = normalizeFinancialPlanData(data)
  const normalizedSectionTitles = normalizeSectionTitles(normalizedData.sectionTitles)
  const normalizedIncomeSubsections = normalizedData.incomeSubsections ?? defaultIncomeSubsections
  const validPayFromBankIds = new Set([
    DEFAULT_BANK_EXPENSE_SOURCE_ID,
    ...normalizedIncomeSubsections.map((subsection) => subsection.id),
  ])
  const debitCardExpenseItems = [...normalizedData.planoExpenses, ...normalizedData.sanfordExpenses, ...normalizedData.otherExpenses].map((item) => ({
    ...item,
    payFromBankId: normalizeExpensePayFromBankId(item.payFromBankId, validPayFromBankIds),
  }))
  const debitCardExpensesByBankCurrent = debitCardExpenseItems.reduce<Map<string, number>>((totals, item) => {
    const currentTotal = totals.get(item.payFromBankId) ?? 0
    totals.set(item.payFromBankId, currentTotal + item.current)
    return totals
  }, new Map())
  const getCurrentDebitExpensesForBank = (bankId: string) => debitCardExpensesByBankCurrent.get(bankId) ?? 0
  const creditCardCurrentMonthPayments = normalizedData.creditAccounts.reduce((sum, account) => {
    const currentMonthPayment = account.paidThisMonth ? 0 : account.lastStatementBalance
    return sum + currentMonthPayment
  }, 0)
  const getCurrentDuesForBank = (bankId: string) => (
    bankId === DEFAULT_BANK_EXPENSE_SOURCE_ID
      ? creditCardCurrentMonthPayments + getCurrentDebitExpensesForBank(DEFAULT_BANK_EXPENSE_SOURCE_ID)
      : getCurrentDebitExpensesForBank(bankId)
  )
  const biMonthlySalary = normalizedData.incomeItems.find((item) => item.id === 'bi-monthly-salary')?.amount ?? 0
  const firstPaycheck = (normalizedData.incomeItems.find((item) => item.id === FIRST_PAYCHECK_ID)?.amount ?? 0) === 0 ? 0 : biMonthlySalary
  const secondPaycheck = (normalizedData.incomeItems.find((item) => item.id === SECOND_PAYCHECK_ID)?.amount ?? 0) === 0 ? 0 : biMonthlySalary
  const checkingAccountBalanceChase = normalizedData.balanceItems.find((item) => item.id === 'checking-balance-chase')?.amount ?? 0
  const additionalPaymentsChase = normalizedData.balanceItems.find((item) => item.id === 'additional-payments-chase')?.amount ?? 0
  const additionalIncomeChase = normalizedData.balanceItems.find((item) => item.id === 'additional-income-chase')?.amount ?? 0
  const defaultBankMonthEndBalanceMinusDues = firstPaycheck + secondPaycheck + checkingAccountBalanceChase - additionalPaymentsChase + additionalIncomeChase - getCurrentDuesForBank(DEFAULT_BANK_EXPENSE_SOURCE_ID)

  return [
    {
      bankId: DEFAULT_BANK_EXPENSE_SOURCE_ID,
      bankName: normalizedSectionTitles.defaultBank.trim() || 'Unnamed Bank',
      monthEndBalanceMinusDues: roundCurrencyAmount(defaultBankMonthEndBalanceMinusDues),
    },
    ...normalizedIncomeSubsections.map((subsection) => ({
      bankId: subsection.id,
      bankName: subsection.title.trim() || 'Unnamed Bank',
      monthEndBalanceMinusDues: roundCurrencyAmount(
        getIncomeSubsectionTotalBalance(subsection) + subsection.additionalIncome - getCurrentDuesForBank(subsection.id),
      ),
    })),
  ]
}

const formatLocalDateTime = (value: string | Date) => {
  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  }).format(date)
}

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

const formatTableHeaderLabel = (label: string) => {
  const trimmedLabel = label.trim()

  if (trimmedLabel === 'Stmt Cycled?') {
    return ['Stmt', 'Cycled?']
  }

  if (trimmedLabel === 'Current Month Payment') {
    return ['Current Month', 'Payment']
  }

  if (trimmedLabel.length <= 14 || !trimmedLabel.includes(' ')) {
    return [trimmedLabel]
  }

  const words = trimmedLabel.split(/\s+/)
  if (words.length < 2) {
    return [trimmedLabel]
  }

  let bestIndex = 1
  let bestScore = Number.POSITIVE_INFINITY

  for (let index = 1; index < words.length; index++) {
    const firstLine = words.slice(0, index).join(' ')
    const secondLine = words.slice(index).join(' ')
    const score = Math.abs(firstLine.length - secondLine.length)
    if (score < bestScore) {
      bestScore = score
      bestIndex = index
    }
  }

  return [
    words.slice(0, bestIndex).join(' '),
    words.slice(bestIndex).join(' '),
  ]
}

const formatCreditTableHeaderLabel = (label: string) => {
  const trimmedLabel = label.trim()

  if (!trimmedLabel.includes(' ')) {
    return [trimmedLabel, '']
  }

  const words = trimmedLabel.split(/\s+/)
  if (words.length === 2) {
    return words
  }

  const formattedLines = formatTableHeaderLabel(trimmedLabel)
  if (formattedLines.length >= 2) {
    return [formattedLines[0], formattedLines[1]]
  }

  return [trimmedLabel, '']
}

const formatDebitTableHeaderLabel = (label: string) => {
  const trimmedLabel = label.trim()

  if (!trimmedLabel.includes(' ')) {
    return [trimmedLabel, '']
  }

  const words = trimmedLabel.split(/\s+/)
  if (words.length === 2) {
    return words
  }

  const formattedLines = formatTableHeaderLabel(trimmedLabel)
  if (formattedLines.length >= 2) {
    return [formattedLines[0], formattedLines[1]]
  }

  return [trimmedLabel, '']
}

const normalizeLegacyCreditAccountColumnLabel = (id: string, label: string) => {
  if (id === 'pay-date' && label === 'Pay Date') {
    return 'Payment Date'
  }

  if (id === 'statement-date' && (label === 'Stmt Date' || label === 'Last Stmt Date' || label === 'Prev Cycle Stmt Date' || label === 'Current Payment Stmt Date' || label === 'Credit Card Statement Date')) {
    return 'Current Payment Stmt Date'
  }

  if (id === 'statement-cycled' && (label === 'Stmt Cycled' || label === 'Stmt Cycled?' || label === 'New Stmt Cycled?' || label === 'Current Cycle Stmt Cycled?')) {
    return 'Current Cycle Stmt Cycled?'
  }

  if (id === 'credit-limit' && label === 'Limit') {
    return 'Credit Limit'
  }

  return label
}

const getCreditColumnHeaderTooltip = (columnId: string) => {
  if (columnId === 'statement-date') {
    return 'Current payment stmt date is auto updated at close cycle. Change it after close cycle only if required.'
  }

  if (columnId === 'pay-date') {
    return 'Payment Date is updated at close cycle. Change it after close cycle only if required.'
  }

  if (columnId === 'paid') {
    return 'Current cycle payment made?'
  }

  if (columnId === 'statement-cycled') {
    return 'Current cycle stmt cycled?'
  }

  if (columnId === 'statement-balance') {
    return 'Latest stmt balance i.e. either previous or current if cycled'
  }

  return undefined
}

const getDebitColumnHeaderTooltip = (columnId: string) => {
  if (columnId === 'current-month') {
    return 'Update to $0 if payment made'
  }

  return undefined
}

const normalizeLegacyDebitExpenseColumnLabel = (id: string, label: string) => {
  if (id === 'current-month' && label === 'Current Month') {
    return 'Current Month Payment'
  }

  if (id === 'next-month' && label === 'Next Month') {
    return 'Next Month Payment'
  }

  return label
}

const normalizeColumnLabelsForUi = (columnLabels?: FinancialPlanColumnLabels): FinancialPlanColumnLabels => {
  const source = columnLabels ?? defaultColumnLabels
  const debitExpenseColumnsById = new Map((source.debitExpenses ?? []).map((column) => [column.id, column]))
  const normalizedDebitExpenses = defaultColumnLabels.debitExpenses.map((defaultColumn, index) => {
    const indexedColumn = source.debitExpenses?.[index]
    const actualColumn = debitExpenseColumnsById.get(defaultColumn.id)
      ?? (indexedColumn != null && (!indexedColumn.id || indexedColumn.id === defaultColumn.id) ? indexedColumn : null)
    return actualColumn == null
      ? defaultColumn
      : {
          ...defaultColumn,
          ...actualColumn,
          label: normalizeLegacyDebitExpenseColumnLabel(defaultColumn.id, actualColumn.label),
        }
  })

  return {
    creditAccounts: source.creditAccounts.map((column) => ({
      ...column,
      label: normalizeLegacyCreditAccountColumnLabel(column.id, column.label),
    })),
    debitExpenses: normalizedDebitExpenses,
  }
}

const normalizeExpensePayFromBankId = (payFromBankId: string | undefined, validPayFromBankIds: Set<string>) => {
  const normalizedValue = payFromBankId?.trim()

  if (!normalizedValue || !validPayFromBankIds.has(normalizedValue)) {
    return DEFAULT_BANK_EXPENSE_SOURCE_ID
  }

  return normalizedValue
}

const normalizeExpenseItemsForUi = (expenseItems: ExpenseItem[] | undefined, validPayFromBankIds: Set<string>): ExpenseItem[] =>
  (expenseItems ?? []).map((item) => ({
    ...item,
    payFromBankId: normalizeExpensePayFromBankId(item.payFromBankId, validPayFromBankIds),
  }))

const formatViewerUserLabel = (user: SharedViewerUserSummary) => {
  const primaryLabel = user.displayName?.trim() || user.email?.trim() || user.userSub

  if (user.displayName?.trim() && user.email?.trim()) {
    return `${user.displayName} (${user.email})`
  }

  return primaryLabel
}

const formatEncryptedViewerUserLabel = (user: SharedViewerUserSummary) =>
  user.encryptionExempt ? formatViewerUserLabel(user) : `🔒 ${formatViewerUserLabel(user)}`

const normalizePinValue = (value: string) => value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 4)

type CurrencyInputProps = {
  value: number
  onValueChange: (value: number) => void
  wrapClassName?: string
  inputClassName?: string
}

const CurrencyInput = ({ value, onValueChange, wrapClassName, inputClassName }: CurrencyInputProps) => (
  <div className={joinClassNames('currency-input-wrap', wrapClassName)}>
    <span className="currency-prefix">{_activeCurrency.symbol}</span>
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

const getHeaderInputWidth = (label: string, minChars = 0) => `${Math.max(label.length + 2, minChars)}ch`

const DEFAULT_BANK_EXPENSE_SOURCE_ID = 'default-bank'
const TOTAL_BANK_BALANCE_SERIES_KEY = '__total-bank-balance__'

const initialPlanoExpenses: ExpenseItem[] = [
  { id: 'plano-water', label: 'Water (Chase)', payDate: convertToISODate('24-Mar'), payFromBankId: DEFAULT_BANK_EXPENSE_SOURCE_ID, current: 0, next: 87.94 },
  { id: 'plano-internet-att', label: 'Internet ATT(Chase)', payDate: convertToISODate('19-Mar'), payFromBankId: DEFAULT_BANK_EXPENSE_SOURCE_ID, current: 0, next: 42.43 },
  { id: 'plano-hoa', label: 'HOA (Chase)', payDate: convertToISODate('11-Apr'), payFromBankId: DEFAULT_BANK_EXPENSE_SOURCE_ID, current: 355, next: 355 },
  { id: 'plano-electricity', label: 'Electricity (WellsFargo CC Tran)', payDate: convertToISODate('14-Apr'), payFromBankId: DEFAULT_BANK_EXPENSE_SOURCE_ID, current: 111, next: 111 },
]

const initialSanfordExpenses: ExpenseItem[] = [
  { id: 'sanford-water', label: 'Water (Chase)', payDate: convertToISODate('19-Mar'), payFromBankId: DEFAULT_BANK_EXPENSE_SOURCE_ID, current: 0, next: 90.48 },
  { id: 'sanford-electricity', label: 'Electricity (Chase)', payDate: convertToISODate('19-Mar'), payFromBankId: DEFAULT_BANK_EXPENSE_SOURCE_ID, current: 0, next: 188.82 },
  { id: 'sanford-internet-att', label: 'Internet ATT (Chase)', payDate: convertToISODate('24-Mar'), payFromBankId: DEFAULT_BANK_EXPENSE_SOURCE_ID, current: 0, next: 64.87 },
  { id: 'sanford-hoa-quarterly', label: 'HOA -($628.64/Qtr) (Chase)', payDate: convertToISODate('7-Apr'), payFromBankId: DEFAULT_BANK_EXPENSE_SOURCE_ID, current: 628.64, next: 0 },
]

const initialOtherExpenses: ExpenseItem[] = [
  { id: 'other-att-mobile', label: 'ATT - Mobile (Chase)', payDate: convertToISODate('4-Apr'), payFromBankId: DEFAULT_BANK_EXPENSE_SOURCE_ID, current: 65.35, next: 65.35 },
  { id: 'other-529-college-savings', label: '529 College Savings', payDate: convertToISODate('5-Apr'), payFromBankId: DEFAULT_BANK_EXPENSE_SOURCE_ID, current: 0, next: 0 },
  { id: 'other-geico-car-insurance', label: 'Geico Car Insurance (WellsFargo CC Tran)', payDate: convertToISODate('9-Apr'), payFromBankId: DEFAULT_BANK_EXPENSE_SOURCE_ID, current: 328.58, next: 328.58 },
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

type ExpenseSortKey = 'label' | 'payDate' | 'payFromBankId' | 'current' | 'next'

type SortState<T extends string> = {
  key: T
  direction: SortDirection
}

type CreditViewMode = 'table' | 'tab'
type ExpenseViewMode = 'table' | 'tab'
type BankViewMode = 'table' | 'tab'

type FinancialPlanViewModes = {
  creditAccounts: CreditViewMode
  debitExpenses: ExpenseViewMode
  bankAccounts: BankViewMode
}

type ExpenseRow = {
  item: ExpenseItem
  setter: React.Dispatch<React.SetStateAction<ExpenseItem[]>>
}

const DEFAULT_CREDIT_SORT: SortState<CreditSortKey> = {
  key: 'lastStatementDate',
  direction: 'asc',
}

const DEFAULT_EXPENSE_SORT: SortState<ExpenseSortKey> = {
  key: 'payDate',
  direction: 'asc',
}

const defaultViewModes: FinancialPlanViewModes = {
  creditAccounts: 'table',
  debitExpenses: 'table',
  bankAccounts: 'table',
}

const getCreditColumnSortKey = (columnId: string): CreditSortKey | null => {
  switch (columnId) {
    case 'account':
      return 'name'
    case 'available-credit':
      return 'availableCredit'
    case 'statement-date':
      return 'lastStatementDate'
    case 'pay-date':
      return 'nextPaymentDate'
    case 'paid':
      return 'paidThisMonth'
    case 'statement-cycled':
      return 'statementCycledAfterPayment'
    case 'statement-balance':
      return 'lastStatementBalance'
    case 'credit-limit':
      return 'creditLimit'
    case 'due':
      return 'totalDueForCard'
    case 'current-payment':
      return 'currentMonthPayment'
    case 'next-balance':
      return 'nextMonthStatementBalance'
    case 'utilization':
      return 'utilizationPercent'
    default:
      return null
  }
}
const getExpenseColumnSortKey = (columnId: string): ExpenseSortKey | null => {
  switch (columnId) {
    case 'expense':
      return 'label'
    case 'pay-date':
      return 'payDate'
    case 'pay-from':
      return 'payFromBankId'
    case 'current-month':
      return 'current'
    case 'next-month':
      return 'next'
    default:
      return null
  }
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

const getCreditSortValue = (account: CreditAccount, key: CreditSortKey) => {
  const metrics = getCreditMetrics(account)

  switch (key) {
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
}

const getExpenseSortValue = (item: ExpenseItem, key: ExpenseSortKey) => {
  switch (key) {
    case 'label':
      return item.label.toLowerCase()
    case 'payDate':
      return item.payDate
    case 'payFromBankId':
      return item.payFromBankId
    case 'current':
      return item.current
    case 'next':
      return item.next
  }
}

const buildOrderedIds = <T,>(items: T[], getId: (item: T) => string) => items.map(getId)

const reconcileOrderedIds = (currentOrder: string[], nextIds: string[]) => {
  const nextIdSet = new Set(nextIds)
  const preservedIds = currentOrder.filter((id) => nextIdSet.has(id))
  const preservedIdSet = new Set(preservedIds)
  const appendedIds = nextIds.filter((id) => !preservedIdSet.has(id))
  const mergedIds = [...preservedIds, ...appendedIds]

  if (mergedIds.length === currentOrder.length && mergedIds.every((id, index) => id === currentOrder[index])) {
    return currentOrder
  }

  return mergedIds
}

const applyOrderedIds = <T,>(items: T[], orderedIds: string[], getId: (item: T) => string) => {
  const itemsById = new Map(items.map((item) => [getId(item), item]))
  const orderedItems = orderedIds
    .map((id) => itemsById.get(id))
    .filter((item): item is T => item !== undefined)

  if (orderedItems.length === items.length) {
    return orderedItems
  }

  const orderedIdSet = new Set(orderedIds)
  const remainingItems = items.filter((item) => !orderedIdSet.has(getId(item)))
  return [...orderedItems, ...remainingItems]
}

const getCreditMetrics = (account: CreditAccount) => {
  const totalDueForCard = account.creditLimit - account.availableCredit
  const currentMonthPayment = account.paidThisMonth ? 0 : account.lastStatementBalance

  let nextMonthStatementBalance: number
  let displayedLastStatementBalance: number

  if (account.paidThisMonth) {
    if (account.nextPaymentDate < account.lastStatementDate) {
      // payment is before statement in this cycle
      nextMonthStatementBalance = account.statementCycledAfterPayment
        ? totalDueForCard - account.lastStatementBalance
        : totalDueForCard
      displayedLastStatementBalance = account.lastStatementBalance
    } else {
      // statement is before payment
      nextMonthStatementBalance = totalDueForCard
      displayedLastStatementBalance = account.lastStatementBalance
    }
  } else {
    nextMonthStatementBalance = totalDueForCard - account.lastStatementBalance
    displayedLastStatementBalance = account.lastStatementBalance
  }

  const utilizationPercent = account.creditLimit > 0 ? (totalDueForCard / account.creditLimit) * 100 : 0

  return {
    totalDueForCard,
    currentMonthPayment,
    nextMonthStatementBalance,
    displayedLastStatementBalance,
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

const normalizeViewMode = <T extends 'table' | 'tab'>(
  viewMode: string | undefined,
  fallback: T,
): T => (viewMode === 'tab' ? 'tab' : fallback)

const normalizeViewModes = (
  viewModes?: FinancialPlanData['viewModes'],
): FinancialPlanViewModes => ({
  creditAccounts: normalizeViewMode(viewModes?.creditAccounts, defaultViewModes.creditAccounts),
  debitExpenses: normalizeViewMode(viewModes?.debitExpenses, defaultViewModes.debitExpenses),
  bankAccounts: normalizeViewMode(viewModes?.bankAccounts, defaultViewModes.bankAccounts),
})

const normalizeFinancialPlanData = (data: FinancialPlanData): FinancialPlanData => {
  const normalizedSectionTitles = normalizeSectionTitles(data.sectionTitles)
  const normalizedViewModes = normalizeViewModes(data.viewModes)
  const normalizedIncomeSubsections = data.incomeSubsections ?? defaultIncomeSubsections
  const validPayFromBankIds = new Set([
    DEFAULT_BANK_EXPENSE_SOURCE_ID,
    ...normalizedIncomeSubsections.map((subsection) => subsection.id),
  ])

  return {
    creditAccounts: data.creditAccounts,
    incomeItems: data.incomeItems,
    balanceItems: data.balanceItems,
    planoExpenses: normalizeExpenseItemsForUi(data.planoExpenses, validPayFromBankIds),
    sanfordExpenses: normalizeExpenseItemsForUi(data.sanfordExpenses, validPayFromBankIds),
    otherExpenses: normalizeExpenseItemsForUi(data.otherExpenses, validPayFromBankIds),
    columnLabels: normalizeColumnLabelsForUi(data.columnLabels),
    sectionTitles: serializeSectionTitles(normalizedSectionTitles),
    viewModes: normalizedViewModes,
    incomeSubsections: normalizedIncomeSubsections,
    summary: data.summary,
  }
}

const getFinancialPlanSignature = (data: FinancialPlanData) =>
  JSON.stringify(normalizeFinancialPlanData({
    ...data,
    summary: undefined,
  }))

const chartCurrency = (value: number) =>
  new Intl.NumberFormat(_activeCurrency.locale, {
    style: 'currency',
    currency: _activeCurrency.code,
    notation: Math.abs(value) >= 1000 ? 'compact' : 'standard',
    maximumFractionDigits: 1,
  }).format(value)

const renderCompactBarValueLabel = (props: {
  x?: number
  y?: number
  width?: number
  height?: number
  value?: number | string
}) => {
  const width = props.width ?? 0
  const height = props.height ?? 0
  const numericValue = Number(props.value ?? 0)

  if (!Number.isFinite(numericValue) || numericValue <= 0 || width < 34 || height < 10) {
    return null
  }

  return (
    <text
      x={(props.x ?? 0) + width / 2}
      y={(props.y ?? 0) + height / 2 + 3}
      textAnchor="middle"
      fill="#ffffff"
      fontSize={9}
      fontWeight={700}
    >
      {chartCurrency(numericValue)}
    </text>
  )
}

const formatShortDate = (value: string) => {
  const [year, month, day] = value.split('-').map(Number)
  const safeDate = new Date(year, (month ?? 1) - 1, day ?? 1)
  return safeDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const formatLongDate = (value: Date) =>
  value.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

const formatCompactCycleDate = (value: Date) =>
  value.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

const formatCycleBoundaryDate = (value: string) =>
  new Date(`${value}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

const formatCompactCycleBoundaryDate = (value: string) =>
  new Date(`${value}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

const formatCycleRangeLabel = (cyclePeriod: CyclePeriod) =>
  `${formatCycleBoundaryDate(cyclePeriod.startDate)} - ${formatCycleBoundaryDate(cyclePeriod.endDate)}`

const formatTimelineTypeLabel = (timelineType: TimelineType) =>
  timelineType === 'START_TO_END' ? 'Start to End' : 'Mid to Mid'

const getAlternateTimelineType = (timelineType: TimelineType): TimelineType =>
  timelineType === 'START_TO_END' ? 'MID_TO_MID' : 'START_TO_END'

const buildCurrentCycleForTimeline = (today: Date, timelineType: TimelineType): CyclePeriod => {
  const currentDate = createLocalDate(today.getFullYear(), today.getMonth(), today.getDate())

  if (timelineType === 'START_TO_END') {
    const cycleStart = createLocalDate(currentDate.getFullYear(), currentDate.getMonth(), 1)
    const cycleEnd = createLocalDate(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)

    return {
      startDate: cycleStart.toISOString().slice(0, 10),
      endDate: cycleEnd.toISOString().slice(0, 10),
    }
  }

  const cycleStart =
    currentDate.getDate() >= 16
      ? createLocalDate(currentDate.getFullYear(), currentDate.getMonth(), 16)
      : createLocalDate(currentDate.getFullYear(), currentDate.getMonth() - 1, 16)
  const cycleEnd = createLocalDate(cycleStart.getFullYear(), cycleStart.getMonth() + 1, 15)

  return {
    startDate: cycleStart.toISOString().slice(0, 10),
    endDate: cycleEnd.toISOString().slice(0, 10),
  }
}

const buildPreviousCycleForTimeline = (today: Date, timelineType: TimelineType): CyclePeriod => {
  const currentCycle = buildCurrentCycleForTimeline(today, timelineType)
  const currentStart = new Date(`${currentCycle.startDate}T12:00:00`)
  const previousStart = createLocalDate(currentStart.getFullYear(), currentStart.getMonth() - 1, currentStart.getDate())
  const previousEnd = createLocalDate(currentStart.getFullYear(), currentStart.getMonth(), currentStart.getDate() - 1)

  return {
    startDate: previousStart.toISOString().slice(0, 10),
    endDate: previousEnd.toISOString().slice(0, 10),
  }
}

const createLocalDate = (year: number, monthIndex: number, day: number) => new Date(year, monthIndex, day, 12)

const getCyclePeriodKey = (cyclePeriod: CyclePeriod) => `${cyclePeriod.startDate}:${cyclePeriod.endDate}`

const normalizeBankBalanceHistoryCycle = (cycle: BankBalanceHistoryCycle): BankBalanceHistoryCycle => ({
  cycle: cycle.cycle,
  banks: (cycle.banks ?? []).map((bank) => ({
    bankId: bank.bankId,
    bankName: bank.bankName,
    monthEndBalanceMinusDues: bank.monthEndBalanceMinusDues,
  })),
  encryptedHistoryData: cycle.encryptedHistoryData,
  encryptionIv: cycle.encryptionIv,
})

const getBudgetCycleTimeline = (cyclePeriod: CyclePeriod, today: Date) => {
  const currentDate = createLocalDate(today.getFullYear(), today.getMonth(), today.getDate())
  const cycleStart = new Date(`${cyclePeriod.startDate}T12:00:00`)
  const cycleEnd = new Date(`${cyclePeriod.endDate}T12:00:00`)
  const millisecondsPerDay = 24 * 60 * 60 * 1000
  const totalDays = Math.max(1, Math.round((cycleEnd.getTime() - cycleStart.getTime()) / millisecondsPerDay) + 1)
  const isBeforeCycleStart = currentDate < cycleStart
  const isAfterCycleEnd = currentDate > cycleEnd
  const elapsedDays = Math.min(totalDays, Math.max(0, Math.round((currentDate.getTime() - cycleStart.getTime()) / millisecondsPerDay)))
  const remainingDays = Math.max(0, totalDays - elapsedDays)
  const progressPercent = Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100))
  const markerPercent = isBeforeCycleStart ? 0 : isAfterCycleEnd ? 100 : Math.min(96, Math.max(4, progressPercent))

  return {
    cycleStart,
    currentDate,
    cycleEnd,
    elapsedDays,
    remainingDays,
    totalDays,
    progressPercent,
    markerPercent,
  }
}

const isDateOutsideCyclePeriod = (dateValue: string, cyclePeriod: CyclePeriod) => {
  if (!dateValue) {
    return false
  }

  const targetDate = new Date(`${dateValue}T12:00:00`)
  const cycleStart = new Date(`${cyclePeriod.startDate}T12:00:00`)
  const cycleEnd = new Date(`${cyclePeriod.endDate}T12:00:00`)

  if (Number.isNaN(targetDate.getTime()) || Number.isNaN(cycleStart.getTime()) || Number.isNaN(cycleEnd.getTime())) {
    return false
  }

  return targetDate < cycleStart || targetDate > cycleEnd
}

const parseCycleBoundaryDate = (dateValue: string) => {
  const parsedDate = new Date(`${dateValue}T12:00:00`)
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate
}

const shouldHighlightPaymentDate = (account: CreditAccount, cyclePeriod: CyclePeriod) => {
  if (!isDateOutsideCyclePeriod(account.nextPaymentDate, cyclePeriod)) {
    return false
  }

  const paymentDate = parseCycleBoundaryDate(account.nextPaymentDate)
  const cycleEnd = parseCycleBoundaryDate(cyclePeriod.endDate)

  if (
    account.paidThisMonth
    && account.statementCycledAfterPayment
    && paymentDate !== null
    && cycleEnd !== null
    && paymentDate > cycleEnd
  ) {
    return false
  }

  return true
}

const shortenLabel = (value: string, maxLength = 18, trailingLength = 0) => {
  if (value.length <= maxLength) {
    return value
  }

  const ellipsis = '...'

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
  muted: '#64748b',
}

const BANK_COLORS = ['#2563eb', '#0f766e', '#7c3aed', '#b45309', '#0891b2', '#be185d']

const getSavingsNextMonthCardStyles = (amount: number, monthlyIncome: number) => {
  if (monthlyIncome <= 0) {
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

  const savingsRatio = amount / monthlyIncome

  if (savingsRatio <= 0.02) {
    const severity = Math.min(1, (0.02 - savingsRatio) / 0.08)
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

  if (savingsRatio < 0.1) {
    const calm = 1 - Math.min(1, (savingsRatio - 0.02) / 0.08)
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

  const strength = Math.min(1, (savingsRatio - 0.1) / 0.15)
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

const getExposureCardStyles = (exposureAmount: number, capacityAmount: number) => {
  if (capacityAmount <= 0) {
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

  const exposureRatio = exposureAmount / capacityAmount

  if (exposureRatio > 0.98) {
    const severity = Math.min(1, (exposureRatio - 0.98) / 0.22)
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

  if (exposureRatio > 0.9) {
    const concern = Math.min(1, (exposureRatio - 0.9) / 0.08)
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

  const comfort = Math.min(1, (0.9 - exposureRatio) / 0.9)
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

const emptyFinancialPlanData = normalizeFinancialPlanData({
  creditAccounts: [],
  incomeItems: [],
  balanceItems: [],
  planoExpenses: [],
  sanfordExpenses: [],
  otherExpenses: [],
  columnLabels: defaultColumnLabels,
  sectionTitles: defaultSectionTitles,
  incomeSubsections: defaultIncomeSubsections,
})

export default function App() {
  const [appRoute, setAppRoute] = useState<AppRoute>(() => normalizeAppRoute(window.location.pathname))
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
  const [creditSort, setCreditSort] = useState<SortState<CreditSortKey>>(DEFAULT_CREDIT_SORT)
  const [expenseSort, setExpenseSort] = useState<SortState<ExpenseSortKey>>(DEFAULT_EXPENSE_SORT)
  const [creditAccountOrder, setCreditAccountOrder] = useState<string[]>(() =>
    buildOrderedIds(sortItems(initialCreditAccounts, (account) => getCreditSortValue(account, DEFAULT_CREDIT_SORT.key), DEFAULT_CREDIT_SORT.direction), (account) => account.id),
  )
  const [expenseRowOrder, setExpenseRowOrder] = useState<string[]>(() => {
    const initialExpenseRows: ExpenseRow[] = [
      ...initialPlanoExpenses.map((item) => ({ item, setter: setPlanoExpenses })),
      ...initialSanfordExpenses.map((item) => ({ item, setter: setSanfordExpenses })),
      ...initialOtherExpenses.map((item) => ({ item, setter: setOtherExpenses })),
    ]

    return buildOrderedIds(
      sortItems(initialExpenseRows, ({ item }) => getExpenseSortValue(item, DEFAULT_EXPENSE_SORT.key), DEFAULT_EXPENSE_SORT.direction),
      ({ item }) => item.id,
    )
  })
  const [saveState, setSaveState] = useState<'idle' | 'loading' | 'saving' | 'saved' | 'error'>('loading')
  const [saveMessage, setSaveMessage] = useState('Loading saved plan...')
  const [loadedPlanSignature, setLoadedPlanSignature] = useState<string | null>(null)
  const [planViewMode, setPlanViewMode] = useState<PlanViewMode>('personal')
  const [sharedViewerUsers, setSharedViewerUsers] = useState<SharedViewerUserSummary[]>([])
  const [selectedSharedViewerUserSub, setSelectedSharedViewerUserSub] = useState('')
  const [personalPlanSnapshot, setPersonalPlanSnapshot] = useState<PersonalPlanSnapshot | null>(null)
  const [samplePlanSnapshot, setSamplePlanSnapshot] = useState<PersonalPlanSnapshot | null>(null)
  const [hasSavedPersonalPlan, setHasSavedPersonalPlan] = useState(false)
  const [authState, setAuthState] = useState<'checking' | 'authenticated' | 'unauthenticated' | 'error'>('checking')
  const [authenticatedUser, setAuthenticatedUser] = useState<AuthStatusResponse | null>(null)
  const [authMessage, setAuthMessage] = useState('Checking sign-in status...')
  const [termsAcceptedChecked, setTermsAcceptedChecked] = useState(false)
  const [termsSubmitting, setTermsSubmitting] = useState(false)
  const [termsError, setTermsError] = useState('')
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [showSamplePrompt, setShowSamplePrompt] = useState(false)
  const [isHelpDialogOpen, setIsHelpDialogOpen] = useState(false)
  const [isSampleConfirmDialogOpen, setIsSampleConfirmDialogOpen] = useState(false)
  const [isCycleSwitchDialogOpen, setIsCycleSwitchDialogOpen] = useState(false)
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isCloseCycleDialogOpen, setIsCloseCycleDialogOpen] = useState(false)
  const [isRevertCycleDialogOpen, setIsRevertCycleDialogOpen] = useState(false)
  const [pinKey, setPinKey] = useState<CryptoKey | null>(null)
  const [isPinModalOpen, setIsPinModalOpen] = useState(false)
  const [pinModalMode, setPinModalMode] = useState<'new' | 'verify' | 'migrate' | 'change' | 'reset-confirm'>('new')
  const [pinModalError, setPinModalError] = useState('')
  const [pinInput, setPinInput] = useState('')
  const [pinConfirmInput, setPinConfirmInput] = useState('')
  const [pinCurrentInput, setPinCurrentInput] = useState('')
  const [pinNewInput, setPinNewInput] = useState('')
  const [pinNewConfirmInput, setPinNewConfirmInput] = useState('')
  const [resetConfirmText, setResetConfirmText] = useState('')
  const [pinModalSubmitting, setPinModalSubmitting] = useState(false)
  const [pinModalExiting, setPinModalExiting] = useState(false)
  const [planReady, setPlanReady] = useState(false)
  const [adminDeleteConfirmUserSub, setAdminDeleteConfirmUserSub] = useState<string | null>(null)
  const [isDeletingViewerTracker, setIsDeletingViewerTracker] = useState(false)
  const [pinModalCurrency, setPinModalCurrency] = useState<string>(() => _activeCurrency.code)
  const [pinModalTimelineType, setPinModalTimelineType] = useState<TimelineType>('START_TO_END')
  const [currencyCode, setCurrencyCode] = useState<string>(() => _activeCurrency.code)
  const [pendingEncryptedPlanResponse, setPendingEncryptedPlanResponse] = useState<FinancialPlanCycleResponse | null>(null)
  const [storedPinVerify, setStoredPinVerify] = useState<string | null>(null)
  const [storedPinVerifyIv, setStoredPinVerifyIv] = useState<string | null>(null)
  const [deleteState, setDeleteState] = useState<'idle' | 'deleting' | 'error'>('idle')
  const [deleteMessage, setDeleteMessage] = useState('')
  const [selectedCycle, setSelectedCycle] = useState<CycleSelection>('current')
  const [timelineType, setTimelineType] = useState<TimelineType>('START_TO_END')
  const [lastCycleSavedAt, setLastCycleSavedAt] = useState<string | null>(null)
  const [pendingCycleSelection, setPendingCycleSelection] = useState<CycleSelection | null>(null)
  const [currentCyclePeriod, setCurrentCyclePeriod] = useState<CyclePeriod>(() => buildCurrentCycleForTimeline(new Date(), 'START_TO_END'))
  const [previousCyclePeriod, setPreviousCyclePeriod] = useState<CyclePeriod | null>(null)
  const [bankBalanceHistoryCycles, setBankBalanceHistoryCycles] = useState<BankBalanceHistoryCycle[]>([])
  const [pendingTimelineTypeSwitch, setPendingTimelineTypeSwitch] = useState<TimelineType | null>(null)
  const [isTimelineSwitchDialogOpen, setIsTimelineSwitchDialogOpen] = useState(false)
  const [pendingCloseCycleReset, setPendingCloseCycleReset] = useState<PendingCloseCycleReset | null>(null)
  const [suppressCycleSwitchWarning, setSuppressCycleSwitchWarning] = useState(false)
  const [hasCurrentCycleUserEdits, setHasCurrentCycleUserEdits] = useState(false)
  const [needsPostCloseBaselineSync, setNeedsPostCloseBaselineSync] = useState(false)
  const [closeCycleCarryoverBankData, setCloseCycleCarryoverBankData] = useState<Pick<FinancialPlanData, 'incomeItems' | 'balanceItems'> | null>(null)
  const [creditTableWidth, setCreditTableWidth] = useState<number | null>(null)
  const [creditViewMode, setCreditViewMode] = useState<CreditViewMode>(defaultViewModes.creditAccounts)
  const [expandedCreditAccountId, setExpandedCreditAccountId] = useState<string | null>(initialCreditAccounts[0]?.id ?? null)
  const [expenseViewMode, setExpenseViewMode] = useState<ExpenseViewMode>(defaultViewModes.debitExpenses)
  const [expandedExpenseRowId, setExpandedExpenseRowId] = useState<string | null>(null)
  const [bankViewMode, setBankViewMode] = useState<BankViewMode>(defaultViewModes.bankAccounts)
  const [expandedBankSectionId, setExpandedBankSectionId] = useState(DEFAULT_BANK_EXPENSE_SOURCE_ID)
  const userMenuRef = useRef<HTMLDivElement | null>(null)
  const creditTableWrapperRef = useRef<HTMLElement | null>(null)
  const dismissSamplePromptOnMenuCloseRef = useRef(false)
  const skipNextCarryoverResetRef = useRef(false)
  const bankBalanceHistoryRequestIdRef = useRef(0)
  const pinSetupInitiatedRef = useRef(false)

  const expensePayFromOptions = useMemo<BankPayFromOption[]>(() => [
    { id: DEFAULT_BANK_EXPENSE_SOURCE_ID, label: sectionTitles.defaultBank },
    ...incomeSubsections.map((subsection) => ({
      id: subsection.id,
      label: subsection.title.trim() || 'Unnamed Bank',
    })),
  ], [incomeSubsections, sectionTitles.defaultBank])

  const expensePayFromLabels = useMemo(
    () => new Map(expensePayFromOptions.map((option) => [option.id, option.label])),
    [expensePayFromOptions],
  )

  const validExpensePayFromBankIds = useMemo(
    () => new Set(expensePayFromOptions.map((option) => option.id)),
    [expensePayFromOptions],
  )

  const getExpensePayFromLabel = (payFromBankId: string) => expensePayFromLabels.get(payFromBankId) ?? sectionTitles.defaultBank

  const navigateToRoute = (nextRoute: AppRoute, options?: { replace?: boolean }) => {
    const normalizedRoute = normalizeAppRoute(nextRoute)
    const nextUrl = new URL(window.location.href)
    nextUrl.pathname = normalizedRoute

    if (options?.replace) {
      window.history.replaceState({}, '', `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`)
    } else if (normalizedRoute !== appRoute) {
      window.history.pushState({}, '', `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`)
    }

    setAppRoute(normalizedRoute)
  }

  const cycleSavedLabel = formatLocalDateTime(lastCycleSavedAt ?? new Date())
  const buildStampLabel = cycleSavedLabel.length > 0
    ? `${BUILD_VERSION_LABEL} | Last cycle saved ${cycleSavedLabel}`
    : BUILD_VERSION_LABEL

  useEffect(() => {
    let isMounted = true
    const loginStatus = new URLSearchParams(window.location.search).get('login')

    if (loginStatus) {
      const nextUrl = new URL(window.location.href)
      nextUrl.searchParams.delete('login')
      window.history.replaceState({}, '', `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`)
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
          setSharedViewerUsers([])
          setSelectedSharedViewerUserSub('')
          setTermsAcceptedChecked(false)
          setTermsError('')
          setAuthState('unauthenticated')
          setAuthMessage(loginStatus === 'error' ? 'Google sign-in failed. Try again.' : 'Sign in with Google to continue.')
          setSaveState('idle')
          setSaveMessage('')
          return
        }

        setAuthenticatedUser(authData)
        setTermsAcceptedChecked(false)
        setTermsError('')
        setPlanReady(false)
        setAuthState('authenticated')
        setAuthMessage('')
      } catch {
        if (!isMounted) {
          return
        }

        setAuthenticatedUser(null)
        setHasSavedPersonalPlan(false)
        setShowSamplePrompt(false)
        setSharedViewerUsers([])
        setSelectedSharedViewerUserSub('')
        setTermsAcceptedChecked(false)
        setTermsError('')
        setSelectedCycle('current')
        setTimelineType('START_TO_END')
        setCurrentCyclePeriod(buildCurrentCycleForTimeline(new Date(), 'START_TO_END'))
        setPreviousCyclePeriod(null)
        setPendingCloseCycleReset(null)
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
    const handlePopState = () => {
      setAppRoute(normalizeAppRoute(window.location.pathname))
    }

    window.addEventListener('popstate', handlePopState)

    return () => {
      window.removeEventListener('popstate', handlePopState)
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

    const measurementTarget = wrapper.parentElement ?? wrapper

    const updateCreditTableWidth = () => {
      const content = wrapper.querySelector<HTMLElement>('.section-content-fit')
      const tableWrapper = wrapper.querySelector<HTMLElement>('.compact-credit-table, .compact-credit-table-measurement')

      if (!tableWrapper) {
        return
      }

      const availableWidth = measurementTarget.getBoundingClientRect().width
      const chromeWidth = content
        ? Math.max(wrapper.getBoundingClientRect().width - content.getBoundingClientRect().width, 0)
        : 0
      const naturalContentWidth = tableWrapper?.scrollWidth ?? content?.scrollWidth ?? 0
      const nextWidth = Math.round(
        naturalContentWidth > 0
          ? Math.min(availableWidth, naturalContentWidth + chromeWidth)
          : availableWidth,
      )

      setCreditTableWidth((current) => (current === nextWidth ? current : nextWidth))
    }

    updateCreditTableWidth()

    const resizeObserver = new ResizeObserver(() => {
      updateCreditTableWidth()
    })

    resizeObserver.observe(measurementTarget)

    return () => {
      resizeObserver.disconnect()
    }
  }, [columnLabels.creditAccounts, creditAccounts, creditViewMode])

  useEffect(() => {
    if (!closeCycleCarryoverBankData) {
      return
    }

    if (skipNextCarryoverResetRef.current) {
      skipNextCarryoverResetRef.current = false
      return
    }

    setCloseCycleCarryoverBankData(null)
  }, [
    closeCycleCarryoverBankData,
    creditAccounts,
    incomeItemsState,
    balanceItemsState,
    planoExpenses,
    sanfordExpenses,
    otherExpenses,
    columnLabels,
    sectionTitles,
    incomeSubsections,
    selectedCycle,
  ])

  const updateAccountById = (accountId: string, field: string, value: number | string | boolean) => {
    if (isViewingPreviousCycle) {
      return
    }

    markCurrentCycleEdited()

    setCreditAccounts((current) =>
      current.map((account) => (account.id === accountId ? { ...account, [field]: value } : account)),
    )
  }

  const updateIncomeItem = (index: number, amount: number) => {
    if (isViewingPreviousCycle) {
      return
    }

    markCurrentCycleEdited()

    const updated = [...incomeItemsState]
    updated[index] = { ...updated[index], amount }
    setIncomeItemsState(updated)
  }

  const updateIncomeItemById = (id: string, amount: number) => {
    if (isViewingPreviousCycle) {
      return
    }

    markCurrentCycleEdited()

    setIncomeItemsState((current) =>
      current.map((item) => (item.id === id ? { ...item, amount } : item)),
    )
  }

  const updateIncomeLabel = (index: number, label: string) => {
    if (isViewingPreviousCycle) {
      return
    }

    markCurrentCycleEdited()

    const updated = [...incomeItemsState]
    updated[index] = { ...updated[index], label }
    setIncomeItemsState(updated)
  }

  const updateBalanceItem = (index: number, amount: number) => {
    if (isViewingPreviousCycle) {
      return
    }

    markCurrentCycleEdited()

    const updated = [...balanceItemsState]
    updated[index] = { ...updated[index], amount }
    setBalanceItemsState(updated)
  }

  const updateBalanceLabel = (index: number, label: string) => {
    if (isViewingPreviousCycle) {
      return
    }

    markCurrentCycleEdited()

    const updated = [...balanceItemsState]
    updated[index] = { ...updated[index], label }
    setBalanceItemsState(updated)
  }

  const updateExpenseItemById = (
    setter: React.Dispatch<React.SetStateAction<ExpenseItem[]>>,
    itemId: string,
    field: 'current' | 'next' | 'payDate' | 'payFromBankId',
    value: number | string,
  ) => {
    if (isViewingPreviousCycle) {
      return
    }

    markCurrentCycleEdited()

    setter((current) => current.map((item) => (item.id === itemId ? { ...item, [field]: value } : item)))
  }

  const updateExpenseLabelById = (
    setter: React.Dispatch<React.SetStateAction<ExpenseItem[]>>,
    itemId: string,
    label: string,
  ) => {
    if (isViewingPreviousCycle) {
      return
    }

    markCurrentCycleEdited()

    setter((current) => current.map((item) => (item.id === itemId ? { ...item, label } : item)))
  }

  const toggleCreditSort = (key: CreditSortKey) => {
    setCreditSort((current) => {
      const nextSort = {
        key,
        direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
      } satisfies SortState<CreditSortKey>

      setCreditAccountOrder(
        buildOrderedIds(
          sortItems(creditAccounts, (account) => getCreditSortValue(account, nextSort.key), nextSort.direction),
          (account) => account.id,
        ),
      )

      return nextSort
    })
  }

  const toggleExpenseSort = (key: ExpenseSortKey) => {
    setExpenseSort((current) => {
      const nextSort = {
        key,
        direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
      } satisfies SortState<ExpenseSortKey>

      const expenseRows: ExpenseRow[] = expenseGroups.flatMap((group) =>
        group.items.map((item) => ({
          item,
          setter: group.setter,
        })),
      )

      setExpenseRowOrder(
        buildOrderedIds(
          sortItems(
            expenseRows,
            ({ item }) => nextSort.key === 'payFromBankId'
              ? getExpensePayFromLabel(item.payFromBankId).toLowerCase()
              : getExpenseSortValue(item, nextSort.key),
            nextSort.direction,
          ),
          ({ item }) => item.id,
        ),
      )

      return nextSort
    })
  }

  const getSortIndicator = <T extends string,>(sortState: SortState<T>, key: T) => {
    if (sortState.key !== key) {
      return '↕'
    }

    return sortState.direction === 'asc' ? '↑' : '↓'
  }

  const updateColumnLabel = (tableKey: keyof FinancialPlanColumnLabels, index: number, label: string) => {
    if (isViewingPreviousCycle) {
      return
    }

    markCurrentCycleEdited()

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
    if (isViewingPreviousCycle) {
      return
    }

    markCurrentCycleEdited()

    setSectionTitles((current) => ({
      ...current,
      [sectionKey]: value,
    }))
  }

  const updateIncomeSubsectionTitle = (index: number, title: string) => {
    if (isViewingPreviousCycle) {
      return
    }

    markCurrentCycleEdited()

    setIncomeSubsections((current) => {
      const updated = [...current]
      updated[index] = { ...updated[index], title }
      return updated
    })
  }

  const updateIncomeSubsection = <K extends keyof IncomeSubsection>(index: number, field: K, value: IncomeSubsection[K]) => {
    if (isViewingPreviousCycle) {
      return
    }

    markCurrentCycleEdited()

    setIncomeSubsections((current) => {
      const updated = [...current]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  const addIncomeSubsection = () => {
    if (isViewingPreviousCycle) {
      return
    }

    markCurrentCycleEdited()

    const subsectionId = `income-subsection-${Date.now()}`
    const newBankCount = incomeSubsections.filter((subsection) => newBankSubsectionIds.has(subsection.id)).length
    const nextSubsections = [
      ...incomeSubsections,
      {
        id: subsectionId,
        title: getNewBankSubsectionTitle(newBankCount),
        biMonthlySalaryLabel: 'Bi-monthly salary',
        biMonthlySalary: 0,
        midMonthSalaryLabel: 'First Paycheck Arrived?',
        midMonthSalaryArrived: false,
        monthEndSalaryLabel: 'Second Paycheck Arrived?',
        monthEndSalaryArrived: false,
        checkingBalanceLabel: 'Account Balance',
        checkingBalance: 0,
        additionalPaymentsLabel: 'Additional Payments',
        additionalPayments: 0,
        totalBalanceLabel: 'Total Balance',
        additionalIncomeLabel: 'Additional Income',
        additionalIncome: 0,
        monthEndBalanceLabel: 'Month End Balance minus Dues',
      },
    ]

    setIncomeSubsections(nextSubsections)
    setNewBankSubsectionIds((current) => new Set(current).add(subsectionId))
  }

  const toggleBankSubsectionSelection = (subsectionId: string) => {
    if (isViewingPreviousCycle) {
      return
    }

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
    if (isViewingPreviousCycle) {
      return
    }

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
    if (isViewingPreviousCycle) {
      return
    }

    setSelectedCreditIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleExpenseSelection = (id: string) => {
    if (isViewingPreviousCycle) {
      return
    }

    setSelectedExpenseIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const deleteSelectedCredits = () => {
    if (isViewingPreviousCycle) {
      return
    }

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
    if (isViewingPreviousCycle) {
      return
    }

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
  const checkboxIncomeIds = new Set([FIRST_PAYCHECK_ID, SECOND_PAYCHECK_ID])

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
  const firstPaycheck = (incomeItemsState.find((item) => item.id === FIRST_PAYCHECK_ID)?.amount ?? 0) === 0 ? 0 : biMonthlySalary
  const secondPaycheck = (incomeItemsState.find((item) => item.id === SECOND_PAYCHECK_ID)?.amount ?? 0) === 0 ? 0 : biMonthlySalary
  const salaryTransferToChase = biMonthlySalary * 2
  const salaryTransfersToPNC = 2000 * 2
  const totalSalaryPerMonth = salaryTransferToChase

  const checkingAccountBalanceChase = balanceItemsState.find((item) => item.id === 'checking-balance-chase')?.amount ?? 0
  const additionalPaymentsChase = balanceItemsState.find((item) => item.id === 'additional-payments-chase')?.amount ?? 0
  const additionalIncomeChase = balanceItemsState.find((item) => item.id === 'additional-income-chase')?.amount ?? 0
  const chaseCDBalance = balanceItemsState.find((item) => item.id === 'chase-cd-balance')?.amount ?? 0
  const checkingAccountBalancePNC = balanceItemsState.find((item) => item.id === 'checking-balance-pnc')?.amount ?? 0
  const additionalOtherIncome = balanceItemsState.find((item) => item.id === 'additional-other-income')?.amount ?? 0

  const totalBalanceChase = firstPaycheck + secondPaycheck + checkingAccountBalanceChase - additionalPaymentsChase

  const creditCardCurrentMonthPayments = creditAccounts.reduce((sum, account) => {
    const currentMonthPayment = account.paidThisMonth ? 0 : account.lastStatementBalance
    return sum + currentMonthPayment
  }, 0)

  const creditCardNextMonthBalance = creditAccounts.reduce((sum, account) => {
    const totalDueForCard = account.creditLimit - account.availableCredit
    let nextMonthBalance: number
    if (account.paidThisMonth) {
      if (account.nextPaymentDate < account.lastStatementDate) {
        nextMonthBalance = account.statementCycledAfterPayment
          ? totalDueForCard - account.lastStatementBalance
          : totalDueForCard
      } else {
        nextMonthBalance = totalDueForCard
      }
    } else {
      nextMonthBalance = totalDueForCard - account.lastStatementBalance
    }
    return sum + nextMonthBalance
  }, 0)

  const debitCardExpenseItems = [...planoExpenses, ...sanfordExpenses, ...otherExpenses].map((item) => ({
    ...item,
    payFromBankId: normalizeExpensePayFromBankId(item.payFromBankId, validExpensePayFromBankIds),
  }))
  const debitCardExpensesTotalCurrent = sumExpenses(debitCardExpenseItems, 'current')
  const debitCardExpensesTotalNext = sumExpenses(debitCardExpenseItems, 'next')
  const otherBanksNextCycleSalaryTotal = incomeSubsections.reduce(
    (sum, subsection) => sum + subsection.biMonthlySalary * 2,
    0,
  )
  const totalNextCycleSalaryFunding = salaryTransferToChase + otherBanksNextCycleSalaryTotal
  const debitCardExpensesByBankCurrent = debitCardExpenseItems.reduce<Map<string, number>>((totals, item) => {
    const currentTotal = totals.get(item.payFromBankId) ?? 0
    totals.set(item.payFromBankId, currentTotal + item.current)
    return totals
  }, new Map())
  const getCurrentDebitExpensesForBank = (bankId: string) => debitCardExpensesByBankCurrent.get(bankId) ?? 0
  const defaultBankDebitExpensesCurrent = getCurrentDebitExpensesForBank(DEFAULT_BANK_EXPENSE_SOURCE_ID)
  const getCurrentDuesForBank = (bankId: string) => (
    bankId === DEFAULT_BANK_EXPENSE_SOURCE_ID
      ? creditCardCurrentMonthPayments + defaultBankDebitExpensesCurrent
      : getCurrentDebitExpensesForBank(bankId)
  )
  const getBankMonthEndBalance = (bankId: string, totalBalance: number, additionalIncome: number) => (
    totalBalance + additionalIncome - getCurrentDuesForBank(bankId)
  )
  const monthAfterNextMonthExpense = totalCardDue - creditCardCurrentMonthPayments - creditCardNextMonthBalance + debitCardExpensesTotalNext
  const j15 = creditCardCurrentMonthPayments
  const k15 = creditCardNextMonthBalance
  const j36 = j15 + debitCardExpensesTotalCurrent
  const k36 = k15 + debitCardExpensesTotalNext
  const currentCycleExposure = j36 + additionalPaymentsChase

  const checkingAccountBalanceMonthEndChase = getBankMonthEndBalance(
    DEFAULT_BANK_EXPENSE_SOURCE_ID,
    totalBalanceChase,
    additionalIncomeChase,
  )
  const netBalanceMonthEnd = checkingAccountBalanceMonthEndChase + chaseCDBalance + checkingAccountBalancePNC + additionalOtherIncome

  const totalMonthEndBalanceMinusDues = incomeSubsections.reduce((sum, subsection) => {
    const totalBalance = getIncomeSubsectionTotalBalance(subsection)
    return sum + getBankMonthEndBalance(subsection.id, totalBalance, subsection.additionalIncome)
  }, checkingAccountBalanceMonthEndChase)
  const currentCycleExposureCapacity = incomeSubsections.reduce((sum, subsection) => {
    if (subsection.biMonthlySalary <= 0) {
      return sum
    }

    const totalBalance = getIncomeSubsectionTotalBalance(subsection)
    return sum + totalBalance + subsection.additionalIncome
  }, biMonthlySalary > 0 ? totalBalanceChase + additionalIncomeChase : 0)
  const savingsNextMonth = totalNextCycleSalaryFunding - k36

  const adjustedIncomeItems = incomeItemsState.map((item) => {
    switch (item.id) {
      case FIRST_PAYCHECK_ID:
        return { ...item, amount: firstPaycheck }
      case SECOND_PAYCHECK_ID:
        return { ...item, amount: secondPaycheck }
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

  const bankSectionIncomeItems = selectedCycle === 'current' && closeCycleCarryoverBankData
    ? closeCycleCarryoverBankData.incomeItems
    : adjustedIncomeItems
  const bankSectionBalanceItems = selectedCycle === 'current' && closeCycleCarryoverBankData
    ? closeCycleCarryoverBankData.balanceItems
    : adjustedBalanceItems

  const overdueCreditAccounts = creditAccounts.filter(
    (account) => isPastDate(account.nextPaymentDate) && !account.paidThisMonth,
  )
  const overdueExpenses = debitCardExpenseItems.filter(
    (item) => isPastDate(item.payDate) && Math.abs(item.current) > 0.004,
  )

  const savingsNextMonthCardStyles = getSavingsNextMonthCardStyles(savingsNextMonth, totalNextCycleSalaryFunding)
  const overdueCardsStyles = getCountRiskCardStyles(overdueCreditAccounts.length, 4)
  const overdueExpensesStyles = getCountRiskCardStyles(overdueExpenses.length, 6)
  const currentMonthExposureStyles = getExposureCardStyles(currentCycleExposure, currentCycleExposureCapacity)
  const nextMonthExposureStyles = getExposureCardStyles(k36, totalNextCycleSalaryFunding)
  const monthAfterNextMonthStyles = getExposureCardStyles(monthAfterNextMonthExpense, totalNextCycleSalaryFunding)

  const overdueAlertData: AnalyticsKpiCard[] = [
    {
      label: 'Savings Next Cycle',
      value: currency(savingsNextMonth),
      detail: 'Projected leftover after next month expenses',
      ratio: Math.min(100, totalNextCycleSalaryFunding === 0 ? 0 : Math.max(0, (savingsNextMonth / totalNextCycleSalaryFunding) * 100)),
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
      label: 'Current Cycle Exposure',
      value: currency(currentCycleExposure),
      detail: 'Compared against Total Balance plus Additional Income of salary checking accounts',
      ratio: Math.min(100, currentCycleExposureCapacity <= 0 ? 0 : Math.max(0, (currentCycleExposure / currentCycleExposureCapacity) * 100)),
      ...currentMonthExposureStyles,
    },
    {
      label: 'Next Cycle Exposure',
      value: currency(k36),
      detail: 'Projected next statement pressure',
      ratio: Math.min(100, totalLimits === 0 ? 0 : (k36 / totalLimits) * 100),
      ...nextMonthExposureStyles,
    },
    {
      label: 'Cycle After Next Cycle Exposure',
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

  const totalDueByCardChartHeight = Math.max(200, creditTotalDueData.length * 28)

  const activeCyclePeriod = selectedCycle === 'previous' && previousCyclePeriod ? previousCyclePeriod : currentCyclePeriod
  const budgetCycleTimeline = useMemo(() => getBudgetCycleTimeline(activeCyclePeriod, new Date()), [activeCyclePeriod])
  const budgetCycleTitle = formatCycleRangeLabel(activeCyclePeriod)
  const budgetCycleProgressLabel =
    selectedCycle === 'previous'
      ? 'Archived cycle • read only'
      : budgetCycleTimeline.currentDate < budgetCycleTimeline.cycleStart
        ? `Upcoming cycle • starts ${formatLongDate(budgetCycleTimeline.cycleStart)}`
        : `${Math.round(budgetCycleTimeline.progressPercent)}% through cycle • ${budgetCycleTimeline.remainingDays} days left`
  const isUpcomingCycleView = budgetCycleTimeline.currentDate < budgetCycleTimeline.cycleStart
  const budgetCycleStartLabel = formatCompactCycleBoundaryDate(activeCyclePeriod.startDate)
  const budgetCycleTodayLabel = formatCompactCycleDate(budgetCycleTimeline.currentDate)
  const budgetCycleCloseLabel = formatCompactCycleBoundaryDate(activeCyclePeriod.endDate)

  const leftTimelineSlot: BudgetCycleTimelineSlot = (() => {
    if (budgetCycleTimeline.currentDate < budgetCycleTimeline.cycleStart) {
      return {
        label: budgetCycleTodayLabel,
        toneClass: 'budget-cycle-slot-today',
        date: budgetCycleTimeline.currentDate,
        hidden: false,
      }
    }

    return {
      label: budgetCycleStartLabel,
      toneClass: 'budget-cycle-slot-start',
      date: budgetCycleTimeline.cycleStart,
      hidden: false,
    }
  })()

  const middleTimelineSlot: BudgetCycleTimelineSlot = (() => {
    if (budgetCycleTimeline.currentDate < budgetCycleTimeline.cycleStart) {
      return {
        label: budgetCycleStartLabel,
        toneClass: 'budget-cycle-slot-start',
        date: budgetCycleTimeline.cycleStart,
        hidden: false,
      }
    }

    if (budgetCycleTimeline.currentDate > budgetCycleTimeline.cycleEnd) {
      return {
        label: budgetCycleCloseLabel,
        toneClass: 'budget-cycle-slot-close',
        date: budgetCycleTimeline.cycleEnd,
        hidden: false,
      }
    }

    return {
      label: budgetCycleTodayLabel,
      toneClass: 'budget-cycle-slot-today',
      date: budgetCycleTimeline.currentDate,
      hidden: false,
    }
  })()

  const rightTimelineSlot: BudgetCycleTimelineSlot = (() => {
    if (budgetCycleTimeline.currentDate > budgetCycleTimeline.cycleEnd) {
      return {
        label: budgetCycleTodayLabel,
        toneClass: 'budget-cycle-slot-today',
        date: budgetCycleTimeline.currentDate,
        hidden: false,
      }
    }

    return {
      label: budgetCycleCloseLabel,
      toneClass: 'budget-cycle-slot-close',
      date: budgetCycleTimeline.cycleEnd,
      hidden: false,
    }
  })()

  const middleTimelinePositionPercent = (() => {
    const spanDuration = rightTimelineSlot.date.getTime() - leftTimelineSlot.date.getTime()

    if (spanDuration <= 0) {
      return 50
    }

    const normalizedPosition = (middleTimelineSlot.date.getTime() - leftTimelineSlot.date.getTime()) / spanDuration
    const clampedPosition = Math.min(1, Math.max(0, normalizedPosition))
    return Number((clampedPosition * 100).toFixed(3))
  })()

  const middleTimelineInlineStyle = {
    left: `${middleTimelinePositionPercent}%`,
  }

  const savingsNextMonthPieData = savingsNextMonth >= 0
    ? [
        {
          name: 'Expenses Next Cycle',
          value: Number(Math.max(0, k36).toFixed(2)),
          color: CHART_COLORS.next,
        },
        {
          name: 'Savings Next Cycle',
          value: Number(Math.max(0, savingsNextMonth).toFixed(2)),
          color: CHART_COLORS.positive,
        },
      ].filter((entry) => entry.value > 0)
    : [
        {
          name: 'Chase Transfer',
          value: Number(Math.max(0, totalNextCycleSalaryFunding).toFixed(2)),
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

  const expenseCategoryCurrentShareData = expenseCategoryData
    .map((item, index) => ({
      name: item.name,
      value: item.current,
      color: expenseCategoryPalette[index % expenseCategoryPalette.length],
    }))
    .filter((item) => item.value > 0)

  const expenseCategoryNextShareData = expenseCategoryData
    .map((item, index) => ({
      name: item.name,
      value: item.next,
      color: expenseCategoryPalette[index % expenseCategoryPalette.length],
    }))
    .filter((item) => item.value > 0)

  const hasExpenseCategoryCurrentShareData = expenseCategoryCurrentShareData.length > 0
  const hasExpenseCategoryNextShareData = expenseCategoryNextShareData.length > 0

  const expensePayFromData = expensePayFromOptions
    .map((option) => {
      const matchingItems = debitCardExpenseItems.filter((item) => item.payFromBankId === option.id)
      const current = matchingItems.reduce((sum, item) => sum + item.current, 0)
      const next = matchingItems.reduce((sum, item) => sum + item.next, 0)

      return {
        name: option.label,
        current: Number(current.toFixed(2)),
        next: Number(next.toFixed(2)),
        total: Number((current + next).toFixed(2)),
      }
    })
    .filter((item) => item.total > 0)
    .sort((left, right) => right.total - left.total || left.name.localeCompare(right.name))

  const hasExpensePayFromData = expensePayFromData.length > 0
  const expensePayFromChartHeight = Math.max(84, expensePayFromData.length * 16)

  const liveBankComparisonData: FinancialPlanData = {
    creditAccounts,
    incomeItems: bankSectionIncomeItems,
    balanceItems: bankSectionBalanceItems,
    planoExpenses,
    sanfordExpenses,
    otherExpenses,
    columnLabels,
    sectionTitles,
    incomeSubsections,
  }
  const liveCurrentBankHistoryCycle = useMemo<BankBalanceHistoryCycle | null>(() => {
    if (appRoute === TRACKERS_ROUTE || selectedCycle !== 'current') {
      return null
    }

    return {
      cycle: currentCyclePeriod,
      banks: buildBankBalanceComparisonPoints(liveBankComparisonData),
    }
  }, [appRoute, currentCyclePeriod, liveBankComparisonData, selectedCycle])

  const bankBalanceChartCycles = useMemo(() => {
    if (planViewMode === 'sample') {
      return [{
        cycle: currentCyclePeriod,
        banks: buildBankBalanceComparisonPoints(liveBankComparisonData),
      }]
    }

    const cyclesByPeriod = new Map<string, BankBalanceHistoryCycle>()

    bankBalanceHistoryCycles.forEach((cycle) => {
      cyclesByPeriod.set(getCyclePeriodKey(cycle.cycle), cycle)
    })

    if (liveCurrentBankHistoryCycle) {
      cyclesByPeriod.set(getCyclePeriodKey(liveCurrentBankHistoryCycle.cycle), liveCurrentBankHistoryCycle)
    }

    return Array.from(cyclesByPeriod.values())
      .sort((left, right) => left.cycle.startDate.localeCompare(right.cycle.startDate))
  }, [bankBalanceHistoryCycles, currentCyclePeriod, liveBankComparisonData, liveCurrentBankHistoryCycle, planViewMode])

  const bankComparisonSeries: BankComparisonSeriesEntry[] = Array.from(
    new Set(bankBalanceChartCycles.flatMap((cycle) => cycle.banks.map((bank) => bank.bankId))),
  )
    .map((bankId) => {
      const mostRecentBank = [...bankBalanceChartCycles]
        .reverse()
        .flatMap((cycle) => cycle.banks)
        .find((bank) => bank.bankId === bankId)
      const values = bankBalanceChartCycles.map((cycle) => {
        const matchingBank = cycle.banks.find((bank) => bank.bankId === bankId)
        return matchingBank?.monthEndBalanceMinusDues ?? 0
      })

      return {
        bankKey: bankId,
        bankName: mostRecentBank?.bankName ?? 'Unnamed Bank',
        values,
      }
    })
    .filter((bank) => bank.values.some((value) => Math.abs(value) > 0.004))

  const totalBankBalanceSeries: BankComparisonSeriesEntry | null = bankBalanceChartCycles.length === 0
    ? null
    : (() => {
        const values = bankBalanceChartCycles.map((cycle) => cycle.banks.reduce(
          (sum, bank) => sum + bank.monthEndBalanceMinusDues,
          0,
        ))

        return values.some((value) => Math.abs(value) > 0.004)
          ? {
              bankKey: TOTAL_BANK_BALANCE_SERIES_KEY,
              bankName: 'Total',
              values,
              stroke: '#0f172a',
              strokeDasharray: '8 4',
            }
          : null
      })()

  const bankComparisonSeriesWithTotal = totalBankBalanceSeries == null
    ? bankComparisonSeries
    : [...bankComparisonSeries, totalBankBalanceSeries]

  const bankBalanceComparisonChartData: BankBalanceHistoryChartRow[] = bankBalanceChartCycles.map((cycle) => ({
    cycleLabel: formatCompactCycleBoundaryDate(cycle.cycle.endDate),
    cycleKey: getCyclePeriodKey(cycle.cycle),
    ...Object.fromEntries(
      bankComparisonSeriesWithTotal.map((bank) => {
        if (bank.bankKey === TOTAL_BANK_BALANCE_SERIES_KEY) {
          return [bank.bankKey, cycle.banks.reduce((sum, point) => sum + point.monthEndBalanceMinusDues, 0)]
        }

        const matchingBank = cycle.banks.find((point) => point.bankId === bank.bankKey)
        return [bank.bankKey, matchingBank?.monthEndBalanceMinusDues ?? 0]
      }),
    ),
  }))

  const displayedIncomeItems = bankSectionIncomeItems.filter(
    (item) => item.id !== 'salary-transfer-pnc-home-loans' && item.id !== 'salary-transfer-chase-month',
  )
  const chaseIncomeOrder = [
    'bi-monthly-salary',
    FIRST_PAYCHECK_ID,
    SECOND_PAYCHECK_ID,
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
  const chaseBalanceItems = bankSectionBalanceItems.filter((item) => chaseBalanceIds.has(item.id))
  const otherIncomeItems = displayedIncomeItems.filter(
    (item) => !chaseIncomeOrder.includes(item.id) && item.id !== 'total-salary-per-month',
  )

  const renderIncomeCard = (item: IncomeItem) => {
    const itemIndex = incomeItemsState.findIndex((entry) => entry.id === item.id)
    const isCheckboxIncome = checkboxIncomeIds.has(item.id)

    return (
      <article key={item.id} className="info-card">
        <p className="card-title card-title-static">{item.label}</p>
        {isCheckboxIncome ? (
          <input
            type="checkbox"
            checked={biMonthlySalary > 0 && item.amount === 0}
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
        <p className="card-title card-title-static">{item.label}</p>
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
    const totalBalance = getIncomeSubsectionTotalBalance(subsection)
    const monthEndBalance = getBankMonthEndBalance(subsection.id, totalBalance, subsection.additionalIncome)

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
            <p className="card-title card-title-static">{subsection.biMonthlySalaryLabel}</p>
            <CurrencyInput
              value={subsection.biMonthlySalary}
              onValueChange={(value) => updateIncomeSubsection(index, 'biMonthlySalary', value)}
              inputClassName="amount-input currency-amount-input"
            />
          </article>
          <article className="info-card">
            <p className="card-title card-title-static">{subsection.midMonthSalaryLabel}</p>
            <input
              type="checkbox"
              checked={subsection.midMonthSalaryArrived}
              onChange={(e) => updateIncomeSubsection(index, 'midMonthSalaryArrived', e.target.checked)}
              className="salary-toggle-checkbox"
            />
          </article>
          <article className="info-card">
            <p className="card-title card-title-static">{subsection.monthEndSalaryLabel}</p>
            <input
              type="checkbox"
              checked={subsection.monthEndSalaryArrived}
              onChange={(e) => updateIncomeSubsection(index, 'monthEndSalaryArrived', e.target.checked)}
              className="salary-toggle-checkbox"
            />
          </article>
          <article className="info-card">
            <p className="card-title card-title-static">{subsection.checkingBalanceLabel}</p>
            <CurrencyInput
              value={subsection.checkingBalance}
              onValueChange={(value) => updateIncomeSubsection(index, 'checkingBalance', value)}
              inputClassName="amount-input currency-amount-input"
            />
          </article>
          <article className="info-card">
            <p className="card-title card-title-static">{subsection.additionalPaymentsLabel}</p>
            <CurrencyInput
              value={subsection.additionalPayments}
              onValueChange={(value) => updateIncomeSubsection(index, 'additionalPayments', value)}
              inputClassName="amount-input currency-amount-input"
            />
          </article>
          <article className="info-card">
            <p className="card-title card-title-static">{subsection.totalBalanceLabel}</p>
            <p className="card-value">{currency(totalBalance)}</p>
          </article>
          <article className="info-card">
            <p className="card-title card-title-static">{subsection.additionalIncomeLabel}</p>
            <CurrencyInput
              value={subsection.additionalIncome}
              onValueChange={(value) => updateIncomeSubsection(index, 'additionalIncome', value)}
              inputClassName="amount-input currency-amount-input"
            />
          </article>
          <article className="info-card">
            <p className="card-title card-title-static">{subsection.monthEndBalanceLabel}</p>
            <p className="card-value">{currency(monthEndBalance)}</p>
          </article>
        </div>
      </div>
    )
  }

  const renderDefaultBankSubsection = () => (
    <div className="subsection-block chase-subsection">
      <h3>
        <input
          type="text"
          value={sectionTitles.defaultBank}
          onChange={(e) => updateSectionTitle('defaultBank', e.target.value)}
          className="label-input subsection-title-input"
          title="Default Bank Account"
        />
      </h3>
      <div className="card-list">
        {chaseIncomeItems.map(renderIncomeCard)}
        {chaseBalanceItems.map(renderBalanceCard)}
      </div>
    </div>
  )

  const addCreditAccount = () => {
    if (isViewingPreviousCycle) {
      return
    }

    markCurrentCycleEdited()

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
    if (isViewingPreviousCycle) {
      return
    }

    markCurrentCycleEdited()

    const today = new Date().toISOString().split('T')[0]
    const newItem: ExpenseItem = {
      id: `${prefix}-${Date.now()}`,
      label: 'New Expense',
      payDate: today,
      payFromBankId: DEFAULT_BANK_EXPENSE_SOURCE_ID,
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

  const displayedCreditAccounts = applyOrderedIds(creditAccounts, creditAccountOrder, (account) => account.id)
  const activeDisplayedCreditAccount = displayedCreditAccounts.find((account) => account.id === expandedCreditAccountId) ?? displayedCreditAccounts[0] ?? null

  const expenseRows: ExpenseRow[] = expenseGroups.flatMap((group) =>
    group.items.map((item) => ({
      item,
      setter: group.setter,
    })),
  )

  const displayedExpenseRows = applyOrderedIds(expenseRows, expenseRowOrder, ({ item }) => item.id)
  const activeDisplayedExpenseRow = displayedExpenseRows.find(({ item }) => item.id === expandedExpenseRowId) ?? displayedExpenseRows[0] ?? null
  const displayedBankSectionIds = useMemo(
    () => [DEFAULT_BANK_EXPENSE_SOURCE_ID, ...incomeSubsections.map((subsection) => subsection.id)],
    [incomeSubsections],
  )
  const activeDisplayedBankSubsection = incomeSubsections.find((subsection) => subsection.id === expandedBankSectionId) ?? null

  useEffect(() => {
    const nextCreditIds = buildOrderedIds(creditAccounts, (account) => account.id)
    setCreditAccountOrder((current) => reconcileOrderedIds(current, nextCreditIds))
  }, [creditAccounts])

  useEffect(() => {
    const nextExpenseIds = buildOrderedIds(expenseRows, ({ item }) => item.id)
    setExpenseRowOrder((current) => reconcileOrderedIds(current, nextExpenseIds))
  }, [expenseRows])

  useEffect(() => {
    if (displayedCreditAccounts.length === 0) {
      setExpandedCreditAccountId(null)
      return
    }

    if (!expandedCreditAccountId || !displayedCreditAccounts.some((account) => account.id === expandedCreditAccountId)) {
      setExpandedCreditAccountId(displayedCreditAccounts[0].id)
    }
  }, [displayedCreditAccounts, expandedCreditAccountId])

  useEffect(() => {
    if (displayedExpenseRows.length === 0) {
      setExpandedExpenseRowId(null)
      return
    }

    if (!expandedExpenseRowId || !displayedExpenseRows.some(({ item }) => item.id === expandedExpenseRowId)) {
      setExpandedExpenseRowId(displayedExpenseRows[0].item.id)
    }
  }, [displayedExpenseRows, expandedExpenseRowId])

  useEffect(() => {
    if (!displayedBankSectionIds.includes(expandedBankSectionId)) {
      setExpandedBankSectionId(displayedBankSectionIds[0] ?? DEFAULT_BANK_EXPENSE_SOURCE_ID)
    }
  }, [displayedBankSectionIds, expandedBankSectionId])

  const buildPayload = (overrides: Partial<FinancialPlanData> = {}): FinancialPlanData => {
    const nextIncomeItems = overrides.incomeItems ?? bankSectionIncomeItems
    const nextIncomeSubsections = overrides.incomeSubsections ?? incomeSubsections
    const nextValidPayFromBankIds = new Set([
      DEFAULT_BANK_EXPENSE_SOURCE_ID,
      ...nextIncomeSubsections.map((subsection) => subsection.id),
    ])

    return {
      creditAccounts: overrides.creditAccounts ?? creditAccounts,
      incomeItems: nextIncomeItems,
      balanceItems: overrides.balanceItems ?? bankSectionBalanceItems,
      planoExpenses: normalizeExpenseItemsForUi(overrides.planoExpenses ?? planoExpenses, nextValidPayFromBankIds),
      sanfordExpenses: normalizeExpenseItemsForUi(overrides.sanfordExpenses ?? sanfordExpenses, nextValidPayFromBankIds),
      otherExpenses: normalizeExpenseItemsForUi(overrides.otherExpenses ?? otherExpenses, nextValidPayFromBankIds),
      columnLabels: overrides.columnLabels ?? columnLabels,
      sectionTitles: serializeSectionTitles(normalizeSectionTitles(overrides.sectionTitles ?? sectionTitles)),
      viewModes: normalizeViewModes(overrides.viewModes ?? {
        creditAccounts: creditViewMode,
        debitExpenses: expenseViewMode,
        bankAccounts: bankViewMode,
      }),
      incomeSubsections: nextIncomeSubsections,
      summary: overrides.summary,
    }
  }

  const canCloseCurrentCycle =
    creditAccounts.length > 0 &&
    creditAccounts.every((account) => account.paidThisMonth && account.statementCycledAfterPayment) &&
    debitCardExpenseItems.every((item) => Math.abs(item.current) < 0.004)

  const closeCycleRequirements = [
    {
      label: 'All credit cards are marked paid',
      met: creditAccounts.length > 0 && creditAccounts.every((account) => account.paidThisMonth),
    },
    {
      label: 'All statements are marked statement cycled',
      met: creditAccounts.length > 0 && creditAccounts.every((account) => account.statementCycledAfterPayment),
    },
    {
      label: 'All current-month debit expenses are 0',
      met: debitCardExpenseItems.every((item) => Math.abs(item.current) < 0.004),
    },
  ]

  const budgetCycleButtonTooltip =
    selectedCycle === 'previous'
      ? 'Previous cycle is read only.'
      : canCloseCurrentCycle
        ? 'Close Cycle\n- Archives the current cycle as previous\n- Replaces any existing previous cycle\n- Applies the new-cycle rollover rules to the next current cycle'
        : 'Close Cycle is disabled until:\n- All credit cards are marked paid\n- All statements are marked statement cycled\n- All debit card current month expenses are 0\n\nWhen enabled, it will:\n- Archive the current cycle as previous\n- Replace any existing previous cycle\n- Apply the new-cycle rollover rules to the next current cycle'

  const currentPlanSignature = useMemo(
    () => getFinancialPlanSignature(buildPayload()),
    [
      bankSectionBalanceItems,
      bankSectionIncomeItems,
      adjustedBalanceItems,
      adjustedIncomeItems,
      columnLabels,
      closeCycleCarryoverBankData,
      creditAccounts,
      incomeSubsections,
      otherExpenses,
      planoExpenses,
      sanfordExpenses,
      selectedCycle,
      sectionTitles,
    ],
  )

  useEffect(() => {
    if (!needsPostCloseBaselineSync) {
      return
    }

    const syncedData = buildPayload()
    setLoadedPlanSignature(currentPlanSignature)
    setPersonalPlanSnapshot((current) => current == null
      ? current
      : {
          ...current,
          data: syncedData,
          loadedSignature: currentPlanSignature,
        })
    setNeedsPostCloseBaselineSync(false)
  }, [currentPlanSignature, needsPostCloseBaselineSync])

  useEffect(() => {
    if (
      planViewMode !== 'personal' ||
      selectedCycle !== 'current' ||
      !hasCurrentCycleUserEdits ||
      loadedPlanSignature === null ||
      currentPlanSignature !== loadedPlanSignature
    ) {
      return
    }

    setHasCurrentCycleUserEdits(false)
  }, [currentPlanSignature, hasCurrentCycleUserEdits, loadedPlanSignature, planViewMode, selectedCycle])

  const isSampleMode = planViewMode === 'sample'
  const isTrackersRoute = appRoute === TRACKERS_ROUTE
  const canAccessTrackersRoute = authenticatedUser?.admin === true
  const canEditSamplePlan = authenticatedUser?.admin === true
  const isViewingPreviousCycle = selectedCycle === 'previous'
  const isTrackerReadOnly = isViewingPreviousCycle || isTrackersRoute
  const isSampleReadOnly = isSampleMode && !canEditSamplePlan
  const isPlanReadOnly = isTrackerReadOnly || isSampleReadOnly
  const hasSharedViewerUsers = sharedViewerUsers.length > 0
  const selectedSharedViewerUser = sharedViewerUsers.find((user) => user.userSub === selectedSharedViewerUserSub) ?? null
  const sampleHasLocalChanges = isSampleMode && loadedPlanSignature !== null && currentPlanSignature !== loadedPlanSignature

  const hasUnsavedChanges =
    !isTrackersRoute &&
    selectedCycle === 'current' &&
    (!isSampleMode || canEditSamplePlan) &&
    hasCurrentCycleUserEdits &&
    loadedPlanSignature !== null &&
    currentPlanSignature !== loadedPlanSignature
  const canUseReset = hasUnsavedChanges
  const canRevertClosedCycle = !isTrackersRoute && previousCyclePeriod !== null

  const statusText =
    isTrackersRoute
      ? selectedSharedViewerUser
        ? `Viewing ${formatViewerUserLabel(selectedSharedViewerUser)}`
        : hasSharedViewerUsers
          ? 'Viewing selected tracker'
          : 'No other trackers available'
      : isSampleMode
      ? sampleHasLocalChanges
        ? canEditSamplePlan
          ? 'Unsaved sample changes'
          : 'Sample changes are local only'
        : canEditSamplePlan
          ? 'Editing sample plan'
          : 'Viewing sample plan'
      : isViewingPreviousCycle && saveState === 'idle'
        ? 'Viewing previous cycle'
      : saveState === 'loading' || saveState === 'saving'
      ? saveMessage
      : hasUnsavedChanges
        ? 'Unsaved changes'
        : saveState === 'error' || saveState === 'saved'
          ? saveMessage
          : ''

  const shouldWarnBeforeSwitchingCycle =
    !isTrackersRoute && selectedCycle === 'current' && hasUnsavedChanges && !suppressCycleSwitchWarning && !needsPostCloseBaselineSync

  const statusClassName = `status-text status-${isSampleMode ? 'saved' : hasUnsavedChanges && saveState === 'idle' ? 'saved' : saveState}`
  const creditWidthCapStyle = creditTableWidth
    ? { width: `min(100%, ${creditTableWidth}px)`, marginLeft: 'auto', marginRight: 'auto' }
    : undefined
  const creditWidthMaxStyle = creditTableWidth ? { maxWidth: `${creditTableWidth}px` } : undefined
  const creditSectionStyle = creditViewMode === 'tab'
    ? creditWidthCapStyle
    : { marginLeft: 'auto', marginRight: 'auto' }
  const renderCreditAccountsTable = (tableWrapperClassName: string) => (
    <div className={tableWrapperClassName} aria-hidden={tableWrapperClassName.includes('measurement') ? 'true' : undefined}>
      <table className="credit-accounts-table">
        <thead>
          <tr>
            <th className="select-col"></th>
            {columnLabels.creditAccounts.map((column) => {
              const sortKey = getCreditColumnSortKey(column.id)

              return (
                <th key={column.id}>
                  <div className="sortable-header">
                    <span
                      className="table-header-label"
                      aria-label={column.label}
                      title={getCreditColumnHeaderTooltip(column.id)}
                    >
                      {formatCreditTableHeaderLabel(column.label).map((line, lineIndex) => (
                        <span key={`${column.id}-line-${lineIndex}`} className="table-header-label-line">
                          {line}
                        </span>
                      ))}
                    </span>
                    {sortKey != null ? (
                      <button
                        type="button"
                        className="sort-button"
                        onClick={() => toggleCreditSort(sortKey)}
                        aria-label={`Sort credit accounts by ${column.label}`}
                      >
                        {getSortIndicator(creditSort, sortKey)}
                      </button>
                    ) : null}
                  </div>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {displayedCreditAccounts.map((account) => {
            const { totalDueForCard, currentMonthPayment, nextMonthStatementBalance, displayedLastStatementBalance, utilizationPercent } = getCreditMetrics(account)
            const isPastDueUnpaid = isPastDate(account.nextPaymentDate) && !account.paidThisMonth
            const isNextPaymentOutsideCycle = shouldHighlightPaymentDate(account, activeCyclePeriod)

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
                    value={account.lastStatementDate}
                    onChange={(e) => updateAccountById(account.id, 'lastStatementDate', e.target.value)}
                  />
                </td>
                <td>
                  <input
                    type="date"
                    value={account.nextPaymentDate}
                    onChange={(e) => updateAccountById(account.id, 'nextPaymentDate', e.target.value)}
                    className={joinClassNames(isNextPaymentOutsideCycle ? 'cycle-outside-date' : undefined)}
                    title={isNextPaymentOutsideCycle ? 'Date outside of cycle' : undefined}
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
                  <CurrencyInput
                    value={displayedLastStatementBalance}
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
  )
  const renderCreditTotalDueYAxisTick = ({ x, y, payload }: { x?: number; y?: number; payload?: { value: string } }) => (
      <text
        x={(x ?? 0) - 1}
        y={y ?? 0}
        dy={4}
        textAnchor="end"
        fill={CHART_COLORS.text}
        fontSize={11}
      >
        <title>{payload?.value ?? ''}</title>
        {shortenLabel(payload?.value ?? '', 23, 11)}
      </text>
    )

  const applyFinancialPlan = (data: FinancialPlanData) => {
    const normalizedData = normalizeFinancialPlanData(data)
    const normalizedViewModes = normalizeViewModes(normalizedData.viewModes)
    const nextCreditAccounts = sortItems(
      normalizedData.creditAccounts,
      (account) => getCreditSortValue(account, DEFAULT_CREDIT_SORT.key),
      DEFAULT_CREDIT_SORT.direction,
    )
    const nextExpenseRows: ExpenseRow[] = [
      ...normalizedData.planoExpenses.map((item) => ({ item, setter: setPlanoExpenses })),
      ...normalizedData.sanfordExpenses.map((item) => ({ item, setter: setSanfordExpenses })),
      ...normalizedData.otherExpenses.map((item) => ({ item, setter: setOtherExpenses })),
    ]
    const nextExpenseRowOrder = buildOrderedIds(
      sortItems(nextExpenseRows, ({ item }) => getExpenseSortValue(item, DEFAULT_EXPENSE_SORT.key), DEFAULT_EXPENSE_SORT.direction),
      ({ item }) => item.id,
    )

    setCreditSort(DEFAULT_CREDIT_SORT)
    setExpenseSort(DEFAULT_EXPENSE_SORT)
    setCreditAccountOrder(buildOrderedIds(nextCreditAccounts, (account) => account.id))
    setExpenseRowOrder(nextExpenseRowOrder)
    setCreditAccounts(nextCreditAccounts)
    setIncomeItemsState(normalizedData.incomeItems)
    setBalanceItemsState(normalizedData.balanceItems)
    setPlanoExpenses(normalizedData.planoExpenses)
    setSanfordExpenses(normalizedData.sanfordExpenses)
    setOtherExpenses(normalizedData.otherExpenses)
    setSectionTitles(normalizeSectionTitles(normalizedData.sectionTitles))
    setColumnLabels(normalizedData.columnLabels ?? defaultColumnLabels)
    setCreditViewMode(normalizedViewModes.creditAccounts)
    setExpenseViewMode(normalizedViewModes.debitExpenses)
    setBankViewMode(normalizedViewModes.bankAccounts)
    setIncomeSubsections(normalizedData.incomeSubsections ?? defaultIncomeSubsections)
    setNewBankSubsectionIds(new Set())
    setSelectedBankSubsectionIds(new Set())
    setSelectedCreditIds(new Set())
    setSelectedExpenseIds(new Set())
  }

  const persistViewModesIfEligible = (nextViewModes: FinancialPlanViewModes) => {
    if (
      isSampleMode
      || isTrackerReadOnly
      || selectedCycle !== 'current'
      || !hasSavedPersonalPlan
    ) {
      return
    }

    void fetch(`${API_BASE_URL}/api/financial-plan?cycle=current`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildPayload({ viewModes: nextViewModes })),
    }).catch(() => {
      // silent fail — view mode preference is non-critical
    })
  }

  const handleCreditViewModeToggle = () => {
    const nextViewMode: CreditViewMode = creditViewMode === 'table' ? 'tab' : 'table'
    startTransition(() => setCreditViewMode(nextViewMode))
    persistViewModesIfEligible({
      creditAccounts: nextViewMode,
      debitExpenses: expenseViewMode,
      bankAccounts: bankViewMode,
    })
  }

  const handleExpenseViewModeToggle = () => {
    const nextViewMode: ExpenseViewMode = expenseViewMode === 'table' ? 'tab' : 'table'
    startTransition(() => setExpenseViewMode(nextViewMode))
    persistViewModesIfEligible({
      creditAccounts: creditViewMode,
      debitExpenses: nextViewMode,
      bankAccounts: bankViewMode,
    })
  }

  const handleBankViewModeToggle = () => {
    const nextViewMode: BankViewMode = bankViewMode === 'table' ? 'tab' : 'table'
    startTransition(() => setBankViewMode(nextViewMode))
    persistViewModesIfEligible({
      creditAccounts: creditViewMode,
      debitExpenses: expenseViewMode,
      bankAccounts: nextViewMode,
    })
  }

  const fetchBankBalanceHistory = async (viewerUserSub?: string): Promise<BankBalanceHistoryCycle[]> => {
    const endpoint = viewerUserSub
      ? `${API_BASE_URL}/api/financial-plan/viewer/history?userSub=${encodeURIComponent(viewerUserSub)}`
      : `${API_BASE_URL}/api/financial-plan/history`
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(), HISTORY_REQUEST_TIMEOUT_MS)

    try {
      const response = await fetch(endpoint, {
        credentials: 'include',
        signal: controller.signal,
      })

      if (!response.ok) {
        return []
      }

      const historyResponse: BankBalanceHistoryResponse = await response.json()
      return historyResponse.cycles
        .map(normalizeBankBalanceHistoryCycle)
        .sort((left, right) => left.cycle.startDate.localeCompare(right.cycle.startDate))
    } catch {
      return []
    } finally {
      window.clearTimeout(timeoutId)
    }
  }

  const fetchSampleBankBalanceHistory = async (sampleTimelineType: TimelineType): Promise<BankBalanceHistoryCycle[]> => {
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(), HISTORY_REQUEST_TIMEOUT_MS)

    try {
      const response = await fetch(`${API_BASE_URL}/api/financial-plan/sample/history?timelineType=${sampleTimelineType}`, {
        credentials: 'include',
        signal: controller.signal,
      })

      if (!response.ok) {
        return []
        }

      const historyResponse: BankBalanceHistoryResponse = await response.json()
      return historyResponse.cycles
        .map(normalizeBankBalanceHistoryCycle)
        .sort((left, right) => left.cycle.startDate.localeCompare(right.cycle.startDate))
    } catch {
      return []
    } finally {
      window.clearTimeout(timeoutId)
    }
  }

  const refreshBankBalanceHistory = async (viewerUserSub?: string) => {
    const requestId = ++bankBalanceHistoryRequestIdRef.current
    const rawCycles = planViewMode === 'sample'
      ? await fetchSampleBankBalanceHistory(timelineType)
      : await fetchBankBalanceHistory(viewerUserSub)

    let displayCycles = rawCycles
    const isEncryptionActive = !!pinKey && !(authenticatedUser?.encryptionExempt ?? false) && planViewMode !== 'sample' && !viewerUserSub
    if (isEncryptionActive && pinKey) {
      const processed = await processHistoryCycles(rawCycles, pinKey)
      displayCycles = processed.displayCycles
      if (processed.cyclesToEncrypt.length > 0) {
        void fetch(`${API_BASE_URL}/api/financial-plan/history/bulk-encrypt`, {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(processed.cyclesToEncrypt),
        })
      }
    }

    if (requestId === bankBalanceHistoryRequestIdRef.current) {
      setBankBalanceHistoryCycles(displayCycles)
    }

    return displayCycles
  }

  useEffect(() => {
    if (authState !== 'authenticated') {
      return
    }

    if (!(authenticatedUser?.termsAccepted ?? false)) {
      setBankBalanceHistoryCycles([])
      return
    }

    if (planViewMode === 'sample') {
      void refreshBankBalanceHistory()
      return
    }

    if (appRoute === TRACKERS_ROUTE) {
      if (!selectedSharedViewerUserSub) {
        setBankBalanceHistoryCycles([])
        return
      }

      void refreshBankBalanceHistory(selectedSharedViewerUserSub)
      return
    }

    void refreshBankBalanceHistory()
  }, [appRoute, authState, authenticatedUser?.termsAccepted, planViewMode, selectedSharedViewerUserSub])

  const applyPersonalCycleResponse = (
    response: FinancialPlanCycleResponse,
    successMessage = '',
    preserveCloseCycleBankData = false,
    decryptedData?: FinancialPlanData,
  ) => {
    if (response.data.pinVerify) {
      setStoredPinVerify(response.data.pinVerify)
      setStoredPinVerifyIv(response.data.pinVerifyIv ?? null)
    }
    const normalizedData = normalizeFinancialPlanData(decryptedData ?? response.data)
    if (preserveCloseCycleBankData) {
      skipNextCarryoverResetRef.current = true
      setCloseCycleCarryoverBankData({
        incomeItems: normalizedData.incomeItems,
        balanceItems: normalizedData.balanceItems,
      })
    } else {
      setCloseCycleCarryoverBankData(null)
    }

    applyFinancialPlan(normalizedData)
    setSelectedCycle(response.selectedCycle)
    setTimelineType(response.timelineType)
    setCurrentCyclePeriod(response.currentCycle)
    setPreviousCyclePeriod(response.previousCycle)
    setLastCycleSavedAt(response.lastCycleSavedAt)
    setLoadedPlanSignature(getFinancialPlanSignature(normalizedData))
    setPersonalPlanSnapshot({
      data: normalizedData,
      loadedSignature: getFinancialPlanSignature(normalizedData),
      saveState: successMessage ? 'saved' : 'idle',
      saveMessage: successMessage,
    })
    setHasSavedPersonalPlan(response.hasSavedPlan)
    setShowSamplePrompt(!response.hasSavedPlan)
    setSharedViewerUsers([])
    setSelectedSharedViewerUserSub('')
    setPlanViewMode('personal')
    setHasCurrentCycleUserEdits(false)
    setSaveState(successMessage ? 'saved' : 'idle')
    setSaveMessage(successMessage)
    setNeedsPostCloseBaselineSync(true)
    if (!preserveCloseCycleBankData) {
      setSuppressCycleSwitchWarning(false)
    }
    setPlanReady(true)
  }

  const applySampleCycleResponse = (
    response: FinancialPlanCycleResponse,
    successMessage = '',
    preserveCloseCycleBankData = false,
  ) => {
    const normalizedData = normalizeFinancialPlanData(response.data)
    if (preserveCloseCycleBankData) {
      skipNextCarryoverResetRef.current = true
      setCloseCycleCarryoverBankData({
        incomeItems: normalizedData.incomeItems,
        balanceItems: normalizedData.balanceItems,
      })
    } else {
      setCloseCycleCarryoverBankData(null)
    }

    applyFinancialPlan(normalizedData)
    setSelectedCycle(response.selectedCycle)
    setTimelineType(response.timelineType)
    setCurrentCyclePeriod(response.currentCycle)
    setPreviousCyclePeriod(response.previousCycle)
    setLastCycleSavedAt(response.lastCycleSavedAt)
    setLoadedPlanSignature(getFinancialPlanSignature(normalizedData))
    setSamplePlanSnapshot({
      data: normalizedData,
      loadedSignature: getFinancialPlanSignature(normalizedData),
      saveState: successMessage ? 'saved' : 'idle',
      saveMessage: successMessage,
    })
    setSharedViewerUsers([])
    setSelectedSharedViewerUserSub('')
    setPlanViewMode('sample')
    setHasCurrentCycleUserEdits(false)
    setSaveState(successMessage ? 'saved' : 'idle')
    setSaveMessage(successMessage)
    setNeedsPostCloseBaselineSync(true)
    if (!preserveCloseCycleBankData) {
      setSuppressCycleSwitchWarning(false)
    }
    setPlanReady(true)
  }

  const markCurrentCycleEdited = () => {
    setHasCurrentCycleUserEdits(true)
    setSuppressCycleSwitchWarning(false)

    if (pendingCloseCycleReset) {
      setPendingCloseCycleReset(null)
    }
  }

  const loadPersonalPlan = async (cycle: CycleSelection = 'current', loadingMessage = 'Loading your plan...') => {
    setSaveState('loading')
    setSaveMessage(loadingMessage)

    try {
      const response = await fetch(`${API_BASE_URL}/api/financial-plan?cycle=${cycle}`, {
        credentials: 'include',
      })

      if (response.status === 401) {
        setAuthenticatedUser(null)
        setPinKey(null)
        setAuthState('unauthenticated')
        setAuthMessage('Session expired. Sign in with Google to continue.')
        setSaveState('idle')
        setSaveMessage('')
        return false
      }

      if (!response.ok) {
        throw new Error(`Failed to load financial plan: ${response.status}`)
      }

      const cycleResponse: FinancialPlanCycleResponse = await response.json()
      const isEncryptionExempt = authenticatedUser?.encryptionExempt ?? false
      const hasEncryptedData = !!cycleResponse.data.encryptedData
      if (!isEncryptionExempt && hasEncryptedData) {
        if (cycleResponse.data.pinVerify) {
          setStoredPinVerify(cycleResponse.data.pinVerify)
          setStoredPinVerifyIv(cycleResponse.data.pinVerifyIv ?? null)
        }
        if (pinKey) {
          try {
            const decryptedData = await decryptJson<FinancialPlanData>(pinKey, cycleResponse.data.encryptedData!, cycleResponse.data.encryptionIv!)
            applyPersonalCycleResponse(cycleResponse, '', false, decryptedData)
            void refreshBankBalanceHistory()
          } catch {
            applyFinancialPlan(defaultFinancialPlanData)
            setPersonalPlanSnapshot(null)
            setBankBalanceHistoryCycles([])
            setPendingEncryptedPlanResponse(cycleResponse)
            setPinInput('')
            setPinModalError('')
            setPinModalMode('verify')
            setIsPinModalOpen(true)
          }
        } else {
          applyFinancialPlan(defaultFinancialPlanData)
          setPersonalPlanSnapshot(null)
          setBankBalanceHistoryCycles([])
          setPendingEncryptedPlanResponse(cycleResponse)
          setPinInput('')
          setPinModalError('')
          setPinModalMode('verify')
          setIsPinModalOpen(true)
        }
        setAuthState('authenticated')
        return true
      }
      if (isEncryptionExempt && hasEncryptedData) {
        applyFinancialPlan(defaultFinancialPlanData)
        setPersonalPlanSnapshot(null)
        setBankBalanceHistoryCycles([])
        setPendingEncryptedPlanResponse(cycleResponse)
        setPinInput('')
        setPinModalError('')
        setPinModalMode('migrate')
        setIsPinModalOpen(true)
        setAuthState('authenticated')
        return true
      }
      applyPersonalCycleResponse(cycleResponse)
      void refreshBankBalanceHistory()
      setAuthState('authenticated')
      if (!isEncryptionExempt && !pinKey && !pinSetupInitiatedRef.current) {
        pinSetupInitiatedRef.current = true
        setPinModalTimelineType(cycleResponse.timelineType)
        setPinInput('')
        setPinConfirmInput('')
        setPinModalError('')
        setPinModalMode('new')
        setIsPinModalOpen(true)
      }
      return true
    } catch {
      setLoadedPlanSignature(getFinancialPlanSignature(defaultFinancialPlanData))
      setHasCurrentCycleUserEdits(false)
      setHasSavedPersonalPlan(false)
      setShowSamplePrompt(false)
      setSelectedCycle('current')
      setTimelineType('START_TO_END')
      setCurrentCyclePeriod(buildCurrentCycleForTimeline(new Date(), 'START_TO_END'))
      setPreviousCyclePeriod(null)
      setBankBalanceHistoryCycles([])
      setLastCycleSavedAt(null)
      setAuthState('error')
      setAuthMessage('Authentication or API service unavailable.')
      setSaveState('error')
      setSaveMessage('API unavailable. Using local defaults.')
      return false
    }
  }

  const loadSamplePlan = async (cycle: CycleSelection = 'current', loadingMessage = 'Loading sample plan...') => {
    setSaveState('loading')
    setSaveMessage(loadingMessage)

    try {
      const response = await fetch(`${API_BASE_URL}/api/financial-plan/sample?cycle=${cycle}&timelineType=${timelineType}`, {
        credentials: 'include',
      })

      if (response.status === 401) {
        setAuthenticatedUser(null)
        setAuthState('unauthenticated')
        setAuthMessage('Session expired. Sign in with Google to continue.')
        setSaveState('idle')
        setSaveMessage('')
        return false
      }

      if (response.status === 403) {
        setSaveState('error')
        setSaveMessage('Only the configured admin can edit the sample plan.')
        return false
      }

      if (!response.ok) {
        throw new Error(`Failed to load sample financial plan: ${response.status}`)
      }

      const cycleResponse: FinancialPlanCycleResponse = await response.json()
      applySampleCycleResponse(cycleResponse)
  void refreshBankBalanceHistory()
      return true
    } catch {
      setSaveState('error')
      setSaveMessage('Sample plan failed to load. Check the API server.')
      return false
    }
  }

  const loadTrackersRoute = async (preferredUserSub?: string) => {
    setSaveState('loading')
    setSaveMessage('Loading available trackers...')
    setPlanViewMode('personal')
    setPersonalPlanSnapshot(null)
    setHasSavedPersonalPlan(false)
    setShowSamplePrompt(false)
    setHasCurrentCycleUserEdits(false)
    setPendingCloseCycleReset(null)
    setSuppressCycleSwitchWarning(false)
    setNeedsPostCloseBaselineSync(false)
    setCloseCycleCarryoverBankData(null)
    setSelectedCycle('current')
    setPreviousCyclePeriod(null)
    setBankBalanceHistoryCycles([])
    setLastCycleSavedAt(null)
    applyFinancialPlan(emptyFinancialPlanData)
    setLoadedPlanSignature(getFinancialPlanSignature(emptyFinancialPlanData))

    try {
      const response = await fetch(`${API_BASE_URL}/api/financial-plan/users`, {
        credentials: 'include',
      })

      if (response.status === 401) {
        setAuthenticatedUser(null)
        setAuthState('unauthenticated')
        setAuthMessage('Session expired. Sign in with Google to continue.')
        setSaveState('idle')
        setSaveMessage('')
        return false
      }

      if (response.status === 403) {
        navigateToRoute(PERSONAL_ROUTE, { replace: true })
        setSaveState('error')
        setSaveMessage('Only the configured admin can access the trackers page.')
        return false
      }

      if (!response.ok) {
        throw new Error(`Failed to load viewer users: ${response.status}`)
      }

      const users: SharedViewerUserSummary[] = await response.json()
      if (users.length === 0) {
        setSharedViewerUsers([])
        setSelectedSharedViewerUserSub('')
        setSaveState('idle')
        setSaveMessage('No other trackers are available.')
        setPlanReady(true)
        return true
      }

      const nextUserSub = preferredUserSub && users.some((user) => user.userSub === preferredUserSub)
        ? preferredUserSub
        : users[0].userSub

      setSharedViewerUsers(users)
      return await loadSharedViewerPlan(nextUserSub, 'current')
    } catch {
      setSharedViewerUsers([])
      setSelectedSharedViewerUserSub('')
      setSaveState('error')
      setSaveMessage('Other trackers failed to load. Check the API server.')
      return false
    }
  }

  const loadSharedViewerPlan = async (
    userSub: string,
    cycle: CycleSelection = 'current',
    loadingMessage = 'Loading selected tracker...',
  ) => {
    setSaveState('loading')
    setSaveMessage(loadingMessage)

    try {
      const response = await fetch(`${API_BASE_URL}/api/financial-plan/viewer?userSub=${encodeURIComponent(userSub)}&cycle=${cycle}`, {
        credentials: 'include',
      })

      if (response.status === 401) {
        setAuthenticatedUser(null)
        setAuthState('unauthenticated')
        setAuthMessage('Session expired. Sign in with Google to continue.')
        setSharedViewerUsers([])
        setSelectedSharedViewerUserSub('')
        setSaveState('idle')
        setSaveMessage('')
        return false
      }

      if (response.status === 403) {
        navigateToRoute(PERSONAL_ROUTE, { replace: true })
        setSaveState('error')
        setSaveMessage('Only the configured admin can access the trackers page.')
        return false
      }

      if (!response.ok) {
        throw new Error(`Failed to load selected financial plan: ${response.status}`)
      }

      const cycleResponse: FinancialPlanCycleResponse = await response.json()
      applyFinancialPlan(cycleResponse.data)
  void refreshBankBalanceHistory(userSub)
      setSelectedSharedViewerUserSub(userSub)
      setSelectedCycle(cycleResponse.selectedCycle)
      setCurrentCyclePeriod(cycleResponse.currentCycle)
      setPreviousCyclePeriod(cycleResponse.previousCycle)
      setLastCycleSavedAt(cycleResponse.lastCycleSavedAt)
      setLoadedPlanSignature(getFinancialPlanSignature(cycleResponse.data))
      setPersonalPlanSnapshot(null)
      setHasSavedPersonalPlan(false)
      setShowSamplePrompt(false)
      setHasCurrentCycleUserEdits(false)
      setPendingCloseCycleReset(null)
      setSuppressCycleSwitchWarning(false)
      setNeedsPostCloseBaselineSync(false)
      setCloseCycleCarryoverBankData(null)
      setSaveState('idle')
      setSaveMessage('')
      setPlanReady(true)
      return true
    } catch {
      setSaveState('error')
      setSaveMessage('Selected tracker failed to load. Check the API server.')
      return false
    }
  }

  const persistFinancialPlan = async (
    payload: FinancialPlanData,
    successMessage = 'Saved to server',
    onSuccess?: () => void,
  ) => {
    if (isSampleMode) {
      if (!canEditSamplePlan) {
        setSaveState('idle')
        setSaveMessage('')
        return false
      }

      setSaveState('saving')
      setSaveMessage('Saving sample plan...')

      try {
        const response = await fetch(`${API_BASE_URL}/api/financial-plan/sample?timelineType=${timelineType}`, {
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

        if (response.status === 403) {
          setSaveState('error')
          setSaveMessage('Only the configured admin can save the sample plan.')
          return false
        }

        if (!response.ok) {
          throw new Error(`Failed to save sample financial plan: ${response.status}`)
        }

        const cycleResponse: FinancialPlanCycleResponse = await response.json()
        applySampleCycleResponse(cycleResponse, successMessage)
        onSuccess?.()
  void refreshBankBalanceHistory()
        return true
      } catch {
        setSaveState('error')
        setSaveMessage('Sample save failed. Check the API server.')
        return false
      }
    }

    if (isViewingPreviousCycle) {
      return false
    }

    setSaveState('saving')
    setSaveMessage('Saving...')

    try {
      const isEncryptionActive = !!pinKey && !(authenticatedUser?.encryptionExempt ?? false)
      const bodyPayload = isEncryptionActive ? await buildEncryptedWrapper(payload, pinKey) : payload
      const response = await fetch(`${API_BASE_URL}/api/financial-plan?cycle=current`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bodyPayload),
      })

      if (response.status === 401) {
        setAuthenticatedUser(null)
        setPinKey(null)
        setAuthState('unauthenticated')
        setAuthMessage('Session expired. Sign in with Google to continue.')
        setSaveState('idle')
        setSaveMessage('')
        return false
      }

      if (!response.ok) {
        throw new Error(`Failed to save financial plan: ${response.status}`)
      }

      const savedResponse: FinancialPlanCycleResponse = await response.json()
      applyPersonalCycleResponse(savedResponse, successMessage, false, isEncryptionActive ? payload : undefined)
      void refreshBankBalanceHistory()
      setPendingCloseCycleReset(null)
      setSuppressCycleSwitchWarning(false)
      onSuccess?.()
      return true
    } catch {
      setSaveState('error')
      setSaveMessage('Save failed. Check the API server.')
      return false
    }
  }

  const handleSave = async () => {
    if ((isSampleMode && !canEditSamplePlan) || isTrackerReadOnly) {
      setSaveState('idle')
      setSaveMessage('')
      return
    }

    await persistFinancialPlan(buildPayload(), isSampleMode ? 'Sample saved to server' : 'Saved to server')
  }

  const switchToCycle = async (cycle: CycleSelection) => {
    if (cycle === selectedCycle) {
      return
    }

    setIsCycleSwitchDialogOpen(false)
    setPendingCycleSelection(null)

    if (
      cycle === 'previous' &&
      pendingCloseCycleReset &&
      previousCyclePeriod &&
      pendingCloseCycleReset.previousCycle.startDate === previousCyclePeriod.startDate &&
      pendingCloseCycleReset.previousCycle.endDate === previousCyclePeriod.endDate
    ) {
      const cachedResponse: FinancialPlanCycleResponse = {
        data: pendingCloseCycleReset.previousData,
        selectedCycle: 'previous',
        timelineType,
        currentCycle: pendingCloseCycleReset.currentCycle,
        previousCycle: pendingCloseCycleReset.previousCycle,
        hasPreviousCycle: true,
        readOnly: true,
        hasSavedPlan: true,
        canCloseCycle: false,
        lastCycleSavedAt,
      }
      if (isSampleMode) {
        applySampleCycleResponse(cachedResponse)
      } else {
        applyPersonalCycleResponse(cachedResponse)
      }
      return
    }

    if (isSampleMode) {
      await loadSamplePlan(cycle, cycle === 'previous' ? 'Loading sample previous cycle...' : 'Loading sample current cycle...')
      return
    }

    await loadPersonalPlan(cycle, cycle === 'previous' ? 'Loading previous cycle...' : 'Loading current cycle...')
  }

  const handleCycleSelectionChange = async (nextCycle: CycleSelection) => {
    if (nextCycle === selectedCycle) {
      return
    }

    if (isTrackersRoute) {
      if (!selectedSharedViewerUserSub) {
        return
      }

      await loadSharedViewerPlan(
        selectedSharedViewerUserSub,
        nextCycle,
        nextCycle === 'previous' ? 'Loading selected previous cycle...' : 'Loading selected current cycle...',
      )
      return
    }

    if (shouldWarnBeforeSwitchingCycle) {
      setPendingCycleSelection(nextCycle)
      setIsCycleSwitchDialogOpen(true)
      return
    }

    await switchToCycle(nextCycle)
  }

  const handleCycleSwitchCancel = () => {
    if (saveState === 'loading' || saveState === 'saving') {
      return
    }

    setPendingCycleSelection(null)
    setIsCycleSwitchDialogOpen(false)
  }

  const handleCycleSwitchProceed = async () => {
    if (!pendingCycleSelection) {
      return
    }

    await switchToCycle(pendingCycleSelection)
  }

  const handleCycleSwitchSaveAndProceed = async () => {
    if (!pendingCycleSelection) {
      return
    }

    const saved = await persistFinancialPlan(buildPayload(), 'Saved to server')
    if (!saved) {
      return
    }

    await switchToCycle(pendingCycleSelection)
  }

  const handleCloseCycleClick = () => {
    if ((isSampleMode && !canEditSamplePlan) || isTrackerReadOnly || saveState === 'loading' || saveState === 'saving' || !canCloseCurrentCycle) {
      return
    }

    setIsCloseCycleDialogOpen(true)
  }

  const handleCloseCycleCancel = () => {
    if (saveState === 'loading' || saveState === 'saving') {
      return
    }

    setIsCloseCycleDialogOpen(false)
  }

  const handleCloseCycleConfirm = async () => {
    setSaveState('saving')
    setSaveMessage('Closing cycle...')

    try {
      const endpoint = isSampleMode
        ? `${API_BASE_URL}/api/financial-plan/sample/close-cycle?timelineType=${timelineType}`
        : `${API_BASE_URL}/api/financial-plan/close-cycle`

      const response = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          financialPlanData: buildPayload(),
          expectedCurrentCycle: currentCyclePeriod,
        }),
      })

      if (response.status === 401) {
        setAuthenticatedUser(null)
        setPinKey(null)
        setAuthState('unauthenticated')
        setAuthMessage('Session expired. Sign in with Google to continue.')
        setSaveState('idle')
        setSaveMessage('')
        setIsCloseCycleDialogOpen(false)
        return
      }

      if (response.status === 403) {
        setSaveState('error')
        setSaveMessage('Only the configured admin can close the sample plan cycle.')
        setIsCloseCycleDialogOpen(false)
        return
      }

      if (!response.ok) {
        throw new Error(`Failed to close cycle: ${response.status}`)
      }

      const cycleResponse: FinancialPlanCycleResponse = await response.json()
      const archivedCurrentData = buildPayload()
      if (isSampleMode) {
        applySampleCycleResponse(cycleResponse, 'Cycle closed. Started a new current cycle.', true)
      } else {
        applyPersonalCycleResponse(cycleResponse, 'Cycle closed. Started a new current cycle.', true)
      }
      void refreshBankBalanceHistory()
      setSuppressCycleSwitchWarning(true)
      setNeedsPostCloseBaselineSync(true)
      if (cycleResponse.previousCycle) {
        setPendingCloseCycleReset({
          currentCycle: cycleResponse.currentCycle,
          previousCycle: cycleResponse.previousCycle,
          previousData: archivedCurrentData,
        })
      }
      setIsCloseCycleDialogOpen(false)
      if (pinKey && !isSampleMode) {
        const currentKey = pinKey
        void (async () => {
          try {
            await saveCycleEncrypted(cycleResponse.data, currentKey, 'current')
            if (cycleResponse.previousCycle) {
              await saveCycleEncrypted(archivedCurrentData, currentKey, 'previous')
            }
          } catch {
            // re-encryption failed silently
          }
        })()
      }
    } catch {
      setSaveState('error')
      setSaveMessage('Close cycle failed. Reload and try again.')
    }
  }

  const handleResetClick = () => {
    const activeSnapshot = isSampleMode ? samplePlanSnapshot : personalPlanSnapshot
    if (isTrackerReadOnly || !canUseReset || !activeSnapshot || saveState === 'loading' || saveState === 'saving') {
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
    const activeSnapshot = isSampleMode ? samplePlanSnapshot : personalPlanSnapshot
    if (!activeSnapshot) {
      setIsResetDialogOpen(false)
      return
    }

    applyFinancialPlan(activeSnapshot.data)
    setLoadedPlanSignature(activeSnapshot.loadedSignature)
    setHasCurrentCycleUserEdits(false)
    setCloseCycleCarryoverBankData(null)
    setSuppressCycleSwitchWarning(false)
    setSaveState('saved')
    setSaveMessage('Reset to last saved version.')
    setIsResetDialogOpen(false)
  }

  const handleRevertCycleClick = () => {
    if (isTrackersRoute || !canRevertClosedCycle || saveState === 'loading' || saveState === 'saving') {
      return
    }

    setIsRevertCycleDialogOpen(true)
  }

  const handleRevertCycleCancel = () => {
    if (saveState === 'loading' || saveState === 'saving') {
      return
    }

    setIsRevertCycleDialogOpen(false)
  }

  const handleRevertCycleConfirm = async () => {
    const expectedCurrentCycle = pendingCloseCycleReset?.currentCycle ?? currentCyclePeriod
    const expectedPreviousCycle = pendingCloseCycleReset?.previousCycle ?? previousCyclePeriod

    if (!expectedPreviousCycle) {
      setIsRevertCycleDialogOpen(false)
      return
    }

    setSaveState('saving')
    setSaveMessage('Reverting cycle...')

    try {
      const endpoint = isSampleMode
        ? `${API_BASE_URL}/api/financial-plan/sample/revert-close-cycle?timelineType=${timelineType}`
        : `${API_BASE_URL}/api/financial-plan/revert-close-cycle`

      const response = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          expectedCurrentCycle,
          expectedPreviousCycle,
        }),
      })

      if (response.status === 401) {
        setAuthenticatedUser(null)
        setPinKey(null)
        setAuthState('unauthenticated')
        setAuthMessage('Session expired. Sign in with Google to continue.')
        setSaveState('idle')
        setSaveMessage('')
        setIsRevertCycleDialogOpen(false)
        return
      }

      if (response.status === 403) {
        setSaveState('error')
        setSaveMessage('Only the configured admin can revert the sample plan cycle.')
        setIsRevertCycleDialogOpen(false)
        return
      }

      if (!response.ok) {
        throw new Error(`Failed to revert close cycle: ${response.status}`)
      }

      const cycleResponse: FinancialPlanCycleResponse = await response.json()
      if (isSampleMode) {
        applySampleCycleResponse(cycleResponse, 'Reverted to previous cycle.')
      } else {
        applyPersonalCycleResponse(cycleResponse, 'Reverted to previous cycle.')
      }
      void refreshBankBalanceHistory()
      setPendingCloseCycleReset(null)
      setSuppressCycleSwitchWarning(false)
      setIsRevertCycleDialogOpen(false)
      if (pinKey && !isSampleMode) {
        const currentKey = pinKey
        void (async () => {
          try {
            await saveCycleEncrypted(cycleResponse.data, currentKey, 'current')
          } catch {
            // re-encryption failed silently
          }
        })()
      }
    } catch {
      setSaveState('error')
      setSaveMessage('Revert cycle failed. Reload and try again.')
      setIsRevertCycleDialogOpen(false)
    }
  }

  const handleLogin = async () => {
    await handleLogout()
    setAuthState('checking')
    setAuthMessage('Redirecting to Google sign-in...')
    window.location.href = LOGIN_URL
  }

  const requireTermsReacceptanceAfterDelete = (message: string) => {
    setAuthenticatedUser((currentUser) => currentUser ? {
      ...currentUser,
      termsAccepted: false,
      acceptedTermsVersion: null,
      acceptedTermsAt: null,
    } : currentUser)
    setTermsAcceptedChecked(false)
    setTermsError('')
    setPlanReady(false)
    setPinKey(null)
    setPendingEncryptedPlanResponse(null)
    setStoredPinVerify(null)
    setStoredPinVerifyIv(null)
    setIsPinModalOpen(false)
    setPinModalError('')
    setResetConfirmText('')
    pinSetupInitiatedRef.current = false
    setPersonalPlanSnapshot(null)
    setHasSavedPersonalPlan(false)
    setShowSamplePrompt(false)
    setBankBalanceHistoryCycles([])
    setLastCycleSavedAt(null)
    applyFinancialPlan(defaultFinancialPlanData)
    setLoadedPlanSignature(getFinancialPlanSignature(defaultFinancialPlanData))
    setSaveState('idle')
    setSaveMessage(message)
  }

  const handleAcceptTerms = async () => {
    const requiredTermsVersion = authenticatedUser?.requiredTermsVersion
    if (!requiredTermsVersion) {
      setTermsError('Terms version is unavailable. Reload and try again.')
      return
    }

    if (!termsAcceptedChecked) {
      setTermsError('You must confirm that you have read and agree to the Terms and Conditions.')
      return
    }

    setTermsSubmitting(true)
    setTermsError('')

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/terms/accept`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ termsVersion: requiredTermsVersion }),
      })

      if (response.status === 401) {
        setAuthenticatedUser(null)
        setAuthState('unauthenticated')
        setAuthMessage('Session expired. Sign in with Google to continue.')
        setTermsAcceptedChecked(false)
        return
      }

      if (!response.ok) {
        throw new Error(`Failed to accept terms: ${response.status}`)
      }

      const authData: AuthStatusResponse = await response.json()
      setAuthenticatedUser(authData)
      setTermsAcceptedChecked(false)
      setPlanReady(false)
    } catch {
      setTermsError('Terms acceptance failed. Reload and try again.')
    } finally {
      setTermsSubmitting(false)
    }
  }

  const handleFirstTimeSetupExit = async () => {
    if (pinModalMode !== 'new') {
      return
    }

    setPinModalExiting(true)
    setPinModalError('')

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/terms/reset`, {
        method: 'POST',
        credentials: 'include',
      })

      if (response.status === 401) {
        setAuthenticatedUser(null)
        setPinKey(null)
        pinSetupInitiatedRef.current = false
        setAuthState('unauthenticated')
        setAuthMessage('Session expired. Sign in with Google to continue.')
        setIsPinModalOpen(false)
        return
      }

      if (!response.ok) {
        throw new Error(`Failed to reset terms acceptance: ${response.status}`)
      }

      await handleLogout()
      setAuthMessage('Setup exited. Sign in again and accept Terms and Conditions to continue.')
    } catch {
      setPinModalError('Unable to exit setup right now. Try again.')
    } finally {
      setPinModalExiting(false)
    }
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
    setPinKey(null)
    pinSetupInitiatedRef.current = false
    setAuthState('unauthenticated')
    setAuthMessage('Signed out.')
    setTermsAcceptedChecked(false)
    setTermsError('')
    setPlanReady(false)
    setPlanViewMode('personal')
    setPinModalTimelineType('START_TO_END')
    setPinModalExiting(false)
    setSharedViewerUsers([])
    setSelectedSharedViewerUserSub('')
    setPersonalPlanSnapshot(null)
    setSamplePlanSnapshot(null)
    setHasSavedPersonalPlan(false)
    setShowSamplePrompt(false)
    setSelectedCycle('current')
    setPendingCycleSelection(null)
    setTimelineType('START_TO_END')
    setCurrentCyclePeriod(buildCurrentCycleForTimeline(new Date(), 'START_TO_END'))
    setPreviousCyclePeriod(null)
    setBankBalanceHistoryCycles([])
    setLastCycleSavedAt(null)
    setPendingCloseCycleReset(null)
    setHasCurrentCycleUserEdits(false)
    setSuppressCycleSwitchWarning(false)
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
    setSharedViewerUsers([])
    setSelectedSharedViewerUserSub('')
    setPendingCloseCycleReset(null)
    setSuppressCycleSwitchWarning(false)
    void loadSamplePlan('current', 'Loading sample plan...')
  }

  const shouldWarnBeforeSwitchingToSample = !isSampleMode && !isTrackersRoute && hasUnsavedChanges

  const handleSharedViewerSelectionChange = async (nextUserSub: string) => {
    if (!nextUserSub || nextUserSub === selectedSharedViewerUserSub) {
      return
    }

    await loadSharedViewerPlan(nextUserSub, 'current')
  }

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

    if (isTrackersRoute) {
      setSharedViewerUsers([])
      setSelectedSharedViewerUserSub('')
      navigateToRoute(PERSONAL_ROUTE)
      return
    }

    setSharedViewerUsers([])
    setSelectedSharedViewerUserSub('')
    const loaded = await loadPersonalPlan('current', 'Loading your plan...')
    if (!loaded && personalPlanSnapshot) {
      applyFinancialPlan(personalPlanSnapshot.data)
      setLoadedPlanSignature(personalPlanSnapshot.loadedSignature)
      setHasCurrentCycleUserEdits(false)
      setSaveState(personalPlanSnapshot.saveState === 'loading' || personalPlanSnapshot.saveState === 'saving' ? 'idle' : personalPlanSnapshot.saveState)
      setSaveMessage(personalPlanSnapshot.saveMessage)
      setPlanViewMode('personal')
    }
  }

  const handleAdminDeleteViewerTracker = async (userSub: string) => {
    setIsDeletingViewerTracker(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/financial-plan/users/${encodeURIComponent(userSub)}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!response.ok) {
        throw new Error(`Delete failed: ${response.status}`)
      }
      setAdminDeleteConfirmUserSub(null)
      await loadTrackersRoute()
    } catch {
      setSaveState('error')
      setSaveMessage('Failed to delete tracker. Check the API server.')
    } finally {
      setIsDeletingViewerTracker(false)
    }
  }

  const handleDeleteTrackerClick = () => {
    if (isTrackersRoute || (isSampleMode && !canEditSamplePlan)) {
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

  const handleTimelineSwitchClick = () => {
    if (isTrackersRoute || (isSampleMode && !canEditSamplePlan) || isViewingPreviousCycle || saveState === 'loading' || saveState === 'saving') {
      return
    }

    setIsUserMenuOpen(false)
    setPendingTimelineTypeSwitch(getAlternateTimelineType(timelineType))
    setIsTimelineSwitchDialogOpen(true)
  }

  const handleTimelineSwitchCancel = () => {
    if (saveState === 'loading' || saveState === 'saving') {
      return
    }

    setPendingTimelineTypeSwitch(null)
    setIsTimelineSwitchDialogOpen(false)
  }

  const handleTimelineSwitchConfirm = async () => {
    if (!pendingTimelineTypeSwitch || isTrackersRoute || (isSampleMode && !canEditSamplePlan) || isViewingPreviousCycle) {
      return
    }

    setSaveState('saving')
    setSaveMessage('Switching timeline...')

    try {
      const endpoint = isSampleMode
        ? `${API_BASE_URL}/api/financial-plan/sample/switch-timeline?timelineType=${timelineType}`
        : `${API_BASE_URL}/api/financial-plan/switch-timeline`

      const response = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          financialPlanData: buildPayload(),
          expectedCurrentCycle: currentCyclePeriod,
          targetTimelineType: pendingTimelineTypeSwitch,
        }),
      })

      if (response.status === 401) {
        setAuthenticatedUser(null)
        setPinKey(null)
        setAuthState('unauthenticated')
        setAuthMessage('Session expired. Sign in with Google to continue.')
        setSaveState('idle')
        setSaveMessage('')
        setIsTimelineSwitchDialogOpen(false)
        setPendingTimelineTypeSwitch(null)
        return
      }

      if (response.status === 403) {
        setSaveState('error')
        setSaveMessage('Only the configured admin can switch the sample plan timeline.')
        setIsTimelineSwitchDialogOpen(false)
        setPendingTimelineTypeSwitch(null)
        return
      }

      if (!response.ok) {
        throw new Error(`Failed to switch timeline: ${response.status}`)
      }

      const cycleResponse: FinancialPlanCycleResponse = await response.json()
      if (isSampleMode) {
        applySampleCycleResponse(cycleResponse, `Timeline switched to ${formatTimelineTypeLabel(cycleResponse.timelineType)}.`)
      } else {
        applyPersonalCycleResponse(cycleResponse, `Timeline switched to ${formatTimelineTypeLabel(cycleResponse.timelineType)}.`)
      }
      void refreshBankBalanceHistory()
      setPendingCloseCycleReset(null)
      setSelectedCycle('current')
      setPendingTimelineTypeSwitch(null)
      setIsTimelineSwitchDialogOpen(false)
      if (pinKey && !isSampleMode) {
        const currentKey = pinKey
        void (async () => {
          try {
            await saveCycleEncrypted(cycleResponse.data, currentKey, 'current')
          } catch {
            // re-encryption failed silently
          }
        })()
      }
    } catch {
      setSaveState('error')
      setSaveMessage('Timeline switch failed. Reload and try again.')
      setIsTimelineSwitchDialogOpen(false)
      setPendingTimelineTypeSwitch(null)
    }
  }

  const applyCurrencySelection = (code: string) => {
    const config = SUPPORTED_CURRENCIES.find(c => c.code === code) ?? SUPPORTED_CURRENCIES[0]!
    _activeCurrency = config
    localStorage.setItem(CURRENCY_STORAGE_KEY, code)
    setCurrencyCode(code)
  }

  const buildEncryptedWrapper = async (data: FinancialPlanData, key: CryptoKey): Promise<FinancialPlanData> => {
    const { ciphertext, iv } = await encryptJson(key, data)
    const verifyData = await createVerifyToken(key)
    return {
      creditAccounts: [],
      incomeItems: [],
      balanceItems: [],
      planoExpenses: [],
      sanfordExpenses: [],
      otherExpenses: [],
      incomeSubsections: [],
      encryptedData: ciphertext,
      encryptionIv: iv,
      pinVerify: verifyData.ciphertext,
      pinVerifyIv: verifyData.iv,
    }
  }

  const saveCycleEncrypted = async (data: FinancialPlanData, key: CryptoKey, cycle: 'current' | 'previous'): Promise<void> => {
    const wrapper = await buildEncryptedWrapper(data, key)
    await fetch(`${API_BASE_URL}/api/financial-plan?cycle=${cycle}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(wrapper),
    })
  }

  const fetchRawCycleData = async (cycle: 'current' | 'previous'): Promise<FinancialPlanCycleResponse | null> => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/financial-plan?cycle=${cycle}`, { credentials: 'include' })
      if (!response.ok) return null
      return response.json() as Promise<FinancialPlanCycleResponse>
    } catch {
      return null
    }
  }

  type EncryptHistoryBulkItem = {
    timelineType: string
    cycleStartDate: string
    cycleEndDate: string
    encryptedHistoryData: string
    encryptionIv: string
  }

  const processHistoryCycles = async (
    cycles: BankBalanceHistoryCycle[],
    key: CryptoKey,
  ): Promise<{ displayCycles: BankBalanceHistoryCycle[]; cyclesToEncrypt: EncryptHistoryBulkItem[] }> => {
    const displayCycles: BankBalanceHistoryCycle[] = []
    const cyclesToEncrypt: EncryptHistoryBulkItem[] = []

    for (const cycle of cycles) {
      if (cycle.encryptedHistoryData && cycle.encryptionIv) {
        try {
          const decryptedBanks = await decryptJson<BankBalanceHistoryPoint[]>(key, cycle.encryptedHistoryData, cycle.encryptionIv)
          displayCycles.push({ cycle: cycle.cycle, banks: decryptedBanks })
        } catch {
          displayCycles.push({ cycle: cycle.cycle, banks: [] })
        }
      } else if (cycle.banks.length > 0) {
        displayCycles.push(cycle)
        try {
          const { ciphertext, iv } = await encryptJson(key, cycle.banks)
          cyclesToEncrypt.push({
            timelineType,
            cycleStartDate: cycle.cycle.startDate,
            cycleEndDate: cycle.cycle.endDate,
            encryptedHistoryData: ciphertext,
            encryptionIv: iv,
          })
        } catch {
          // ignore encryption failure for this cycle
        }
      } else {
        displayCycles.push(cycle)
      }
    }

    return { displayCycles, cyclesToEncrypt }
  }

  const handlePinSubmit = async () => {
    if (pinModalSubmitting) return
    setPinModalSubmitting(true)
    setPinModalError('')
    try {
      if (pinModalMode === 'new') {
        if (pinInput.length !== 4) {
          setPinModalError('PIN must be exactly 4 letters and numbers.')
          return
        }
        if (pinInput !== pinConfirmInput) {
          setPinModalError('PINs do not match. Please try again.')
          setPinConfirmInput('')
          return
        }
        applyCurrencySelection(pinModalCurrency)
        const userSub = authenticatedUser?.email ?? 'unknown'
        const key = await deriveKey(pinInput, userSub)
        const currentCycleData = buildPayload()
        if (pinModalTimelineType !== timelineType) {
          const encryptedPayload = await buildEncryptedWrapper(currentCycleData, key)
          const response = await fetch(`${API_BASE_URL}/api/financial-plan/switch-timeline`, {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              financialPlanData: encryptedPayload,
              expectedCurrentCycle: currentCyclePeriod,
              targetTimelineType: pinModalTimelineType,
            }),
          })
          if (!response.ok) {
            throw new Error(`Failed to switch timeline during PIN setup: ${response.status}`)
          }
          const cycleResponse: FinancialPlanCycleResponse = await response.json()
          applyPersonalCycleResponse(cycleResponse, 'PIN created and data encrypted.', false, currentCycleData)
          void refreshBankBalanceHistory()
        } else {
          await saveCycleEncrypted(currentCycleData, key, 'current')
          const rawPrevious = await fetchRawCycleData('previous')
          if (rawPrevious?.hasPreviousCycle && !rawPrevious.data.encryptedData) {
            await saveCycleEncrypted(rawPrevious.data, key, 'previous')
          }
          setSaveState('saved')
          setSaveMessage('PIN created and data encrypted.')
        }
        setPinKey(key)
        setIsPinModalOpen(false)
        setPinInput('')
        setPinConfirmInput('')
      } else if (pinModalMode === 'verify') {
        if (pinInput.length !== 4) {
          setPinModalError('PIN must be exactly 4 letters and numbers.')
          return
        }
        if (!pendingEncryptedPlanResponse) {
          setIsPinModalOpen(false)
          return
        }
        const userSub = authenticatedUser?.email ?? 'unknown'
        const key = await deriveKey(pinInput, userSub)
        const pinVerifyVal = pendingEncryptedPlanResponse.data.pinVerify ?? storedPinVerify
        const pinVerifyIvVal = pendingEncryptedPlanResponse.data.pinVerifyIv ?? storedPinVerifyIv
        if (!pinVerifyVal || !pinVerifyIvVal) {
          setPinModalError('Verification data missing. Please contact support.')
          return
        }
        const isValid = await verifyPin(key, pinVerifyVal, pinVerifyIvVal)
        if (!isValid) {
          setPinModalError('Incorrect PIN. Your data remains encrypted and locked.')
          setPinInput('')
          return
        }
        const decryptedData = await decryptJson<FinancialPlanData>(
          key,
          pendingEncryptedPlanResponse.data.encryptedData!,
          pendingEncryptedPlanResponse.data.encryptionIv!,
        )
        setPinKey(key)
        applyPersonalCycleResponse(pendingEncryptedPlanResponse, '', false, decryptedData)
        void refreshBankBalanceHistory()
        setPendingEncryptedPlanResponse(null)
        setIsPinModalOpen(false)
        setPinInput('')
      } else if (pinModalMode === 'migrate') {
        if (pinInput.length !== 4) {
          setPinModalError('PIN must be exactly 4 letters and numbers.')
          return
        }
        if (!pendingEncryptedPlanResponse) {
          setIsPinModalOpen(false)
          return
        }
        const userSub = authenticatedUser?.email ?? 'unknown'
        const key = await deriveKey(pinInput, userSub)
        const pinVerifyVal = pendingEncryptedPlanResponse.data.pinVerify
        const pinVerifyIvVal = pendingEncryptedPlanResponse.data.pinVerifyIv
        if (!pinVerifyVal || !pinVerifyIvVal) {
          setPinModalError('Verification data missing. Please contact support.')
          return
        }
        const isValid = await verifyPin(key, pinVerifyVal, pinVerifyIvVal)
        if (!isValid) {
          setPinModalError('Incorrect PIN. Your data remains encrypted and locked.')
          setPinInput('')
          return
        }
        const decryptedData = await decryptJson<FinancialPlanData>(
          key,
          pendingEncryptedPlanResponse.data.encryptedData!,
          pendingEncryptedPlanResponse.data.encryptionIv!,
        )
        applyPersonalCycleResponse(pendingEncryptedPlanResponse, '', false, decryptedData)
        setPendingEncryptedPlanResponse(null)
        setIsPinModalOpen(false)
        setPinInput('')
        void persistFinancialPlan(decryptedData, 'Data migrated to unencrypted storage.')
      } else if (pinModalMode === 'change') {
        if (pinCurrentInput.length !== 4 || pinNewInput.length !== 4 || pinNewConfirmInput.length !== 4) {
          setPinModalError('All PIN fields must be exactly 4 letters and numbers.')
          return
        }
        if (pinNewInput !== pinNewConfirmInput) {
          setPinModalError('New PINs do not match. Please try again.')
          setPinNewInput('')
          setPinNewConfirmInput('')
          return
        }
        if (!pendingEncryptedPlanResponse) {
          setPinModalError('Could not load current plan data. Please reload and try again.')
          return
        }
        const userSub = authenticatedUser?.email ?? 'unknown'
        const currentKey = await deriveKey(pinCurrentInput, userSub)
        const pinVerifyVal = pendingEncryptedPlanResponse.data.pinVerify
        const pinVerifyIvVal = pendingEncryptedPlanResponse.data.pinVerifyIv
        if (!pinVerifyVal || !pinVerifyIvVal) {
          setPinModalError('Could not verify current PIN. Please reload and try again.')
          return
        }
        const isValid = await verifyPin(currentKey, pinVerifyVal, pinVerifyIvVal)
        if (!isValid) {
          setPinModalError('Current PIN is incorrect.')
          setPinCurrentInput('')
          return
        }
        const newKey = await deriveKey(pinNewInput, userSub)
        const currentCycleData = buildPayload()
        await saveCycleEncrypted(currentCycleData, newKey, 'current')
        const rawPrevious = await fetchRawCycleData('previous')
        if (rawPrevious?.data.encryptedData && rawPrevious.data.encryptionIv) {
          try {
            const decryptedPrevious = await decryptJson<FinancialPlanData>(currentKey, rawPrevious.data.encryptedData, rawPrevious.data.encryptionIv)
            await saveCycleEncrypted(decryptedPrevious, newKey, 'previous')
          } catch {
            // previous cycle re-encryption failed - skip
          }
        }
        setPinKey(newKey)
        setIsPinModalOpen(false)
        setPinCurrentInput('')
        setPinNewInput('')
        setPinNewConfirmInput('')
      }
    } catch {
      setPinModalError('An error occurred. Please try again.')
    } finally {
      setPinModalSubmitting(false)
    }
  }

  const handleForgotPin = () => {
    setResetConfirmText('')
    setPinModalError('')
    setPinModalMode('reset-confirm')
  }

  const handlePinResetConfirm = async () => {
    if (resetConfirmText !== 'RESET') {
      setPinModalError('Please type RESET to confirm.')
      return
    }
    setPinModalSubmitting(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/financial-plan`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!response.ok && response.status !== 404) {
        setPinModalError('Failed to delete data. Please try again.')
        return
      }
      setPinKey(null)
      setPendingEncryptedPlanResponse(null)
      setStoredPinVerify(null)
      setStoredPinVerifyIv(null)
      setIsPinModalOpen(false)
      setResetConfirmText('')
      requireTermsReacceptanceAfterDelete('Tracker deleted. Accept Terms and Conditions to continue.')
    } catch {
      setPinModalError('Failed to delete data. Please try again.')
    } finally {
      setPinModalSubmitting(false)
    }
  }

  const handleChangePinClick = async () => {
    setIsUserMenuOpen(false)
    const rawPlan = await fetchRawCycleData('current')
    if (!rawPlan?.data.pinVerify) {
      return
    }
    setPendingEncryptedPlanResponse(rawPlan)
    setPinCurrentInput('')
    setPinNewInput('')
    setPinNewConfirmInput('')
    setPinModalError('')
    setPinModalMode('change')
    setIsPinModalOpen(true)
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
    setDeleteState('deleting')
    setDeleteMessage(isSampleMode ? 'Deleting sample plan data...' : 'Deleting your tracker data...')
    setSaveState('loading')
    setSaveMessage(isSampleMode ? 'Deleting sample plan...' : 'Deleting tracker...')

    try {
      const deleteEndpoint = isSampleMode
        ? `${API_BASE_URL}/api/financial-plan/sample?timelineType=${timelineType}`
        : `${API_BASE_URL}/api/financial-plan`

      const deleteResponse = await fetch(deleteEndpoint, {
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

      const reloadEndpoint = isSampleMode
        ? `${API_BASE_URL}/api/financial-plan/sample?cycle=current&timelineType=${timelineType}`
        : `${API_BASE_URL}/api/financial-plan?cycle=current`

      const reloadResponse = await fetch(reloadEndpoint, {
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

      const freshResponse: FinancialPlanCycleResponse = await reloadResponse.json()
      if (isSampleMode) {
        applySampleCycleResponse(freshResponse, 'Sample tracker deleted. Started fresh with a new plan.')
      } else {
        requireTermsReacceptanceAfterDelete('Tracker deleted. Accept Terms and Conditions to continue.')
        setIsDeleteDialogOpen(false)
        setDeleteState('idle')
        setDeleteMessage('')
        return
      }
      void refreshBankBalanceHistory()
      setIsDeleteDialogOpen(false)
      setDeleteState('idle')
      setDeleteMessage('')
    } catch {
      setDeleteState('error')
      setDeleteMessage('Delete failed. Check the API server.')
      setSaveState('error')
      setSaveMessage('Delete failed. Check the API server.')
    }
  }

  useEffect(() => {
    if (authState !== 'authenticated') {
      return
    }

    if (!(authenticatedUser?.termsAccepted ?? false)) {
      return
    }

    if (appRoute === TRACKERS_ROUTE && !canAccessTrackersRoute) {
      navigateToRoute(PERSONAL_ROUTE, { replace: true })
      setSaveState('error')
      setSaveMessage('Only the configured admin can access the trackers page.')
      return
    }

    if (appRoute === TRACKERS_ROUTE) {
      void loadTrackersRoute(selectedSharedViewerUserSub || undefined)
      return
    }

    void loadPersonalPlan('current', 'Loading saved plan...')
  }, [appRoute, authState, authenticatedUser?.termsAccepted, canAccessTrackersRoute])

  if (authState !== 'authenticated') {
    return (
      <div className="auth-shell">
        <section className="auth-card">
          <p className="eyebrow">Financial Planning</p>
          <h1>Personal Finance Tracker</h1>
          <p className="auth-copy">
            Sign in with Google to access the shared financial planning dashboard.
          </p>
          <button type="button" className="toolbar-button auth-button" onClick={() => void handleLogin()} disabled={authState === 'checking'}>
            {authState === 'checking' ? 'Checking...' : 'Sign in with Google'}
          </button>
          <p className={`auth-message auth-${authState}`}>{authMessage}</p>
        </section>
      </div>
    )
  }

  if (!(authenticatedUser?.termsAccepted ?? false)) {
    return (
      <div className="auth-shell">
        <section className="auth-card terms-card">
          <p className="eyebrow">Terms And Conditions</p>
          <h1>Acceptance Required</h1>
          <p className="auth-copy">
            You must accept the current Terms and Conditions before using MyBetterBudget.com, including all personal, shared, and admin features.
          </p>
          {authenticatedUser?.email ? <p className="terms-email">Signed in as {authenticatedUser.email}</p> : null}
          <p className="terms-meta">
            Version: {authenticatedUser?.requiredTermsVersion ?? 'Unavailable'} | Last updated {TERMS_LAST_UPDATED_LABEL}
          </p>
          <div className="terms-panel">
            <h2>Important Disclosures</h2>
            <p>
              MyBetterBudget.com is a personal budgeting and tracking tool provided for informational and convenience purposes only. It is not financial, investment, legal, tax, accounting, credit, debt-management, or other professional advice, and your use of the service does not create any fiduciary, advisory, agency, or professional-client relationship with the website owner or administrators.
            </p>
            <ul className="terms-list">
              <li>You are solely responsible for all information you enter, all balances, formulas, labels, projections, payment schedules, transfers, due dates, tax assumptions, and all financial or personal decisions you make based on the website.</li>
              <li>The website may contain bugs, calculation mistakes, data-processing errors, display issues, omissions, outdated logic, incorrect assumptions, or results you misunderstand, disagree with, or rely on at your own risk.</li>
              <li>You agree that you will independently verify important information before making financial, legal, tax, credit, budgeting, payment, lending, investment, employment, or personal decisions.</li>
              <li>You understand and accept that data may be lost, corrupted, overwritten, duplicated, delayed, become unavailable, or become permanently inaccessible due to software bugs, hosting failures, browser issues, device issues, security incidents, deployments, migrations, synchronization issues, user error, third-party outages, or forgotten credentials.</li>
              <li>If your data is encrypted, forgetting your PIN may permanently prevent recovery of that data, and neither the website owner nor the administrators are obligated or able to recover it for you.</li>
              <li>The service is provided on an "as is," "as available," and "with all faults" basis, without warranties or representations of any kind, whether express or implied, including warranties of accuracy, completeness, merchantability, fitness for a particular purpose, non-infringement, availability, security, or uninterrupted operation.</li>
              <li>To the maximum extent permitted by law, the website owner and administrators disclaim liability for any direct, indirect, incidental, consequential, special, exemplary, punitive, or other losses, damages, costs, liabilities, claims, disputes, taxes, penalties, interest, missed payments, credit impacts, lost profits, lost savings, or lost opportunities arising from or related to the website, your data, your use of the website, your inability to use the website, reliance on outputs, formula mistakes, security events, service interruptions, or data loss.</li>
              <li>You are responsible for maintaining your own records, exports, backups, independent calculations, and independent verification of any information you enter, store, review, or rely on through the service.</li>
              <li>You agree to indemnify, defend, and hold harmless the website owner and administrators from claims, losses, liabilities, damages, and expenses arising out of your use of the website, your data, your violation of these Terms and Conditions, or your misuse of any output generated by the website.</li>
              <li>The website owner may modify, suspend, restrict, remove, reset, or terminate features, access, data visibility, encryption modes, user accounts, shared access, terms, formulas, and availability at any time, with or without notice.</li>
              <li>By accepting, you acknowledge that these Terms and Conditions govern your use of the website whether you are a normal user or an admin, and that your continued access to the website is conditioned on accepting the current version.</li>
            </ul>
          </div>
          <label className="terms-checkbox-row">
            <input
              type="checkbox"
              checked={termsAcceptedChecked}
              onChange={(event) => setTermsAcceptedChecked(event.target.checked)}
              disabled={termsSubmitting}
            />
            <span>I have read and agree to the Terms and Conditions, including the disclaimers, assumption of risk, limitation of liability, and indemnification obligations above.</span>
          </label>
          {termsError ? <p className="auth-message auth-error">{termsError}</p> : null}
          <div className="modal-actions terms-actions">
            <button type="button" className="toolbar-button" onClick={() => void handleLogout()} disabled={termsSubmitting}>
              Sign Out
            </button>
            <button type="button" className="toolbar-button auth-button" onClick={() => void handleAcceptTerms()} disabled={termsSubmitting || !termsAcceptedChecked}>
              {termsSubmitting ? 'Saving Acceptance...' : 'Accept Terms And Continue'}
            </button>
          </div>
        </section>
      </div>
    )
  }

  if (isPinModalOpen && (pinModalMode === 'verify' || pinModalMode === 'migrate' || pinModalMode === 'new' || pinModalMode === 'reset-confirm')) {
    return (
      <div className="app app-pin-locked">
        <div className="modal-backdrop" role="presentation">
          <section
            className={`modal-card pin-modal${pinModalMode === 'reset-confirm' ? ' danger-modal' : ''}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="pin-modal-title"
          >
            {pinModalMode === 'new' ? (
              <>
                <div className="pin-modal-brand">
                  <p className="pin-modal-site-name">MyBetterBudget.com</p>
                  <p className="pin-modal-app-title">Personal Finance Tracker</p>
                </div>
                {authenticatedUser?.email ? (
                  <p className="pin-modal-user-email">{authenticatedUser.email}</p>
                ) : null}
                <p className="eyebrow">Welcome — One-Time Setup</p>
                <h2 id="pin-modal-title">Protect Your Financial Data</h2>
                <p>🔒 <strong>Your financial data is private to you.</strong></p>
                <p>Set a 4-character PIN using letters and numbers to enable end-to-end encryption. Your data is encrypted with AES-256-GCM directly in your browser — we have no way to see it. Your PIN never leaves your device and is never stored anywhere.</p>
                <p className="danger-copy-subtle">⚠️ Your PIN cannot be recovered. If forgotten, your data will be permanently deleted.</p>
                <div className="pin-fields">
                  <input
                    type="password"
                    inputMode="text"
                    maxLength={4}
                    placeholder="Enter 4-character PIN"
                    value={pinInput}
                    onChange={(e) => setPinInput(normalizePinValue(e.target.value))}
                    onKeyDown={(e) => { if (e.key === 'Enter') void handlePinSubmit() }}
                    className="pin-input"
                    autoCapitalize="characters"
                    autoCorrect="off"
                    spellCheck={false}
                    autoFocus
                  />
                  <input
                    type="password"
                    inputMode="text"
                    maxLength={4}
                    placeholder="Confirm PIN"
                    value={pinConfirmInput}
                    onChange={(e) => setPinConfirmInput(normalizePinValue(e.target.value))}
                    onKeyDown={(e) => { if (e.key === 'Enter') void handlePinSubmit() }}
                    className="pin-input"
                    autoCapitalize="characters"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                </div>
                <div className="pin-currency-select">
                  <label htmlFor="pin-currency" className="pin-currency-label">Currency</label>
                  <select
                    id="pin-currency"
                    value={pinModalCurrency}
                    onChange={(e) => setPinModalCurrency(e.target.value)}
                    className="pin-currency-dropdown"
                  >
                    {SUPPORTED_CURRENCIES.map(c => (
                      <option key={c.code} value={c.code}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <fieldset className="pin-timeline-select">
                  <legend className="pin-timeline-label">Cycle Type</legend>
                  <label className="pin-timeline-option">
                    <input
                      type="radio"
                      name="pin-timeline-type"
                      value="START_TO_END"
                      checked={pinModalTimelineType === 'START_TO_END'}
                      onChange={() => setPinModalTimelineType('START_TO_END')}
                    />
                    <span>Start of Month to End of Month</span>
                  </label>
                  <label className="pin-timeline-option">
                    <input
                      type="radio"
                      name="pin-timeline-type"
                      value="MID_TO_MID"
                      checked={pinModalTimelineType === 'MID_TO_MID'}
                      onChange={() => setPinModalTimelineType('MID_TO_MID')}
                    />
                    <span>Mid Month to Mid Month</span>
                  </label>
                </fieldset>
                {pinModalError ? <p className="auth-message auth-error">{pinModalError}</p> : null}
                <div className="modal-actions">
                  <button type="button" className="toolbar-button link-button" onClick={() => void handleFirstTimeSetupExit()} disabled={pinModalSubmitting || pinModalExiting}>
                    {pinModalExiting ? 'Exiting...' : 'Exit'}
                  </button>
                  <button type="button" className="toolbar-button" onClick={() => void handlePinSubmit()} disabled={pinModalSubmitting || pinModalExiting}>
                    {pinModalSubmitting ? 'Setting up...' : 'Get Started'}
                  </button>
                </div>
              </>
            ) : pinModalMode === 'verify' ? (
              <>
                <p className="eyebrow">Security</p>
                <h2 id="pin-modal-title">Your Data Is Encrypted</h2>
                {authenticatedUser?.email ? (
                  <p className="pin-modal-user-email">{authenticatedUser.email}</p>
                ) : null}
                <p>🔒 <strong>Your data is end-to-end encrypted.</strong></p>
                <p>Enter your 4-character PIN to decrypt your financial data. Your data is protected with AES-256-GCM — only your PIN can unlock it. We have no way to access it.</p>
                <div className="pin-fields">
                  <input
                    type="password"
                    inputMode="text"
                    maxLength={4}
                    placeholder="Enter your PIN"
                    value={pinInput}
                    onChange={(e) => setPinInput(normalizePinValue(e.target.value))}
                    onKeyDown={(e) => { if (e.key === 'Enter') void handlePinSubmit() }}
                    className="pin-input"
                    autoCapitalize="characters"
                    autoCorrect="off"
                    spellCheck={false}
                    autoFocus
                  />
                </div>
                {pinModalError ? <p className="auth-message auth-error">{pinModalError}</p> : null}
                <div className="modal-actions">
                  <button type="button" className="toolbar-button link-button" onClick={handleForgotPin}>
                    Forgot PIN?
                  </button>
                  <button type="button" className="toolbar-button" onClick={() => void handlePinSubmit()} disabled={pinModalSubmitting}>
                    {pinModalSubmitting ? 'Unlocking...' : 'Unlock'}
                  </button>
                </div>
              </>
            ) : pinModalMode === 'migrate' ? (
              <>
                <p className="eyebrow">Security</p>
                <h2 id="pin-modal-title">One-Time PIN Required</h2>
                <p>Your account has been moved to unencrypted mode. Enter your PIN once to migrate your data to plaintext storage.</p>
                <div className="pin-fields">
                  <input
                    type="password"
                    inputMode="text"
                    maxLength={4}
                    placeholder="Enter your PIN"
                    value={pinInput}
                    onChange={(e) => setPinInput(normalizePinValue(e.target.value))}
                    onKeyDown={(e) => { if (e.key === 'Enter') void handlePinSubmit() }}
                    className="pin-input"
                    autoCapitalize="characters"
                    autoCorrect="off"
                    spellCheck={false}
                    autoFocus
                  />
                </div>
                {pinModalError ? <p className="auth-message auth-error">{pinModalError}</p> : null}
                <div className="modal-actions">
                  <button type="button" className="toolbar-button" onClick={() => void handlePinSubmit()} disabled={pinModalSubmitting}>
                    {pinModalSubmitting ? 'Migrating...' : 'Migrate Data'}
                  </button>
                </div>
              </>
            ) : pinModalMode === 'reset-confirm' ? (
              <>
                <p className="eyebrow danger-eyebrow">Danger Zone</p>
                <h2 id="pin-modal-title">Reset Account Data</h2>
                {authenticatedUser?.email ? (
                  <p className="pin-modal-user-email">{authenticatedUser.email}</p>
                ) : null}
                <p className="danger-copy">
                  You forgot your PIN. The only option is to permanently delete all your saved financial data. This cannot be undone.
                </p>
                <p className="danger-copy-subtle">
                  Type <strong>RESET</strong> below to confirm permanent data deletion.
                </p>
                <input
                  type="text"
                  placeholder="Type RESET to confirm"
                  value={resetConfirmText}
                  onChange={(e) => setResetConfirmText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') void handlePinResetConfirm() }}
                  className="pin-input"
                  autoFocus
                />
                {pinModalError ? <p className="auth-message auth-error">{pinModalError}</p> : null}
                <div className="modal-actions">
                  <button
                    type="button"
                    className="toolbar-button"
                    onClick={() => { setPinModalMode('verify'); setPinModalError(''); setPinInput(''); }}
                    disabled={pinModalSubmitting}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    className="toolbar-button destructive-button"
                    onClick={() => void handlePinResetConfirm()}
                    disabled={resetConfirmText !== 'RESET' || pinModalSubmitting}
                  >
                    {pinModalSubmitting ? 'Deleting...' : 'Delete All My Data'}
                  </button>
                </div>
              </>
            ) : null}
          </section>
        </div>
      </div>
    )
  }

  if (!planReady) {
    return (
      <div className="auth-shell">
        <section className="auth-card">
          <p className="eyebrow">Financial Planning</p>
          <h1>Personal Finance Tracker</h1>
          <p className="auth-copy">Loading your plan...</p>
        </section>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="hero" style={creditWidthCapStyle}>
        <div>
          <p className="eyebrow">Financial Planning</p>
          <h1>{isTrackersRoute ? 'Shared Trackers' : 'Personal Finance Tracker'}</h1>
          <p className="intro">
            {isTrackersRoute
              ? 'Review other users\' trackers on a dedicated read-only route.'
              : 'Track cards, statements, payments, income, balances, and spreadsheet-style expense totals in one dashboard.'}
          </p>
          <p className="build-stamp">{buildStampLabel}</p>
        </div>
        <div className="hero-actions">
          <button type="button" className="toolbar-button" onClick={handleSave} disabled={isPlanReadOnly || saveState === 'loading' || saveState === 'saving'}>
            {isSampleMode ? canEditSamplePlan ? (saveState === 'saving' ? 'Saving Sample...' : 'Save Sample') : 'Sample Read Only' : isTrackerReadOnly ? 'Read Only' : saveState === 'saving' ? 'Saving...' : 'Save Changes'}
          </button>
          <button
            type="button"
            className="toolbar-button"
            onClick={handleResetClick}
            disabled={isTrackerReadOnly || !canUseReset || !(isSampleMode ? samplePlanSnapshot : personalPlanSnapshot) || saveState === 'loading' || saveState === 'saving'}
          >
            Reset
          </button>
          <span className={statusClassName}>{statusText}</span>
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
                  {isTrackersRoute ? (
                    <>
                      <button type="button" className="user-menu-item" disabled role="menuitem" aria-disabled="true">
                        View Other Trackers
                      </button>
                      <button type="button" className="user-menu-item" onClick={handleReturnToMyPlan} role="menuitem">
                        Back to My Plan
                      </button>
                    </>
                  ) : isSampleMode ? (
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
                  {!isTrackersRoute ? (
                    <>
                      <button type="button" className="user-menu-item" disabled role="menuitem" aria-disabled="true">
                        Timeline: {formatTimelineTypeLabel(timelineType)}
                      </button>
                      <button
                        type="button"
                        className="user-menu-item"
                        onClick={handleTimelineSwitchClick}
                        role="menuitem"
                        disabled={isViewingPreviousCycle || saveState === 'loading' || saveState === 'saving'}
                      >
                        Switch to {formatTimelineTypeLabel(getAlternateTimelineType(timelineType))}
                      </button>
                    </>
                  ) : null}
                  {!isTrackersRoute && (!isSampleMode || canEditSamplePlan) ? (
                    <button type="button" className="user-menu-item user-menu-item-danger" onClick={handleDeleteTrackerClick} role="menuitem">
                      {isSampleMode ? 'Delete Sample Tracker' : 'Delete My Tracker'}
                    </button>
                  ) : null}
                  {pinKey ? (
                    <button type="button" className="user-menu-item" onClick={() => void handleChangePinClick()} role="menuitem">
                      Change PIN
                    </button>
                  ) : null}
                  <button type="button" className="user-menu-item" onClick={handleHelpClick} role="menuitem">
                    Help
                  </button>
                  <button type="button" className="user-menu-item" onClick={handleLogout} role="menuitem">
                    Sign Out
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </header>

      {isSampleMode ? (
        <section className="sample-banner" aria-label="Sample plan mode" style={creditWidthCapStyle}>
          <div>
            <strong>{canEditSamplePlan ? 'Editing sample plan' : 'Viewing sample plan'}</strong>
            <span>{canEditSamplePlan ? 'Admin can save, close, revert, reset, and switch timeline for the sample plan.' : 'Sample plan is read only for non-admin users.'}</span>
          </div>
          <button type="button" className="toolbar-button" onClick={handleReturnToMyPlan}>
            Go Back To My Plan
          </button>
        </section>
      ) : null}

      {!isTrackersRoute && isViewingPreviousCycle ? (
        <section className="sample-banner previous-cycle-banner" aria-label="Previous cycle mode" style={creditWidthCapStyle}>
          <div>
            <strong>Viewing previous cycle</strong>
            <span>This archived cycle is read only. Switch back to the current cycle to edit or save changes.</span>
          </div>
        </section>
      ) : null}

      {isTrackersRoute ? (
        <section className="sample-banner shared-view-banner" aria-label="Shared tracker mode" style={creditWidthCapStyle}>
          <div>
            <strong>
              {selectedSharedViewerUser
                ? `Viewing ${formatViewerUserLabel(selectedSharedViewerUser)}`
                : hasSharedViewerUsers
                  ? 'Viewing another user tracker'
                  : 'No other trackers available'}
            </strong>
            {authenticatedUser?.admin && selectedSharedViewerUser?.lastUpdatedAt ? (
              <span className="shared-view-last-updated">
                Last updated: {formatLocalDateTime(selectedSharedViewerUser.lastUpdatedAt)}
              </span>
            ) : null}
            <span>
              {hasSharedViewerUsers
                ? 'Selected tracker is read only. Only the currently selected tracker data is loaded in the browser.'
                : 'No additional tracker records are available for this account yet.'}
            </span>
          </div>
          <div className="shared-view-banner-actions">
            <label className="shared-view-select-wrap">
              <span>User</span>
              <select
                className="shared-view-select"
                value={selectedSharedViewerUserSub}
                onChange={(event) => void handleSharedViewerSelectionChange(event.target.value)}
                disabled={!hasSharedViewerUsers || saveState === 'loading' || saveState === 'saving'}
              >
                {hasSharedViewerUsers ? (
                  sharedViewerUsers.map((user) => (
                    <option key={user.userSub} value={user.userSub}>
                      {formatEncryptedViewerUserLabel(user)}
                    </option>
                  ))
                ) : (
                  <option value="">No other trackers available</option>
                )}
              </select>
            </label>
            <button type="button" className="toolbar-button" onClick={handleReturnToMyPlan}>
              Back to My Plan
            </button>
            {authenticatedUser?.admin && selectedSharedViewerUserSub ? (
              <button
                type="button"
                className="toolbar-button destructive-button"
                onClick={() => setAdminDeleteConfirmUserSub(selectedSharedViewerUserSub)}
                disabled={isDeletingViewerTracker || saveState === 'loading'}
              >
                Delete Tracker
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      {!isTrackersRoute ? (
        <div className="budget-cycle-toolbar-row" style={creditWidthCapStyle}>
          <span className="toolbar-button-wrap" title={budgetCycleButtonTooltip}>
            <button
              type="button"
              className="toolbar-button budget-cycle-button"
              onClick={handleCloseCycleClick}
              disabled={isPlanReadOnly || saveState === 'loading' || saveState === 'saving' || !canCloseCurrentCycle}
            >
              Close Cycle
            </button>
          </span>
          <button
            type="button"
            className="toolbar-button"
            onClick={handleRevertCycleClick}
            disabled={isTrackersRoute || !canRevertClosedCycle || saveState === 'loading' || saveState === 'saving'}
          >
            Revert Cycle
          </button>
          <label className="budget-cycle-select-wrap">
            <span>Cycle</span>
            <select
              className="budget-cycle-select"
              value={selectedCycle}
              onChange={(event) => void handleCycleSelectionChange(event.target.value as CycleSelection)}
              disabled={saveState === 'loading' || saveState === 'saving'}
            >
              <option value="current">{formatCycleRangeLabel(currentCyclePeriod)}</option>
              {previousCyclePeriod ? <option value="previous">{formatCycleRangeLabel(previousCyclePeriod)}</option> : null}
            </select>
          </label>
        </div>
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
          <div className="budget-cycle-simple-track" aria-hidden="true">
            <div className="budget-cycle-simple-line" />
            {!leftTimelineSlot.hidden ? <div className={joinClassNames('budget-cycle-simple-marker', 'budget-cycle-simple-marker-1', leftTimelineSlot.toneClass)} /> : null}
            {!middleTimelineSlot.hidden ? <div className={joinClassNames('budget-cycle-simple-marker', 'budget-cycle-simple-marker-2', middleTimelineSlot.toneClass)} style={middleTimelineInlineStyle} /> : null}
            {!rightTimelineSlot.hidden ? <div className={joinClassNames('budget-cycle-simple-marker', 'budget-cycle-simple-marker-3', rightTimelineSlot.toneClass)} /> : null}
          </div>

          <div className="budget-cycle-simple-labels">
            <div className={joinClassNames('budget-cycle-simple-label', 'budget-cycle-simple-label-1', leftTimelineSlot.toneClass, leftTimelineSlot.hidden ? 'budget-cycle-slot-hidden' : undefined)}>
              {leftTimelineSlot.label}
            </div>
            <div className={joinClassNames('budget-cycle-simple-label', 'budget-cycle-simple-label-2', middleTimelineSlot.toneClass, middleTimelineSlot.hidden ? 'budget-cycle-slot-hidden' : undefined)} style={middleTimelineInlineStyle}>
              {middleTimelineSlot.label}
            </div>
            <div className={joinClassNames('budget-cycle-simple-label', 'budget-cycle-simple-label-3', rightTimelineSlot.toneClass, rightTimelineSlot.hidden ? 'budget-cycle-slot-hidden' : undefined)}>
              {rightTimelineSlot.label}
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p className="eyebrow help-eyebrow">Help</p>
                <h2 id="help-title">How This Financial Tracker Works</h2>
              </div>
              <button type="button" className="toolbar-button" onClick={handleHelpClose} aria-label="Close help" style={{ flexShrink: 0 }}>&times;</button>
            </div>
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
                    <div className="help-mock-toolbar help-mock-toolbar-tight">
                      <span className="help-mock-chip">Current Cycle</span>
                      <span className="help-mock-chip help-mock-chip-muted">Mid to Mid</span>
                      <span className="help-mock-button">Save Changes</span>
                      <span className="help-mock-button help-mock-button-muted">Reset</span>
                      <span className="help-mock-button help-mock-button-accent">Sample Tracker</span>
                    </div>
                    <div className="help-mock-banner-row">
                      <div className="help-mock-banner">Viewing sample plan</div>
                      <div className="help-mock-menu-dot" />
                    </div>
                    <div className="help-mock-progress">
                      <span>62% through cycle</span>
                      <span>11 days left</span>
                    </div>
                    <div className="help-mock-timeline">
                      <span className="help-mock-timeline-point" />
                      <span className="help-mock-timeline-line" />
                      <span className="help-mock-timeline-point help-mock-timeline-point-active" />
                      <span className="help-mock-timeline-line" />
                      <span className="help-mock-timeline-point" />
                    </div>
                  </div>
                  <h4>Top Toolbar</h4>
                  <p>Use this area to save, reset local edits, enter sample mode, switch timeline type, close the current cycle, or switch between current and previous cycles.</p>
                </article>

                <article className="help-visual-card">
                  <div className="help-visual-frame" aria-hidden="true">
                    <div className="help-mock-table">
                      <div className="help-mock-table-header">
                        <span>Bank</span>
                        <span>Due</span>
                        <span>State</span>
                      </div>
                      <div className="help-mock-table-row">
                        <span>Chase Freedom</span>
                        <span>$320</span>
                        <span className="help-mock-status-row">
                          <span className="help-mock-check help-mock-check-on" />
                          <span className="help-mock-pill">Paid</span>
                        </span>
                      </div>
                      <div className="help-mock-table-row">
                        <span>Amex Gold</span>
                        <span>$145</span>
                        <span className="help-mock-status-row">
                          <span className="help-mock-check" />
                          <span className="help-mock-pill help-mock-pill-warn">Cycled</span>
                        </span>
                      </div>
                      <div className="help-mock-table-total">
                        <span>Credit Card Totals</span>
                        <span>$465</span>
                        <span>Exposure</span>
                      </div>
                    </div>
                    <div className="help-mock-kpi-strip">
                      <span className="help-mock-kpi-box">Overdue Cards 1</span>
                      <span className="help-mock-kpi-box">Next Cycle $2,320</span>
                    </div>
                  </div>
                  <h4>Credit Card Accounts</h4>
                  <p>Track balances, due dates, and statement-cycle state. Totals at the bottom summarize overall exposure.</p>
                </article>

                <article className="help-visual-card">
                  <div className="help-visual-frame" aria-hidden="true">
                    <div className="help-mock-subsection-tabs">
                      <span className="help-mock-subsection-tab help-mock-subsection-tab-active">Plano</span>
                      <span className="help-mock-subsection-tab">Sanford</span>
                      <span className="help-mock-subsection-tab">Other</span>
                    </div>
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
                    <div className="help-mock-action-row">
                      <span className="help-mock-check help-mock-check-on" />
                      <span className="help-mock-button help-mock-button-danger">Delete</span>
                    </div>
                    <div className="help-mock-split-bars">
                      <span className="help-mock-bar help-mock-bar-current"></span>
                      <span className="help-mock-bar help-mock-bar-next"></span>
                    </div>
                  </div>
                  <h4>Debit Card Expenses</h4>
                  <p>Current is the amount due this month. Once paid, update it to 0. Next is the amount due next month.</p>
                </article>

                <article className="help-visual-card">
                  <div className="help-visual-frame" aria-hidden="true">
                    <div className="help-mock-bank-header">
                      <span className="help-mock-bank-title">Bank Accounts</span>
                      <span className="help-mock-bank-total">$5,890</span>
                    </div>
                    <div className="help-mock-bank-grid">
                      <div className="help-mock-bank-card">
                        <strong>Chase</strong>
                        <span>$6,420</span>
                        <small>Salary arrived</small>
                      </div>
                      <div className="help-mock-bank-card">
                        <strong>PNC</strong>
                        <span>$1,120</span>
                        <small>Mid-month pending</small>
                      </div>
                    </div>
                    <div className="help-mock-line-chart">
                      <div className="help-mock-line-chart-grid" />
                      <span className="help-mock-line help-mock-line-primary" />
                      <span className="help-mock-line help-mock-line-secondary" />
                      <span className="help-mock-line help-mock-line-tertiary" />
                    </div>
                  </div>
                  <h4>Bank Accounts &amp; Balance Movement</h4>
                  <p>Track balances and income timing for each bank. The section header shows the total Month End Bank Balance across all banks. The multi-line chart shows how each bank balance changes after additional payments and additional income.</p>
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
                <li>Customizable bank subsections with salary arrival timing so you can see which accounts have available funds at different points in the month.</li>
                <li>Expense categories determined by text before the hyphen in expense labels, so you can track spending by category in the charts.</li>
              </ul>
            </div>

            <div className="help-section">
              <h3>How To Read The Main Sections</h3>
              <ul className="help-list">
                <li>Credit Card Accounts shows what is still owed, what is already paid, and what may roll into the next statement cycle.</li>
                <li>Debit Card Expenses separates expected spending into Current Month and Next Month so you can see near-term cash needs clearly. Expenses can be organized into separate collections. You can delete specific expense rows using the checkbox and delete button below each table.</li>
                <li>Bank Accounts lets you track balances and salary inflows for each bank subsection so projections reflect how cash is actually distributed. The section header displays the total Month End Bank Balance across all banks. Bank subsections are fully customizable: you can add new banks, delete existing ones, rename them, and mark when salary arrives for each.</li>
                <li>Top KPI tiles summarize savings, overdue items, and projected exposure so you can quickly spot risk areas.</li>
                <li>Each bank income subsection tracks bi-monthly salary arrivals, checking balance, additional payments, and additional income. Mark when each salary arrival has occurred so projections stay accurate.</li>
                <li>The cycle progress bar shows what percentage of the current cycle has elapsed and how many days remain. For previous cycles it shows &quot;Archived cycle &bull; read only&quot; and for upcoming cycles it shows the start date.</li>
              </ul>
            </div>

            <div className="help-section">
              <h3>What The Key Metrics Mean</h3>
              <ul className="help-list">
                <li>Savings Next Cycle shows the projected amount left after next month expenses are covered from the combined bi-monthly salary funding across the default bank and other banks. When savings are positive the pie chart shows your savings vs. next month expenses. When negative (shortfall) the chart shows the funding amount vs. the shortfall amount.</li>
                <li>Current Cycle Exposure shows current month credit card payments, current month debit card expenses, and additional payments from the default bank. When exposure exceeds your total credit limit the metric turns red to highlight the risk.</li>
                <li>Next Cycle Exposure shows projected next statement balances plus next month debit card expenses.</li>
                <li>Cycle After Next Cycle Exposure shows projected carry-forward pressure beyond next month.</li>
                <li>Overdue Cards and Overdue Expenses show how many items are already past due based on the dates in the tracker. Any payment date or expense due date in the past with the item still unmarked as paid counts as overdue.</li>
              </ul>
            </div>

            <div className="help-section">
              <h3>How The Charts Should Be Interpreted</h3>
              <ul className="help-list">
                <li>Savings Next Cycle compares expected next month expense load against projected leftover savings or shortfall. The chart switches between a savings view and a shortfall view depending on whether the projection is positive or negative.</li>
                <li>Total Due by Card uses a stacked bar chart where each card&apos;s Payment Due this month is shown in one color and Next Statement Balance is shown in another, sorted by total due descending.</li>
                <li>Payment Due Timeline shows when payment pressure is arriving by due date. Only accounts where payment due or next balance is greater than zero appear in this chart.</li>
                <li>Debit Card Expense Category groups debit expenses by the text before ` - ` in each expense label. There are two separate pie charts: one for current month expenses and one for next month expenses.</li>
                <li>If an expense label does not include a prefix before ` - `, it is grouped under Other.</li>
                <li>Change in Bank Balance is a history chart where each line represents one bank. It compares Month End Balance minus Dues across recent cycles, using the history window selected above the chart.</li>
              </ul>
            </div>

            <div className="help-section">
              <h3>Customization</h3>
              <ul className="help-list">
                <li>You can rename the main section headers (Credit Card Accounts, Debit Card Expenses, Bank Accounts) by clicking on them. Custom names persist across saves.</li>
                <li>Income item labels and balance item labels are editable so you can use your own names for salary sources and balance line items.</li>
                <li>Bank subsections support adding or removing custom bank accounts. When you add banks, choose how many subsections you want. When you delete banks, select them via checkbox and click the delete button.</li>
                <li>For each bank subsection, mark whether your bi-monthly salary has arrived mid-month and/or month-end. This helps the app calculate which accounts will have available funds at different times.</li>
              </ul>
            </div>

            <div className="help-section">
              <h3>Important Workflow Actions</h3>
              <ul className="help-list">
                <li>Save Changes writes your current tracker data for your signed-in account and makes that version your new saved baseline.</li>
                <li>Reset discards unsaved local edits in the current cycle and restores the tracker to the last loaded or saved version after you confirm the warning.</li>
                <li>Sample Tracker opens a temporary sample plan view. Changes there stay only in the current browser session and are not written to your saved plan.</li>
                <li>Go Back To My Plan leaves sample mode and reloads your personal tracker.</li>
                <li>Switch to Start to End or Mid to Mid changes your tracker timeline type, deletes previous cycle history, and removes anything you could revert to from the old timeline. Start to End runs from the first day to the last day of the month. Mid to Mid runs from mid-month to mid-month.</li>
                <li>Close Cycle archives the current cycle as previous, replaces any existing previous cycle, and applies rollover rules: all credit card paid flags reset to unchecked, all statement cycled flags reset to unchecked, and all next-month debit expenses move into the current month.</li>
                <li>Revert Cycle undoes the most recent close-cycle action while it is still available in the current browser session. Do not confuse it with Reset, which discards unsaved edits but does not undo a cycle close.</li>
                <li>When switching to sample mode or switching cycles with unsaved changes, a confirmation dialog asks whether to discard changes, save first, or cancel.</li>
                <li>Viewing the previous cycle puts the tracker in read-only mode. All editing, save, reset, close cycle, and timeline switching are disabled. Switch back to the current cycle to make edits.</li>
                <li>Close Cycle is only enabled when all credit cards are marked paid, all statements are marked statement cycled, and all debit card current month expenses are 0.</li>
                <li>Delete My Tracker removes only your saved tracker data and then starts you fresh with a new seeded tracker.</li>
              </ul>
            </div>

            <div className="help-section">
              <h3>Business Rules To Keep In Mind</h3>
              <ul className="help-list">
                <li>Your data is tied to your signed-in Google account, so each user works with their own saved tracker.</li>
                <li>Unsaved edits are only local until you use Save Changes.</li>
                <li>Projections are only as accurate as the payment dates, balances, and current versus next month assignments you maintain.</li>
                <li>Debit expense labels affect chart grouping, so consistent label prefixes make the category chart more useful. Categories are extracted from text before the hyphen in each expense label (e.g. &quot;Rent - Plano&quot; creates a &quot;Rent&quot; category).</li>
                <li>Reset only affects your current unsaved edits. Revert Cycle undoes the last close-cycle transition. Delete My Tracker affects your saved personal data.</li>
                <li>Deleting your tracker does not delete other users&apos; data. It only resets your own saved plan.</li>
                <li>Dates in Credit Card Accounts and Debit Card Expenses that fall outside the current cycle start and end dates will blink red and show a hover tooltip saying Date outside of cycle.</li>
                <li>In Credit Card Accounts, if payment made and statement cycled are both checked and the payment date is after the cycle end date, the payment date will not blink. If statement cycled is not checked and the statement date is before the cycle start date, the statement date will not blink.</li>
                <li>Tables in Credit Card Accounts and Debit Card Expenses only sort when you click a column header sort icon. They do not re-sort automatically when you edit values. Credit cards default to sorting by bank name and expenses default to sorting by pay date. Sorting resets when you close a cycle or reload data.</li>
                <li>The footer displays the build version and when the current cycle was last saved. If no cycle has been saved yet, it shows the current date and time in your local time zone.</li>
                <li>In Credit Card Accounts, the next month balance calculation depends on the paid and statement cycled flags. If the statement has not cycled, next month balance equals the current statement balance. If the statement has cycled but the card is not paid, next month balance equals statement balance minus payment due. If both are checked, next month balance is zero.</li>
                <li>Sample Tracker changes are stored only in your current browser session. Reloading the page or switching back to your personal tracker clears all sample data.</li>
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

      {isCycleSwitchDialogOpen ? (
        <div className="modal-backdrop" role="presentation">
          <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="cycle-switch-title">
            <p className="eyebrow help-eyebrow">Unsaved Changes</p>
            <h2 id="cycle-switch-title">Switch Cycles?</h2>
            <p className="help-intro">
              You have unsaved changes in the current cycle. You can save first, or switch cycles and discard those unsaved edits.
            </p>
            <div className="modal-actions">
              <button type="button" className="toolbar-button" onClick={handleCycleSwitchCancel} disabled={saveState === 'saving'}>
                Cancel
              </button>
              <button type="button" className="toolbar-button" onClick={handleCycleSwitchProceed} disabled={saveState === 'saving'}>
                Discard And Switch
              </button>
              <button type="button" className="toolbar-button" onClick={handleCycleSwitchSaveAndProceed} disabled={saveState === 'saving'}>
                {saveState === 'saving' ? 'Saving...' : 'Save And Switch'}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {isTimelineSwitchDialogOpen && pendingTimelineTypeSwitch ? (
        <div className="modal-backdrop" role="presentation">
          <section className="modal-card danger-modal" role="dialog" aria-modal="true" aria-labelledby="timeline-switch-title">
            <p className="eyebrow danger-eyebrow">Switch Timeline</p>
            <h2 id="timeline-switch-title">Switch to {formatTimelineTypeLabel(pendingTimelineTypeSwitch)}?</h2>
            <p className="danger-copy">
              This will reset cycle history for your tracker. Previous cycle will be deleted, and there will be nothing to revert to after the switch.
            </p>
            <p className="danger-copy-subtle">
              Your current tracker data will be kept, but the active cycle will change to {formatCycleRangeLabel(buildCurrentCycleForTimeline(new Date(), pendingTimelineTypeSwitch))}. You may need to update entries that no longer belong in the new cycle.
            </p>
            <div className="modal-actions">
              <button type="button" className="toolbar-button" onClick={handleTimelineSwitchCancel} disabled={saveState === 'saving'}>
                Cancel
              </button>
              <button type="button" className="toolbar-button destructive-button" onClick={handleTimelineSwitchConfirm} disabled={saveState === 'saving'}>
                {saveState === 'saving' ? 'Switching...' : `Switch to ${formatTimelineTypeLabel(pendingTimelineTypeSwitch)}`}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {isCloseCycleDialogOpen ? (
        <div className="modal-backdrop" role="presentation">
          <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="close-cycle-title">
            <p className="eyebrow help-eyebrow">Close Cycle</p>
            <h2 id="close-cycle-title">Close Current Cycle?</h2>
            <p className="help-intro">
              This will archive the current cycle as previous, replace any existing previous cycle, and roll the tracker forward into a new current cycle.
            </p>
            <div className="modal-actions">
              <button type="button" className="toolbar-button" onClick={handleCloseCycleCancel} disabled={saveState === 'saving'}>
                Cancel
              </button>
              <button type="button" className="toolbar-button" onClick={handleCloseCycleConfirm} disabled={saveState === 'saving'}>
                {saveState === 'saving' ? 'Closing...' : 'Close Cycle'}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {isRevertCycleDialogOpen ? (
        <div className="modal-backdrop" role="presentation">
          <section className="modal-card danger-modal" role="alertdialog" aria-modal="true" aria-labelledby="revert-cycle-title">
            <p className="eyebrow danger-eyebrow">Revert Cycle</p>
            <h2 id="revert-cycle-title">Revert To Previous Cycle?</h2>
            <p className="danger-copy">
              This will undo the most recent close-cycle action, restore the archived previous cycle as current, and delete the newly created current cycle.
            </p>
            <p className="danger-copy-subtle">
              Use this only if you want to reverse the cycle rollover itself. Reset is for discarding unsaved edits in the current cycle.
            </p>
            <div className="modal-actions">
              <button type="button" className="toolbar-button" onClick={handleRevertCycleCancel} disabled={saveState === 'loading' || saveState === 'saving'}>
                Cancel
              </button>
              <button
                type="button"
                className="toolbar-button destructive-button"
                onClick={handleRevertCycleConfirm}
                disabled={saveState === 'loading' || saveState === 'saving'}
              >
                {saveState === 'saving' ? 'Reverting...' : 'Revert Cycle'}
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

      {isPinModalOpen ? (
        <div className="modal-backdrop" role="presentation">
          <section
            className={`modal-card pin-modal${pinModalMode === 'reset-confirm' ? ' danger-modal' : ''}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="pin-modal-title"
          >
            {pinModalMode === 'new' ? (
              <>
                <p className="eyebrow">Security</p>
                <h2 id="pin-modal-title">Protect Your Financial Data</h2>
                <p>🔒 <strong>Your financial data is private to you.</strong></p>
                <p>Set a 4-character PIN using letters and numbers to enable end-to-end encryption for your data.</p>
                <p><strong>How it works:</strong> Your PIN generates a unique encryption key using PBKDF2 (100,000 iterations). Your data is then encrypted with AES-256-GCM directly in your browser before it reaches our servers.</p>
                <p><strong>We cannot see your data.</strong> Your PIN never leaves your device and is never stored anywhere.</p>
                <p className="danger-copy-subtle">⚠️ Your PIN cannot be recovered. If forgotten, your data will be permanently deleted.</p>
                <div className="pin-fields">
                  <input
                    type="password"
                    inputMode="text"
                    maxLength={4}
                    placeholder="Enter 4-character PIN"
                    value={pinInput}
                    onChange={(e) => setPinInput(normalizePinValue(e.target.value))}
                    onKeyDown={(e) => { if (e.key === 'Enter') void handlePinSubmit() }}
                    className="pin-input"
                    autoCapitalize="characters"
                    autoCorrect="off"
                    spellCheck={false}
                    autoFocus
                  />
                  <input
                    type="password"
                    inputMode="text"
                    maxLength={4}
                    placeholder="Confirm PIN"
                    value={pinConfirmInput}
                    onChange={(e) => setPinConfirmInput(normalizePinValue(e.target.value))}
                    onKeyDown={(e) => { if (e.key === 'Enter') void handlePinSubmit() }}
                    className="pin-input"
                    autoCapitalize="characters"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                </div>
                <fieldset className="pin-timeline-select">
                  <legend className="pin-timeline-label">Cycle Type</legend>
                  <label className="pin-timeline-option">
                    <input
                      type="radio"
                      name="pin-timeline-type-inline"
                      value="START_TO_END"
                      checked={pinModalTimelineType === 'START_TO_END'}
                      onChange={() => setPinModalTimelineType('START_TO_END')}
                    />
                    <span>Start of Month to End of Month</span>
                  </label>
                  <label className="pin-timeline-option">
                    <input
                      type="radio"
                      name="pin-timeline-type-inline"
                      value="MID_TO_MID"
                      checked={pinModalTimelineType === 'MID_TO_MID'}
                      onChange={() => setPinModalTimelineType('MID_TO_MID')}
                    />
                    <span>Mid Month to Mid Month</span>
                  </label>
                </fieldset>
                {pinModalError ? <p className="auth-message auth-error">{pinModalError}</p> : null}
                <div className="modal-actions">
                  <button type="button" className="toolbar-button link-button" onClick={() => void handleFirstTimeSetupExit()} disabled={pinModalSubmitting || pinModalExiting}>
                    {pinModalExiting ? 'Exiting...' : 'Exit'}
                  </button>
                  <button type="button" className="toolbar-button" onClick={() => void handlePinSubmit()} disabled={pinModalSubmitting || pinModalExiting}>
                    {pinModalSubmitting ? 'Setting up...' : 'Set PIN'}
                  </button>
                </div>
              </>
            ) : pinModalMode === 'verify' ? (
              <>
                <p className="eyebrow">Security</p>
                <h2 id="pin-modal-title">Your Data Is Encrypted</h2>
                {authenticatedUser?.email ? (
                  <p className="pin-modal-user-email">{authenticatedUser.email}</p>
                ) : null}
                <p>🔒 <strong>Your data is end-to-end encrypted.</strong></p>
                <p>Enter your 4-character PIN to decrypt your financial data. Your data is protected with AES-256-GCM — only your PIN can unlock it. We have no way to access it.</p>
                <div className="pin-fields">
                  <input
                    type="password"
                    inputMode="text"
                    maxLength={4}
                    placeholder="Enter your PIN"
                    value={pinInput}
                    onChange={(e) => setPinInput(normalizePinValue(e.target.value))}
                    onKeyDown={(e) => { if (e.key === 'Enter') void handlePinSubmit() }}
                    className="pin-input"
                    autoCapitalize="characters"
                    autoCorrect="off"
                    spellCheck={false}
                    autoFocus
                  />
                </div>
                {pinModalError ? <p className="auth-message auth-error">{pinModalError}</p> : null}
                <div className="modal-actions">
                  <button type="button" className="toolbar-button link-button" onClick={handleForgotPin}>
                    Forgot PIN?
                  </button>
                  <button type="button" className="toolbar-button" onClick={() => void handlePinSubmit()} disabled={pinModalSubmitting}>
                    {pinModalSubmitting ? 'Unlocking...' : 'Unlock'}
                  </button>
                </div>
              </>
            ) : pinModalMode === 'migrate' ? (
              <>
                <p className="eyebrow">Security</p>
                <h2 id="pin-modal-title">One-Time PIN Required</h2>
                <p>Your account has been moved to unencrypted mode. Enter your PIN once to migrate your data to plaintext storage.</p>
                <div className="pin-fields">
                  <input
                    type="password"
                    inputMode="text"
                    maxLength={4}
                    placeholder="Enter your PIN"
                    value={pinInput}
                    onChange={(e) => setPinInput(normalizePinValue(e.target.value))}
                    onKeyDown={(e) => { if (e.key === 'Enter') void handlePinSubmit() }}
                    className="pin-input"
                    autoCapitalize="characters"
                    autoCorrect="off"
                    spellCheck={false}
                    autoFocus
                  />
                </div>
                {pinModalError ? <p className="auth-message auth-error">{pinModalError}</p> : null}
                <div className="modal-actions">
                  <button type="button" className="toolbar-button" onClick={() => void handlePinSubmit()} disabled={pinModalSubmitting}>
                    {pinModalSubmitting ? 'Migrating...' : 'Migrate Data'}
                  </button>
                </div>
              </>
            ) : pinModalMode === 'change' ? (
              <>
                <p className="eyebrow">Security</p>
                <h2 id="pin-modal-title">Change Your PIN</h2>
                <p>Enter your current PIN to verify, then set a new 4-character PIN. Both your current and previous cycles will be re-encrypted with the new PIN.</p>
                <div className="pin-fields">
                  <input
                    type="password"
                    inputMode="text"
                    maxLength={4}
                    placeholder="Current PIN"
                    value={pinCurrentInput}
                    onChange={(e) => setPinCurrentInput(normalizePinValue(e.target.value))}
                    onKeyDown={(e) => { if (e.key === 'Enter') void handlePinSubmit() }}
                    className="pin-input"
                    autoCapitalize="characters"
                    autoCorrect="off"
                    spellCheck={false}
                    autoFocus
                  />
                  <input
                    type="password"
                    inputMode="text"
                    maxLength={4}
                    placeholder="New PIN"
                    value={pinNewInput}
                    onChange={(e) => setPinNewInput(normalizePinValue(e.target.value))}
                    onKeyDown={(e) => { if (e.key === 'Enter') void handlePinSubmit() }}
                    className="pin-input"
                    autoCapitalize="characters"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                  <input
                    type="password"
                    inputMode="text"
                    maxLength={4}
                    placeholder="Confirm New PIN"
                    value={pinNewConfirmInput}
                    onChange={(e) => setPinNewConfirmInput(normalizePinValue(e.target.value))}
                    onKeyDown={(e) => { if (e.key === 'Enter') void handlePinSubmit() }}
                    className="pin-input"
                    autoCapitalize="characters"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                </div>
                {pinModalError ? <p className="auth-message auth-error">{pinModalError}</p> : null}
                <div className="modal-actions">
                  <button type="button" className="toolbar-button" onClick={() => setIsPinModalOpen(false)} disabled={pinModalSubmitting}>
                    Cancel
                  </button>
                  <button type="button" className="toolbar-button" onClick={() => void handlePinSubmit()} disabled={pinModalSubmitting}>
                    {pinModalSubmitting ? 'Changing...' : 'Change PIN'}
                  </button>
                </div>
              </>
            ) : pinModalMode === 'reset-confirm' ? (
              <>
                <p className="eyebrow danger-eyebrow">Danger Zone</p>
                <h2 id="pin-modal-title">Reset Account Data</h2>
                <p className="danger-copy">
                  You forgot your PIN. The only option is to permanently delete all your saved financial data. This cannot be undone.
                </p>
                <p className="danger-copy-subtle">
                  Type <strong>RESET</strong> below to confirm permanent data deletion.
                </p>
                <input
                  type="text"
                  placeholder="Type RESET to confirm"
                  value={resetConfirmText}
                  onChange={(e) => setResetConfirmText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') void handlePinResetConfirm() }}
                  className="pin-input"
                  autoFocus
                />
                {pinModalError ? <p className="auth-message auth-error">{pinModalError}</p> : null}
                <div className="modal-actions">
                  <button
                    type="button"
                    className="toolbar-button"
                    onClick={() => { setPinModalMode('verify'); setPinModalError(''); setPinInput(''); }}
                    disabled={pinModalSubmitting}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    className="toolbar-button destructive-button"
                    onClick={() => void handlePinResetConfirm()}
                    disabled={resetConfirmText !== 'RESET' || pinModalSubmitting}
                  >
                    {pinModalSubmitting ? 'Deleting...' : 'Delete All My Data'}
                  </button>
                </div>
              </>
            ) : null}
          </section>
        </div>
      ) : null}

      {isDeleteDialogOpen ? (
        <div className="modal-backdrop" role="presentation">
          <section className="modal-card danger-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-tracker-title">
            <p className="eyebrow danger-eyebrow">Danger Zone</p>
            <h2 id="delete-tracker-title">{isSampleMode ? 'Delete Sample Tracker?' : 'Delete My Tracker?'}</h2>
            <p className="danger-copy">
              {isSampleMode
                ? 'This will delete the saved sample tracker data for the current timeline from the database. A fresh sample tracker will be created when it is loaded again.'
                : 'This will delete your saved tracker data from the database. You will have to start everything from scratch.'}
            </p>
            <p className="danger-copy-subtle">
              {isSampleMode
                ? 'If you cancel, nothing happens. If you confirm, the current sample tracker will be removed and a fresh sample tracker will be created the next time you load it.'
                : 'If you cancel, nothing happens. If you confirm, your current saved tracker will be removed and a fresh tracker will be created for you.'}
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
                {deleteState === 'deleting' ? 'Deleting...' : isSampleMode ? 'Delete Sample Tracker' : 'Delete My Tracker'}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {adminDeleteConfirmUserSub ? (
        <div className="modal-backdrop" role="presentation">
          <section className="modal-card danger-modal" role="alertdialog" aria-modal="true" aria-labelledby="admin-delete-tracker-title">
            <p className="eyebrow danger-eyebrow">Admin Action</p>
            <h2 id="admin-delete-tracker-title">Delete This Tracker?</h2>
            <p className="danger-copy">
              This will permanently delete all saved tracker data for this user from the database. This cannot be undone.
            </p>
            <p className="danger-copy-subtle">
              User: <strong>{formatViewerUserLabel(sharedViewerUsers.find(u => u.userSub === adminDeleteConfirmUserSub) ?? { userSub: adminDeleteConfirmUserSub, email: null, displayName: null })}</strong>
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="toolbar-button"
                onClick={() => setAdminDeleteConfirmUserSub(null)}
                disabled={isDeletingViewerTracker}
              >
                Cancel
              </button>
              <button
                type="button"
                className="toolbar-button destructive-button"
                onClick={() => void handleAdminDeleteViewerTracker(adminDeleteConfirmUserSub)}
                disabled={isDeletingViewerTracker}
              >
                {isDeletingViewerTracker ? 'Deleting...' : 'Delete Tracker'}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      <div className="section-cluster chart-grid credit-chart-grid" style={creditWidthCapStyle}>
        <article className="chart-card">
          <div className="chart-card-header">
            <h3 className="chart-title-no-wrap">Savings/Expenses Next Cycle</h3>
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
                    isAnimationActive={false}
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
            <h3>Total Due by Credit Card</h3>
            <span>Highest total due cards shown first</span>
          </div>
          <div className="chart-shell" style={{ height: `${totalDueByCardChartHeight}px` }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={creditTotalDueData} layout="vertical" margin={{ top: 4, right: 12, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} horizontal={false} />
                <XAxis type="number" tickFormatter={(value) => chartCurrency(Number(value))} stroke={CHART_COLORS.text} fontSize={11} />
                <YAxis
                  type="category"
                  dataKey="fullName"
                  width={128}
                  interval={0}
                  minTickGap={0}
                  stroke={CHART_COLORS.text}
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tick={renderCreditTotalDueYAxisTick}
                />
                <Tooltip formatter={(value: number) => currency(value)} labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName ?? ''} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="paymentDue" name="Payment Due" stackId="totalDue" fill={CHART_COLORS.current} radius={[0, 0, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="nextStmtBalance" name="Next Stmt Balance" stackId="totalDue" fill={CHART_COLORS.deferred} radius={[0, 6, 6, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
        <article className="chart-card">
          <div className="chart-card-header">
            <h3 className="chart-title-no-wrap">Credit Card Payment Due Timeline</h3>
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
                <Bar dataKey="paymentDue" name="Payment Due" fill={CHART_COLORS.current} radius={[6, 6, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="nextBalance" name="Next Stmt" fill={CHART_COLORS.next} radius={[6, 6, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
      </div>

      <section
        className="credit-accounts-section section-cluster"
        ref={creditTableWrapperRef}
        style={creditSectionStyle}
      >
        <fieldset className="section-readonly-fieldset" disabled={isPlanReadOnly}>
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
              <button
                type="button"
                className="credit-view-toggle-button-primary"
                data-view-mode={creditViewMode}
                data-credit-view-toggle="true"
                onClick={handleCreditViewModeToggle}
                aria-label={creditViewMode === 'table' ? 'Switch to tab view' : 'Switch to table view'}
                title={creditViewMode === 'table' ? 'Switch to Tab View' : 'Switch to Table View'}
              >
                <span className="view-toggle-track" aria-hidden="true">
                  <span className="view-toggle-thumb" />
                </span>
                <span className="view-toggle-label">{creditViewMode === 'table' ? 'Tab' : 'Table'}</span>
              </button>
              {selectedCreditIds.size > 0 && (
                <button type="button" className="delete-row-button" onClick={deleteSelectedCredits}>Delete ({selectedCreditIds.size})</button>
              )}
              <button type="button" className="add-row-button" onClick={addCreditAccount}>+ Add</button>
            </div>
          </div>
          {creditViewMode === 'table' ? (
            renderCreditAccountsTable('table-wrapper compact-credit-table')
          ) : (
            <div className="credit-tab-shell">
              <div className="credit-tab-strip" role="tablist" aria-label="Credit card account tabs">
                {displayedCreditAccounts.map((account) => {
                  const { currentMonthPayment } = getCreditMetrics(account)
                  const isPastDueUnpaid = isPastDate(account.nextPaymentDate) && !account.paidThisMonth
                  const isActive = activeDisplayedCreditAccount?.id === account.id

                  return (
                    <button
                      key={account.id}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      aria-controls={`credit-account-panel-${account.id}`}
                      id={`credit-account-tab-${account.id}`}
                      className={joinClassNames(
                        'credit-tab',
                        isActive ? 'credit-tab-active' : undefined,
                        selectedCreditIds.has(account.id) ? 'credit-tab-selected' : undefined,
                        isPastDueUnpaid ? 'credit-tab-alert' : undefined,
                      )}
                      onClick={() => setExpandedCreditAccountId(account.id)}
                    >
                      <span className="credit-tab-title">{account.name || 'Untitled account'}</span>
                      <span className="credit-tab-summary">Payment - {formatShortDate(account.nextPaymentDate)}, {currency(currentMonthPayment)}</span>
                    </button>
                  )
                })}
              </div>

              {activeDisplayedCreditAccount ? (() => {
                const account = activeDisplayedCreditAccount
                const { totalDueForCard, currentMonthPayment, nextMonthStatementBalance, displayedLastStatementBalance, utilizationPercent } = getCreditMetrics(account)
                const isPastDueUnpaid = isPastDate(account.nextPaymentDate) && !account.paidThisMonth
                const isNextPaymentOutsideCycle = shouldHighlightPaymentDate(account, activeCyclePeriod)

                return (
                  <article
                    id={`credit-account-panel-${account.id}`}
                    role="tabpanel"
                    aria-labelledby={`credit-account-tab-${account.id}`}
                    className={joinClassNames(
                      'credit-account-card',
                      'credit-account-card-expanded',
                      selectedCreditIds.has(account.id) ? 'credit-account-card-selected' : undefined,
                      isPastDueUnpaid ? 'credit-account-card-alert' : undefined,
                    )}
                  >
                    <div className="credit-account-card-topbar">
                      <input
                        type="text"
                        value={account.name}
                        onChange={(e) => updateAccountById(account.id, 'name', e.target.value)}
                        className="label-input credit-account-card-name"
                      />
                      <div className="credit-account-card-title-row">
                        <label className="credit-account-select">
                          <input type="checkbox" checked={selectedCreditIds.has(account.id)} onChange={() => toggleCreditSelection(account.id)} />
                          <span>Select</span>
                        </label>
                        <div className="credit-account-badges">
                          {isPastDueUnpaid ? (
                            <span className="credit-account-badge credit-account-badge-danger">Past due</span>
                          ) : null}
                          {isNextPaymentOutsideCycle ? (
                            <span className="credit-account-badge credit-account-badge-danger" title="Date outside of cycle">Outside cycle</span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="credit-account-card-body credit-account-card-body-static">
                      <div className="credit-account-metric-grid">
                        <div className="credit-account-metric">
                          <span>Total Due</span>
                          <strong>{currency(totalDueForCard)}</strong>
                        </div>
                        <div className="credit-account-metric">
                          <span>Curr Payment</span>
                          <strong>{currency(currentMonthPayment)}</strong>
                        </div>
                        <div className="credit-account-metric">
                          <span>Next Balance</span>
                          <strong>{currency(nextMonthStatementBalance)}</strong>
                        </div>
                        <div className="credit-account-metric">
                          <span>Util %</span>
                          <strong>{utilizationPercent.toFixed(1)}%</strong>
                        </div>
                      </div>

                      <div className="credit-account-fields">
                        <label className="credit-account-field">
                          <span>{columnLabels.creditAccounts[1]?.label ?? 'Available Credit'}</span>
                          <CurrencyInput
                            value={account.availableCredit}
                            onValueChange={(value) => updateAccountById(account.id, 'availableCredit', value)}
                          />
                        </label>
                        <label className="credit-account-field">
                          <span>{columnLabels.creditAccounts[2]?.label ?? 'Current Payment Stmt Date'}</span>
                          <input
                            type="date"
                            value={account.lastStatementDate}
                            onChange={(e) => updateAccountById(account.id, 'lastStatementDate', e.target.value)}
                          />
                        </label>
                        <label className="credit-account-field">
                          <span>{columnLabels.creditAccounts[3]?.label ?? 'Payment Date'}</span>
                          <input
                            type="date"
                            value={account.nextPaymentDate}
                            onChange={(e) => updateAccountById(account.id, 'nextPaymentDate', e.target.value)}
                            className={joinClassNames(isNextPaymentOutsideCycle ? 'cycle-outside-date' : undefined)}
                            title={isNextPaymentOutsideCycle ? 'Date outside of cycle' : undefined}
                          />
                        </label>
                        <label className="credit-account-field">
                          <span>{columnLabels.creditAccounts[6]?.label ?? 'Latest Stmt Balance'}</span>
                          <CurrencyInput
                            value={displayedLastStatementBalance}
                            onValueChange={(value) => updateAccountById(account.id, 'lastStatementBalance', value)}
                          />
                        </label>
                        <label className="credit-account-field">
                          <span>{columnLabels.creditAccounts[7]?.label ?? 'Credit Limit'}</span>
                          <CurrencyInput
                            value={account.creditLimit}
                            onValueChange={(value) => updateAccountById(account.id, 'creditLimit', value)}
                          />
                        </label>
                      </div>

                      <div className="credit-account-toggle-row">
                        <label className={joinClassNames('credit-account-toggle', isPastDueUnpaid ? 'credit-account-toggle-alert' : undefined)}>
                          <span>{columnLabels.creditAccounts[4]?.label ?? 'Paid'}</span>
                          <input
                            type="checkbox"
                            checked={account.paidThisMonth}
                            onChange={(e) => updateAccountById(account.id, 'paidThisMonth', e.target.checked)}
                            className={isPastDueUnpaid ? 'overdue-checkbox' : undefined}
                          />
                        </label>
                        <label className="credit-account-toggle">
                          <span>{columnLabels.creditAccounts[5]?.label ?? 'Current Cycle Stmt Cycled?'}</span>
                          <input
                            type="checkbox"
                            checked={account.statementCycledAfterPayment}
                            onChange={(e) => updateAccountById(account.id, 'statementCycledAfterPayment', e.target.checked)}
                          />
                        </label>
                      </div>
                    </div>
                  </article>
                )
              })() : null}
              {renderCreditAccountsTable('table-wrapper compact-credit-table-measurement')}
            </div>
          )}
        </div>
        </fieldset>
      </section>

      <div className="section-cluster finance-overview-row expense-overview-row" style={creditWidthCapStyle}>
        <section className="expense-section compact-section">
          <fieldset className="section-readonly-fieldset" disabled={isPlanReadOnly}>
          <div className="section-header">
            <h2>
              <input
                type="text"
                value={sectionTitles.debitExpenses}
                readOnly
                aria-readonly="true"
                className="label-input section-title-input"
              />
            </h2>
            <div className="section-header-actions">
              <button
                type="button"
                className="credit-view-toggle-button-primary"
                data-view-mode={expenseViewMode}
                onClick={handleExpenseViewModeToggle}
                aria-label={expenseViewMode === 'table' ? 'Switch to tab view' : 'Switch to table view'}
                title={expenseViewMode === 'table' ? 'Switch to Tab View' : 'Switch to Table View'}
              >
                <span className="view-toggle-track" aria-hidden="true">
                  <span className="view-toggle-thumb" />
                </span>
                <span className="view-toggle-label">{expenseViewMode === 'table' ? 'Tab' : 'Table'}</span>
              </button>
              {selectedExpenseIds.size > 0 && (
                <button type="button" className="delete-row-button" onClick={deleteSelectedExpenses}>Delete ({selectedExpenseIds.size})</button>
              )}
              <button type="button" className="add-row-button" onClick={() => addExpenseRow(setOtherExpenses, otherExpenses, 'other')}>+ Add</button>
            </div>
          </div>
          {expenseViewMode === 'table' ? (
          <div
            className="table-wrapper compact-expense-table"
            style={creditWidthMaxStyle}
          >
            <table className="debit-expenses-table">
              <thead>
                <tr>
                  <th className="select-col"></th>
                  {columnLabels.debitExpenses.map((column) => {
                    const sortKey = getExpenseColumnSortKey(column.id)

                    return (
                    <th key={column.id}>
                      <div className="sortable-header">
                        <span
                          className="table-header-label"
                          aria-label={column.label}
                          title={getDebitColumnHeaderTooltip(column.id)}
                        >
                          {formatDebitTableHeaderLabel(column.label).map((line, lineIndex) => (
                            <span key={`${column.id}-line-${lineIndex}`} className="table-header-label-line">
                              {line}
                            </span>
                          ))}
                        </span>
                        {sortKey != null ? (
                          <button
                            type="button"
                            className="sort-button"
                            onClick={() => toggleExpenseSort(sortKey)}
                            aria-label={`Sort debit expenses by ${column.label}`}
                          >
                            {getSortIndicator(expenseSort, sortKey)}
                          </button>
                        ) : null}
                      </div>
                    </th>
                  )})}
                </tr>
              </thead>
              <tbody>
                    {displayedExpenseRows.map(({ item, setter }) => {
                      const isPastDueCurrentExpense = isPastDate(item.payDate) && Math.abs(item.current) > 0.004
                      const isExpenseDateOutsideCycle = isDateOutsideCyclePeriod(item.payDate, activeCyclePeriod)

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
                            className={joinClassNames(isExpenseDateOutsideCycle ? 'cycle-outside-date' : undefined)}
                            title={isExpenseDateOutsideCycle ? 'Date outside of cycle' : undefined}
                          />
                        </td>
                        <td>
                          <select
                            value={normalizeExpensePayFromBankId(item.payFromBankId, validExpensePayFromBankIds)}
                            onChange={(e) => updateExpenseItemById(setter, item.id, 'payFromBankId', e.target.value)}
                          >
                            {expensePayFromOptions.map((option) => (
                              <option key={option.id} value={option.id}>
                                {option.label}
                              </option>
                            ))}
                          </select>
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
                  <td></td>
                  <td>{currency(debitCardExpensesTotalCurrent)}</td>
                  <td>{currency(debitCardExpensesTotalNext)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          ) : (
            <div className="expense-tab-shell">
              <div className="expense-tab-strip" role="tablist" aria-label="Debit expense tabs">
                {displayedExpenseRows.map(({ item }) => {
                  const isPastDueCurrentExpense = isPastDate(item.payDate) && Math.abs(item.current) > 0.004
                  const isExpenseDateOutsideCycle = isDateOutsideCyclePeriod(item.payDate, activeCyclePeriod)
                  const isActive = activeDisplayedExpenseRow?.item.id === item.id

                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      aria-controls={`expense-row-panel-${item.id}`}
                      id={`expense-row-tab-${item.id}`}
                      className={joinClassNames(
                        'expense-tab',
                        isActive ? 'expense-tab-active' : undefined,
                        selectedExpenseIds.has(item.id) ? 'expense-tab-selected' : undefined,
                        isPastDueCurrentExpense || isExpenseDateOutsideCycle ? 'expense-tab-alert' : undefined,
                      )}
                      onClick={() => setExpandedExpenseRowId(item.id)}
                    >
                      <span className="expense-tab-title">{item.label || 'Untitled expense'}</span>
                      <span className="expense-tab-summary">Payment - {formatShortDate(item.payDate)}, {currency(item.current)}</span>
                    </button>
                  )
                })}
              </div>

              {activeDisplayedExpenseRow ? (() => {
                const { item, setter } = activeDisplayedExpenseRow
                const isPastDueCurrentExpense = isPastDate(item.payDate) && Math.abs(item.current) > 0.004
                const isExpenseDateOutsideCycle = isDateOutsideCyclePeriod(item.payDate, activeCyclePeriod)
                const payFromLabel = getExpensePayFromLabel(normalizeExpensePayFromBankId(item.payFromBankId, validExpensePayFromBankIds))

                return (
                  <article
                    id={`expense-row-panel-${item.id}`}
                    role="tabpanel"
                    aria-labelledby={`expense-row-tab-${item.id}`}
                    className={joinClassNames(
                      'expense-item-card',
                      selectedExpenseIds.has(item.id) ? 'expense-item-card-selected' : undefined,
                      isPastDueCurrentExpense || isExpenseDateOutsideCycle ? 'expense-item-card-alert' : undefined,
                    )}
                  >
                    <div className="expense-item-card-topbar">
                      <input
                        type="text"
                        value={item.label}
                        onChange={(e) => updateExpenseLabelById(setter, item.id, e.target.value)}
                        className="label-input expense-item-card-name"
                      />
                      <div className="expense-item-card-title-row">
                        <label className="expense-item-select">
                          <input type="checkbox" checked={selectedExpenseIds.has(item.id)} onChange={() => toggleExpenseSelection(item.id)} />
                          <span>Select</span>
                        </label>
                        <div className="expense-item-badges">
                          {isPastDueCurrentExpense ? (
                            <span className="expense-item-badge expense-item-badge-danger">Past due</span>
                          ) : null}
                          {isExpenseDateOutsideCycle ? (
                            <span className="expense-item-badge expense-item-badge-danger" title="Date outside of cycle">Outside cycle</span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="expense-item-card-body">
                      <div className="expense-item-fields">
                        <label className="expense-item-field expense-item-field-wide">
                          <span>{columnLabels.debitExpenses[0]?.label ?? 'Expense'}</span>
                          <input
                            type="text"
                            value={item.label}
                            onChange={(e) => updateExpenseLabelById(setter, item.id, e.target.value)}
                          />
                        </label>
                        <label className="expense-item-field">
                          <span>{columnLabels.debitExpenses[1]?.label ?? 'Pay Date'}</span>
                          <input
                            type="date"
                            value={item.payDate}
                            onChange={(e) => updateExpenseItemById(setter, item.id, 'payDate', e.target.value)}
                            className={joinClassNames(isExpenseDateOutsideCycle ? 'cycle-outside-date' : undefined)}
                            title={isExpenseDateOutsideCycle ? 'Date outside of cycle' : undefined}
                          />
                        </label>
                        <label className="expense-item-field">
                          <span>{columnLabels.debitExpenses[2]?.label ?? 'Pay From'}</span>
                          <select
                            value={normalizeExpensePayFromBankId(item.payFromBankId, validExpensePayFromBankIds)}
                            onChange={(e) => updateExpenseItemById(setter, item.id, 'payFromBankId', e.target.value)}
                          >
                            {expensePayFromOptions.map((option) => (
                              <option key={option.id} value={option.id}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="expense-item-field">
                          <span>{columnLabels.debitExpenses[3]?.label ?? 'Current Month'}</span>
                          <CurrencyInput
                            value={item.current}
                            onValueChange={(value) => updateExpenseItemById(setter, item.id, 'current', value)}
                            wrapClassName="expense-currency-input-wrap"
                            inputClassName={joinClassNames('currency-amount-input', isPastDueCurrentExpense ? 'overdue-amount-input' : undefined)}
                          />
                        </label>
                        <label className="expense-item-field">
                          <span>{columnLabels.debitExpenses[4]?.label ?? 'Next Month'}</span>
                          <CurrencyInput
                            value={item.next}
                            onValueChange={(value) => updateExpenseItemById(setter, item.id, 'next', value)}
                            wrapClassName="expense-currency-input-wrap"
                          />
                        </label>
                      </div>
                    </div>
                  </article>
                )
              })() : null}
            </div>
          )}
          </fieldset>
        </section>

        <div className="compact-side-panel expense-analytics-stack">
          <article className="chart-card compact-section expense-category-side-panel">
            <div className="chart-card-header">
              <h3>Debit Card Expense Category</h3>
              <span>Grouped by label prefix with separate current and next month views</span>
            </div>
            <div className="expense-category-comparison-grid">
              <section className="expense-category-panel" aria-label="Current month debit expense categories">
                <div className="expense-category-panel-header">
                  <h4>Current Month Expense</h4>
                </div>
                <div className="chart-shell expense-category-chart-shell" style={{ height: `${overviewChartHeight}px` }}>
                  {hasExpenseCategoryCurrentShareData ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={expenseCategoryCurrentShareData}
                          dataKey="value"
                          nameKey="name"
                          innerRadius="46%"
                          outerRadius="77%"
                          paddingAngle={2}
                          isAnimationActive={false}
                        >
                          {expenseCategoryCurrentShareData.map((entry) => (
                            <Cell key={entry.name} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => currency(value)} />
                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="chart-empty-state">No current month debit expenses</div>
                  )}
                </div>
              </section>

              <section className="expense-category-panel" aria-label="Next month debit expense categories">
                <div className="expense-category-panel-header">
                  <h4>Next Month Expense</h4>
                </div>
                <div className="chart-shell expense-category-chart-shell" style={{ height: `${overviewChartHeight}px` }}>
                  {hasExpenseCategoryNextShareData ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={expenseCategoryNextShareData}
                          dataKey="value"
                          nameKey="name"
                          innerRadius="46%"
                          outerRadius="77%"
                          paddingAngle={2}
                          isAnimationActive={false}
                        >
                          {expenseCategoryNextShareData.map((entry) => (
                            <Cell key={entry.name} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => currency(value)} />
                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="chart-empty-state">No next month debit expenses</div>
                  )}
                </div>
              </section>
            </div>
          </article>

          <article className="chart-card compact-section expense-pay-from-side-panel">
            <div className="chart-card-header">
              <h3>Debit Card Expense Pay From</h3>
              <span>Totals by source for current and next month payments</span>
            </div>
            <div className="chart-shell" style={{ height: `${expensePayFromChartHeight}px` }}>
              {hasExpensePayFromData ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={expensePayFromData} layout="vertical" barCategoryGap="12%" margin={{ top: 2, right: 10, left: 0, bottom: 2 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} horizontal={false} />
                    <XAxis type="number" tickFormatter={(value) => chartCurrency(Number(value))} stroke={CHART_COLORS.text} fontSize={10} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={104}
                      interval={0}
                      tickLine={false}
                      axisLine={false}
                      stroke={CHART_COLORS.text}
                      fontSize={10}
                    />
                    <Tooltip formatter={(value: number) => currency(value)} />
                    <Legend wrapperStyle={{ fontSize: '10px' }} />
                    <Bar dataKey="current" name="Current Month Payment" stackId="payFromTotal" fill={CHART_COLORS.current} radius={[0, 0, 0, 0]} barSize={10} isAnimationActive={false}>
                      <LabelList dataKey="current" content={renderCompactBarValueLabel} />
                    </Bar>
                    <Bar dataKey="next" name="Next Month Payment" stackId="payFromTotal" fill={CHART_COLORS.next} radius={[0, 6, 6, 0]} barSize={10} isAnimationActive={false}>
                      <LabelList dataKey="next" content={renderCompactBarValueLabel} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="chart-empty-state">No pay from expense totals yet</div>
              )}
            </div>
          </article>
        </div>

      </div>

      <div className="section-cluster finance-overview-row" style={creditWidthCapStyle}>

        <section className="compact-section compact-side-panel bank-accounts-section">
          <fieldset className="section-readonly-fieldset" disabled={isPlanReadOnly}>
          <div className="section-content-fit">
            <div className="section-header bank-section-header">
              <h2>
                <input
                  type="text"
                  value={sectionTitles.incomeSchedule}
                  readOnly
                  aria-readonly="true"
                  className="label-input section-title-input"
                  style={{ width: getHeaderInputWidth(sectionTitles.incomeSchedule, 14) }}
                />
              </h2>
              <div style={{ marginLeft: 'auto', marginRight: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 500 }}>Month End Bank Balance</span>
                <span style={{ fontSize: '0.92rem', color: '#0f766e', fontWeight: 700 }}>{currency(totalMonthEndBalanceMinusDues)}</span>
              </div>
              <div className="section-header-actions">
                <button
                  type="button"
                  className="credit-view-toggle-button-primary"
                  data-view-mode={bankViewMode}
                  onClick={handleBankViewModeToggle}
                  aria-label={bankViewMode === 'table' ? 'Switch to tab view' : 'Switch to table view'}
                  title={bankViewMode === 'table' ? 'Switch to Tab View' : 'Switch to Table View'}
                >
                  <span className="view-toggle-track" aria-hidden="true">
                    <span className="view-toggle-thumb" />
                  </span>
                  <span className="view-toggle-label">{bankViewMode === 'table' ? 'Tab' : 'Table'}</span>
                </button>
                {selectedBankSubsectionIds.size > 0 && (
                  <button type="button" className="delete-row-button" onClick={deleteSelectedBankSubsections}>Delete ({selectedBankSubsectionIds.size})</button>
                )}
                <button type="button" className="add-row-button" onClick={addIncomeSubsection}>+ Add</button>
              </div>
            </div>
            {bankViewMode === 'table' ? (
              <div className="income-subsection-grid">
                {renderDefaultBankSubsection()}
                {incomeSubsections.map(renderIncomeSubsection)}
              </div>
            ) : (
              <div className="bank-tab-shell">
                <div className="bank-tab-strip" role="tablist" aria-label="Bank account tabs">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={expandedBankSectionId === DEFAULT_BANK_EXPENSE_SOURCE_ID}
                    aria-controls={`bank-section-panel-${DEFAULT_BANK_EXPENSE_SOURCE_ID}`}
                    id={`bank-section-tab-${DEFAULT_BANK_EXPENSE_SOURCE_ID}`}
                    className={joinClassNames(
                      'bank-tab',
                      expandedBankSectionId === DEFAULT_BANK_EXPENSE_SOURCE_ID ? 'bank-tab-active' : undefined,
                    )}
                    onClick={() => setExpandedBankSectionId(DEFAULT_BANK_EXPENSE_SOURCE_ID)}
                  >
                    <span className="bank-tab-title">{sectionTitles.defaultBank || 'Default Bank'}</span>
                    <span className="bank-tab-summary">Month End - {currency(checkingAccountBalanceMonthEndChase)}</span>
                  </button>
                  {incomeSubsections.map((subsection, index) => {
                    const totalBalance = getIncomeSubsectionTotalBalance(subsection)
                    const monthEndBalance = getBankMonthEndBalance(subsection.id, totalBalance, subsection.additionalIncome)
                    const isActive = expandedBankSectionId === subsection.id

                    return (
                      <button
                        key={subsection.id}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        aria-controls={`bank-section-panel-${subsection.id}`}
                        id={`bank-section-tab-${subsection.id}`}
                        className={joinClassNames(
                          'bank-tab',
                          isActive ? 'bank-tab-active' : undefined,
                          selectedBankSubsectionIds.has(subsection.id) ? 'bank-tab-selected' : undefined,
                        )}
                        onClick={() => setExpandedBankSectionId(subsection.id)}
                      >
                        <span className="bank-tab-title">{subsection.title || `Bank ${index + 1}`}</span>
                        <span className="bank-tab-summary">Month End - {currency(monthEndBalance)}</span>
                      </button>
                    )
                  })}
                </div>

                {expandedBankSectionId === DEFAULT_BANK_EXPENSE_SOURCE_ID ? (
                  <div
                    id={`bank-section-panel-${DEFAULT_BANK_EXPENSE_SOURCE_ID}`}
                    role="tabpanel"
                    aria-labelledby={`bank-section-tab-${DEFAULT_BANK_EXPENSE_SOURCE_ID}`}
                    className="bank-tab-panel"
                  >
                    {renderDefaultBankSubsection()}
                  </div>
                ) : activeDisplayedBankSubsection ? (
                  <div
                    id={`bank-section-panel-${activeDisplayedBankSubsection.id}`}
                    role="tabpanel"
                    aria-labelledby={`bank-section-tab-${activeDisplayedBankSubsection.id}`}
                    className="bank-tab-panel"
                  >
                    {renderIncomeSubsection(
                      activeDisplayedBankSubsection,
                      incomeSubsections.findIndex((subsection) => subsection.id === activeDisplayedBankSubsection.id),
                    )}
                  </div>
                ) : null}
              </div>
            )}
            {otherIncomeItems.length > 0 ? (
              <div className="subsection-block">
                <div className="card-list">
                  {otherIncomeItems.map(renderIncomeCard)}
                </div>
              </div>
            ) : null}
          </div>
          </fieldset>
        </section>

        <article className="chart-card compact-section cashflow-side-panel">
          <div className="chart-card-header">
            <div>
              <h3>Change in Bank Balance</h3>
              <span>Each line tracks Month End Balance minus Dues across recent cycles.</span>
            </div>
          </div>
          <div className="chart-shell chart-shell-bank">
            {bankComparisonSeriesWithTotal.length === 0 || bankBalanceComparisonChartData.length === 0 ? (
              <div className="chart-empty-state">No bank balance history available yet.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={bankBalanceComparisonChartData} margin={{ top: 16, right: 24, bottom: 8, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
                  <XAxis
                    dataKey="cycleLabel"
                    tick={{ fill: CHART_COLORS.text, fontSize: 12, fontWeight: 600 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tickFormatter={(v: number) => chartCurrency(v)}
                    tick={{ fill: CHART_COLORS.muted, fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    width={76}
                  />
                  <Tooltip
                    formatter={(value: number, name: string) => [currency(value), name]}
                    labelFormatter={(_label, payload) => {
                      const firstPoint = payload?.[0]?.payload as BankBalanceHistoryChartRow | undefined
                      const matchingCycle = bankBalanceChartCycles.find((cycle) => getCyclePeriodKey(cycle.cycle) === firstPoint?.cycleKey)
                      return matchingCycle ? formatCycleRangeLabel(matchingCycle.cycle) : ''
                    }}
                    contentStyle={{ borderRadius: 8, border: '1px solid rgba(148,163,184,0.28)', fontSize: 13 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 13, paddingTop: 8 }} />
                  {bankComparisonSeriesWithTotal.map((bank, index) => (
                    <Line
                      key={bank.bankKey}
                      type="linear"
                      dataKey={bank.bankKey}
                      name={bank.bankName}
                      stroke={bank.stroke ?? BANK_COLORS[index % BANK_COLORS.length]}
                      strokeWidth={2.5}
                      strokeDasharray={bank.strokeDasharray}
                      dot={{ r: 5, strokeWidth: 2, fill: '#ffffff', stroke: bank.stroke ?? BANK_COLORS[index % BANK_COLORS.length] }}
                      activeDot={{ r: 7 }}
                      connectNulls={false}
                      isAnimationActive={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </article>

      </div>
    </div>
  )
}
