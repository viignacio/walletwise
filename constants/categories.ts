export const INCOME_CATEGORIES = [
  'Monthly Deposit',
  'Other Income',
] as const

export const EXPENSE_CATEGORIES = [
  'Food & Dining',
  'Groceries',
  'Utilities',
  'Travel',
  'Health',
  'Entertainment',
  'Bills',
  'Investments',
  'Pets',
  'Household',
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
      'bus', 'taxi', 'angkas', 'fare', 'toll', 'parking', 'transport', 'commute', 'flight', 'cebpac'],
    category: 'Travel',
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
  {
    keywords: ['investment', 'invest', 'real estate', 'property', 'lot', 'condo unit', 'house and lot',
      'savings', 'save', 'stock', 'stocks', 'mutual fund', 'uitf', 'bond', 'crypto', 'bitcoin',
      'pagibig mp2', 'mp2', 'pag-ibig', 'retirement', 'fund', 'portfolio', 'dividend'],
    category: 'Investments',
  },
  {
    keywords: ['pet', 'pet food', 'dog food', 'cat food', 'pet toys', 'pet treats', 'vet', 'veterinary',
      'grooming', 'kibble', 'litter', 'cat litter', 'dog', 'cat', 'puppy', 'kitten'],
    category: 'Pets',
  },
  {
    keywords: ['appliance', 'repair', 'repairs', 'maintenance', 'plumber', 'plumbing', 'electrician',
      'aircon', 'cleaning', 'furniture', 'home', 'household', 'hardware', 'paint', 'renovation',
      'handyman', 'pest control', 'curtain', 'bedding', 'linens'],
    category: 'Household',
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