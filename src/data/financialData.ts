export type CreditAccount = {
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
  label: string
  amount: number
  month: string
  note?: string
}

export type BalanceItem = {
  label: string
  amount: number
  month: string
}

export const creditAccounts: CreditAccount[] = [
  {
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
    name: 'Amazon Store Card (5108)',
    availableCredit: 2700,
    nextPaymentDate: '2026-04-01',
    paidThisMonth: true,
    statementCycledAfterPayment: false,
    lastStatementDate: '2026-03-06',
    lastStatementBalance: 0,
    creditLimit: 2700,
  },
  {
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
    name: 'Chase Sapphire Res (9140)',
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
    label: 'Salary Transfer To Chase',
    amount: 8422.5,
    month: 'Feb-26',
    note: 'Monthly salary transfer',
  },
  {
    label: 'Salary Transfers to PNC for Home Loans',
    amount: 4000,
    month: 'Mar-26',
    note: 'Transfer for mortgages',
  },
  {
    label: 'Total Salary Per Month',
    amount: 12422.5,
    month: 'Apr-26',
  },
  {
    label: 'Bi-monthly Salary minus ESPP + 2 Mortgage Payments',
    amount: 4211.25,
    month: 'May-26',
  },
  {
    label: 'Sal 15th',
    amount: 0,
    month: 'Jun-26',
  },
  {
    label: 'Sal 1st',
    amount: 0,
    month: 'Jul-26',
  },
]

export const balanceItems: BalanceItem[] = [
  { label: 'Checking Account Balance - Chase', amount: 10530.28, month: 'Sep-26' },
  { label: 'Additional Payments - Chase', amount: 0, month: 'Oct-26' },
  { label: 'Total Balance - Chase', amount: 10530.28, month: 'Nov-26' },
  { label: 'Additional Income - Chase', amount: 0, month: 'Dec-26' },
  { label: 'Checking Account Balance @ Month End - Chase', amount: 7196.87, month: 'Jan-27' },
  { label: 'Chase CD Balance', amount: 0, month: 'Mar-27' },
  { label: 'Checking Account Balance - PNC', amount: 100.57, month: 'Apr-27' },
  { label: 'Additional Other Income', amount: 0, month: 'May-27' },
  { label: 'Net Balance @ Month End', amount: 7297.44, month: 'Jul-27' },
  { label: 'Net Balance @ Next Month End', amount: 10311.47, month: 'Aug-27' },
]
