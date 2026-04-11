export type CreditAccount = {
  id: string
  name: string
  availableCredit: number
  nextPaymentDate: string
  paidThisMonth: boolean
  statementCycledAfterPayment: boolean
  lastStatementDate: string
  lastStatementBalance: number
  creditLimit: number
}

export type IncomeItem = {
  id: string
  label: string
  amount: number
  month: string
  note?: string
}

export type BalanceItem = {
  id: string
  label: string
  amount: number
  month: string
}

export type IncomeSubsection = {
  id: string
  title: string
  biMonthlySalaryLabel: string
  biMonthlySalary: number
  midMonthSalaryLabel: string
  midMonthSalaryArrived: boolean
  monthEndSalaryLabel: string
  monthEndSalaryArrived: boolean
  checkingBalanceLabel: string
  checkingBalance: number
  additionalPaymentsLabel: string
  additionalPayments: number
  totalBalanceLabel: string
  additionalIncomeLabel: string
  additionalIncome: number
  monthEndBalanceLabel: string
}

export type ColumnLabel = {
  id: string
  label: string
}

export type FinancialPlanColumnLabels = {
  creditAccounts: ColumnLabel[]
  debitExpenses: ColumnLabel[]
}

export type FinancialPlanSectionTitles = {
  creditAccounts: string
  debitExpenses: string
  incomeSchedule: string
  defaultBank: string
}

export const defaultIncomeSubsections: IncomeSubsection[] = []

export const creditAccounts: CreditAccount[] = [
  {
    id: 'apple-card',
    name: 'Apple Card (2568)',
    availableCredit: 3959.43,
    nextPaymentDate: '2026-03-31',
    paidThisMonth: true,
    statementCycledAfterPayment: true,
    lastStatementDate: '2026-03-31',
    lastStatementBalance: 30.58,
    creditLimit: 4000,
  },
  {
    id: 'samsclub-store-card',
    name: 'SamsClub Store Card (5873)',
    availableCredit: 11297,
    nextPaymentDate: '2026-03-23',
    paidThisMonth: true,
    statementCycledAfterPayment: true,
    lastStatementDate: '2026-03-31',
    lastStatementBalance: 444.19,
    creditLimit: 12000,
  },
  {
    id: 'american-express',
    name: 'American Express (72022)',
    availableCredit: 8221,
    nextPaymentDate: '2026-03-28',
    paidThisMonth: true,
    statementCycledAfterPayment: false,
    lastStatementDate: '2026-03-08',
    lastStatementBalance: 115.66,
    creditLimit: 8300,
  },
  {
    id: 'amazon-store-card',
    name: 'Amazon Store Card (5108) - amazon.syf.com',
    availableCredit: 2700,
    nextPaymentDate: '2026-04-01',
    paidThisMonth: true,
    statementCycledAfterPayment: false,
    lastStatementDate: '2026-03-06',
    lastStatementBalance: 0,
    creditLimit: 2700,
  },
  {
    id: 'wellsfargo-card',
    name: 'Wellsfargo (4256)',
    availableCredit: 16652,
    nextPaymentDate: '2026-04-02',
    paidThisMonth: true,
    statementCycledAfterPayment: false,
    lastStatementDate: '2026-03-08',
    lastStatementBalance: 1728.18,
    creditLimit: 18000,
  },
  {
    id: 'target-card',
    name: 'Target (0969)',
    availableCredit: 7218,
    nextPaymentDate: '2026-04-03',
    paidThisMonth: true,
    statementCycledAfterPayment: false,
    lastStatementDate: '2026-04-03',
    lastStatementBalance: 709.96,
    creditLimit: 7400,
  },
  {
    id: 'barclays-frontier',
    name: 'Barclays Frontier (5640)',
    availableCredit: 8269.86,
    nextPaymentDate: '2026-04-03',
    paidThisMonth: false,
    statementCycledAfterPayment: false,
    lastStatementDate: '2026-03-06',
    lastStatementBalance: 670.23,
    creditLimit: 10000,
  },
  {
    id: 'fidelity-card',
    name: 'Fidelity (9857)',
    availableCredit: 29723.52,
    nextPaymentDate: '2026-04-06',
    paidThisMonth: false,
    statementCycledAfterPayment: false,
    lastStatementDate: '2026-03-09',
    lastStatementBalance: 118.49,
    creditLimit: 30000,
  },
  {
    id: 'citi-bestbuy',
    name: 'Citi Bestbuy (5026)',
    availableCredit: 4000,
    nextPaymentDate: '2026-04-05',
    paidThisMonth: false,
    statementCycledAfterPayment: false,
    lastStatementDate: '2026-03-11',
    lastStatementBalance: 0,
    creditLimit: 4000,
  },
  {
    id: 'boa-spirit',
    name: 'BOA Spirit (2795)',
    availableCredit: 28270.06,
    nextPaymentDate: '2026-04-08',
    paidThisMonth: false,
    statementCycledAfterPayment: false,
    lastStatementDate: '2026-03-11',
    lastStatementBalance: 29.94,
    creditLimit: 28300,
  },
  {
    id: 'chase-amazon-prime',
    name: 'Chase Amazon Prime (1128)',
    availableCredit: 9228.03,
    nextPaymentDate: '2026-04-10',
    paidThisMonth: false,
    statementCycledAfterPayment: false,
    lastStatementDate: '2026-03-13',
    lastStatementBalance: 170.47,
    creditLimit: 9600,
  },
  {
    id: 'chase-marriott',
    name: 'Chase Marriott (4245)',
    availableCredit: 11700,
    nextPaymentDate: '2026-04-10',
    paidThisMonth: false,
    statementCycledAfterPayment: false,
    lastStatementDate: '2026-03-13',
    lastStatementBalance: 0,
    creditLimit: 11700,
  },
  {
    id: 'chase-sapphire-reserve',
    name: 'Chase Sapphire Reserve (9140)',
    availableCredit: 33973.46,
    nextPaymentDate: '2026-04-10',
    paidThisMonth: false,
    statementCycledAfterPayment: false,
    lastStatementDate: '2026-03-13',
    lastStatementBalance: 855.71,
    creditLimit: 35400,
  },
]

export const incomeItems: IncomeItem[] = [
  {
    id: 'bi-monthly-salary',
    label: 'Bi-mon Sal minus(ESPP + 2 Mortgage Payments)',
    amount: 4211.25,
    month: '',
  },
  {
    id: 'salary-15th',
    label: 'Sal 15th',
    amount: 0,
    month: '',
  },
  {
    id: 'salary-1st',
    label: 'Sal 1st',
    amount: 0,
    month: '',
  },
  {
    id: 'salary-transfer-chase-month',
    label: 'Salary Transfer To Chase/Month',
    amount: 8422.5,
    month: '',
  },
  {
    id: 'salary-transfer-pnc-home-loans',
    label: 'Salary Transfers to PNC for Home Loans',
    amount: 4000,
    month: '',
  },
  {
    id: 'total-salary-per-month',
    label: 'Total Salary Per Month',
    amount: 12422.5,
    month: '',
  },
]

export const balanceItems: BalanceItem[] = [
  { id: 'checking-balance-chase', label: 'Checking Account Balance - Chase', amount: 10530.38, month: '' },
  { id: 'additional-payments-chase', label: 'Additional Payments - Chase', amount: 0, month: '' },
  { id: 'total-balance-chase', label: 'Total Balance - Chase', amount: 10530.38, month: '' },
  { id: 'additional-income-chase', label: 'Additional Income - Chase', amount: 0, month: '' },
  { id: 'checking-balance-month-end-chase', label: 'Month End Balance minus Dues', amount: 7196.97, month: '' },
  { id: 'chase-cd-balance', label: 'Chase CD Balance', amount: 0, month: '' },
  { id: 'checking-balance-pnc', label: 'Checking Account Balance - PNC', amount: 100.57, month: '' },
  { id: 'additional-other-income', label: 'Additional Other Income', amount: 0, month: '' },
  { id: 'net-balance-month-end', label: 'Net Balance @Month End', amount: 7297.54, month: '' },
  { id: 'savings-next-month', label: 'Savings Next Cycle', amount: 3014.03, month: '' },
]

export const defaultColumnLabels: FinancialPlanColumnLabels = {
  creditAccounts: [
    { id: 'account', label: 'Account' },
    { id: 'available-credit', label: 'Avail Credit' },
    { id: 'pay-date', label: 'Payment Date' },
    { id: 'paid', label: 'Paid' },
    { id: 'statement-cycled', label: 'Stmt Cycled' },
    { id: 'statement-date', label: 'Stmt Date' },
    { id: 'statement-balance', label: 'Stmt Balance' },
    { id: 'credit-limit', label: 'Credit Limit' },
    { id: 'due', label: 'Total Due' },
    { id: 'current-payment', label: 'Curr Payment' },
    { id: 'next-balance', label: 'Next Balance' },
    { id: 'utilization', label: 'Util %' },
  ],
  debitExpenses: [
    { id: 'expense', label: 'Expense' },
    { id: 'pay-date', label: 'Pay Date' },
    { id: 'current-month', label: 'Current Month' },
    { id: 'next-month', label: 'Next Month' },
  ],
}

export const defaultSectionTitles: FinancialPlanSectionTitles = {
  creditAccounts: 'Credit Card Accounts',
  debitExpenses: 'Debit Card Expenses',
  incomeSchedule: 'Bank Accounts',
  defaultBank: 'Chase',
}
