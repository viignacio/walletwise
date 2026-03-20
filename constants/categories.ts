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

// ── Auto-categorization ───────────────────────────────────────────────────────

type ExpenseCategoryValue = typeof EXPENSE_CATEGORIES[number]
type IncomeCategoryValue = typeof INCOME_CATEGORIES[number]

const EXPENSE_RULES: Array<{ keywords: string[]; category: ExpenseCategoryValue }> = [
  {
    keywords: ['grocery', 'groceries', 'market', 'supermarket', 'puregold', 'sm market', 'robinsons', 'shopwise', 'waltermart'],
    category: 'Groceries',
  },
  {
    keywords: ['food', 'restaurant', 'cafe', 'coffee', 'lunch', 'dinner', 'breakfast', 'snack', 'kain', 'merienda',
      'jollibee', 'mcdo', "mcdonald", 'kfc', 'pizza', 'burger', 'chicken', 'seafood', 'bbq', 'sisig',
      'milk tea', 'boba', 'shawarma', 'siomai', 'mango', 'delivery', 'foodpanda', 'grab food'],
    category: 'Food & Dining',
  },
  {
    keywords: ['electricity', 'meralco', 'water', 'maynilad', 'manila water', 'internet', 'wifi', 'broadband',
      'pldt', 'converge', 'globe', 'smart', 'gas', 'utility', 'utilities', 'telco', 'load', 'prepaid'],
    category: 'Utilities',
  },
  {
    keywords: ['gasoline', 'petrol', 'fuel', 'uber', 'grab ride', 'jeep', 'jeepney', 'tricycle', 'mrt', 'lrt',
      'bus', 'taxi', 'angkas', 'fare', 'toll', 'parking', 'transport', 'commute'],
    category: 'Transportation',
  },
  {
    keywords: ['medicine', 'pharmacy', 'watsons', 'rose pharmacy', 'mercury drug', 'doctor', 'hospital',
      'clinic', 'health', 'checkup', 'check-up', 'dental', 'dentist', 'optical', 'vitamins', 'medical'],
    category: 'Health',
  },
  {
    keywords: ['movie', 'cinema', 'netflix', 'spotify', 'youtube', 'game', 'gaming', 'steam', 'entertainment',
      'concert', 'event', 'show', 'subscription', 'streaming', 'disney', 'apple tv', 'hbo'],
    category: 'Entertainment',
  },
  {
    keywords: ['bill', 'bills', 'payment', 'dues', 'insurance', 'premium', 'loan', 'amortization',
      'mortgage', 'rent', 'condo', 'hoa', 'tuition', 'school', 'credit card'],
    category: 'Bills',
  },
]

const INCOME_RULES: Array<{ keywords: string[]; category: IncomeCategoryValue }> = [
  {
    keywords: ['salary', 'payroll', 'paycheck', 'allowance', 'wage', 'monthly', 'sweldo', 'income',
      'deposit', '13th month', '13th', 'bonus', 'incentive', 'commission'],
    category: 'Monthly Deposit',
  },
]

/**
 * Suggests a category based on a transaction description.
 * Returns null if no confident match is found (user should pick manually).
 */
export function suggestCategory(
  description: string,
  type: 'income' | 'expense',
): string | null {
  const lower = description.toLowerCase()

  if (type === 'expense') {
    for (const rule of EXPENSE_RULES) {
      if (rule.keywords.some((kw) => lower.includes(kw))) {
        return rule.category
      }
    }
  } else {
    for (const rule of INCOME_RULES) {
      if (rule.keywords.some((kw) => lower.includes(kw))) {
        return rule.category
      }
    }
  }

  return null
}