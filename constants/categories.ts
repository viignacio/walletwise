export const INCOME_CATEGORIES = [
  'Monthly Deposit',
  'Other Income',
] as const

export const EXPENSE_CATEGORIES = [
  'Food & Dining',
  'Groceries',
  'Utilities',
  'Transportation',
  'Health',
  'Entertainment',
  'Bills',
  'Others',
] as const

export type IncomeCategory = typeof INCOME_CATEGORIES[number]
export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number]