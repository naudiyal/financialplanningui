export type CreditAccount = {
  name: string
  availableCredit: number
  nextPaymentDate: string
  paidThisMonth: boolean
  statementCycledAfterPayment: boolean
  lastStatementDate: string
  lastStatementBalance: number
  creditLimit: number
  totalDue: number
  currentMonthPayment: number
  nextMonthStatementBalance: number
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
    nextPaymentDate: '31-Mar',
    paidThisMonth: true,
    statementCycledAfterPayment: true,
    lastStatementDate: '31-Mar',
    lastStatementBalance: 30.58,
    creditLimit: 4000,
    totalDue: 40.57,
    currentMonthPayment: 0,
    nextMonthStatementBalance: 30.58,
  },
  {
    name: 'SamsClub Store Card (5873)',
    availableCredit: 11297,
    nextPaymentDate: '23-Mar',
    paidThisMonth: true,
    statementCycledAfterPayment: true,
    lastStatementDate: '31-Mar',
    lastStatementBalance: 444.19,
    creditLimit: 12000,
    totalDue: 703,
    currentMonthPayment: 0,
    nextMonthStatementBalance: 444.19,
  },
  {
    name: 'American Express (72022)',
    availableCredit: 8221,
    nextPaymentDate: '28-Mar',
    paidThisMonth: true,
    statementCycledAfterPayment: false,
    lastStatementDate: '8-Mar',
    lastStatementBalance: 115.66,
    creditLimit: 8300,
    totalDue: 79,
    currentMonthPayment: 0,
    nextMonthStatementBalance: 79,
  },
  {
    name: 'Amazon Store Card (5108)',
    availableCredit: 2700,
    nextPaymentDate: '1-Apr',
    paidThisMonth: true,
    statementCycledAfterPayment: false,
    lastStatementDate: '6-Mar',
    lastStatementBalance: 0,
    creditLimit: 2700,
    totalDue: 0,
    currentMonthPayment: 0,
    nextMonthStatementBalance: 0,
  },
  {
    name: 'Wells Fargo (4256)',
    availableCredit: 16652,
    nextPaymentDate: '2-Apr',
    paidThisMonth: true,
    statementCycledAfterPayment: false,
    lastStatementDate: '8-Mar',
    lastStatementBalance: 1728.18,
    creditLimit: 18000,
    totalDue: 1348,
    currentMonthPayment: 0,
    nextMonthStatementBalance: 1348,
  },
  {
    name: 'Target (0969)',
    availableCredit: 7218,
    nextPaymentDate: '3-Apr',
    paidThisMonth: true,
    statementCycledAfterPayment: false,
    lastStatementDate: '3-Apr',
    lastStatementBalance: 709.96,
    creditLimit: 7400,
    totalDue: 182,
    currentMonthPayment: 0,
    nextMonthStatementBalance: 182,
  },
  {
    name: 'Barclays Frontier (5640)',
    availableCredit: 8269.86,
    nextPaymentDate: '3-Apr',
    paidThisMonth: false,
    statementCycledAfterPayment: false,
    lastStatementDate: '6-Mar',
    lastStatementBalance: 670.23,
    creditLimit: 10000,
    totalDue: 1730.14,
    currentMonthPayment: 670.23,
    nextMonthStatementBalance: 1059.91,
  },
  {
    name: 'Fidelity (9857)',
    availableCredit: 29723.52,
    nextPaymentDate: '6-Apr',
    paidThisMonth: false,
    statementCycledAfterPayment: false,
    lastStatementDate: '9-Mar',
    lastStatementBalance: 118.49,
    creditLimit: 30000,
    totalDue: 276.48,
    currentMonthPayment: 118.49,
    nextMonthStatementBalance: 157.99,
  },
  {
    name: 'Citi Bestbuy (5026)',
    availableCredit: 4000,
    nextPaymentDate: '5-Apr',
    paidThisMonth: false,
    statementCycledAfterPayment: false,
    lastStatementDate: '11-Mar',
    lastStatementBalance: 0,
    creditLimit: 4000,
    totalDue: 0,
    currentMonthPayment: 0,
    nextMonthStatementBalance: 0,
  },
  {
    name: 'BOA Spirit (2795)',
    availableCredit: 28270.06,
    nextPaymentDate: '8-Apr',
    paidThisMonth: false,
    statementCycledAfterPayment: false,
    lastStatementDate: '11-Mar',
    lastStatementBalance: 29.94,
    creditLimit: 28300,
    totalDue: 29.94,
    currentMonthPayment: 29.94,
    nextMonthStatementBalance: 0,
  },
  {
    name: 'Chase Amazon Prime (1128)',
    availableCredit: 9228.03,
    nextPaymentDate: '10-Apr',
    paidThisMonth: false,
    statementCycledAfterPayment: false,
    lastStatementDate: '13-Mar',
    lastStatementBalance: 170.47,
    creditLimit: 9600,
    totalDue: 371.97,
    currentMonthPayment: 170.47,
    nextMonthStatementBalance: 201.5,
  },
  {
    name: 'Chase Marriott (4245)',
    availableCredit: 11700,
    nextPaymentDate: '10-Apr',
    paidThisMonth: false,
    statementCycledAfterPayment: false,
    lastStatementDate: '13-Mar',
    lastStatementBalance: 0,
    creditLimit: 11700,
    totalDue: 0,
    currentMonthPayment: 0,
    nextMonthStatementBalance: 0,
  },
  {
    name: 'Chase Sapphire Reserve (9140)',
    availableCredit: 33973.46,
    nextPaymentDate: '10-Apr',
    paidThisMonth: false,
    statementCycledAfterPayment: false,
    lastStatementDate: '13-Mar',
    lastStatementBalance: 855.71,
    creditLimit: 35400,
    totalDue: 1426.54,
    currentMonthPayment: 855.71,
    nextMonthStatementBalance: 570.83,
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
