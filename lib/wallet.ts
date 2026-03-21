import { supabase } from './supabase'
import { Transaction, TransactionType } from '../types/database'

export type { Transaction }

export interface MonthlyBalance {
  openingBalance: number
  income: number
  expenses: number
  netMovement: number
  closingBalance: number
}

export interface CategoryTotal {
  category: string
  amount: number
}

export interface YTDMonthRow {
  month: number   // 1–12
  label: string
  expenses: number
  balance: number // running balance at end of that month
}

// ── Balance helpers ──────────────────────────────────────────

/** Sum of all transactions before a given date (ISO date string, exclusive). */
async function sumBefore(householdId: string, beforeDate: string): Promise<number> {
  const { data, error } = await supabase
    .from('transactions')
    .select('type, amount')
    .eq('household_id', householdId)
    .eq('is_pending', false)
    .lt('date', beforeDate)

  if (error) throw new Error(error.message)
  return (data ?? []).reduce(
    (acc, t) => acc + (t.type === 'income' ? Number(t.amount) : -Number(t.amount)),
    0
  )
}

/** Current running balance (sum of all transactions). */
export async function fetchRunningBalance(householdId: string): Promise<number> {
  const { data, error } = await supabase
    .from('transactions')
    .select('type, amount')
    .eq('household_id', householdId)
    .eq('is_pending', false)

  if (error) throw new Error(error.message)
  return (data ?? []).reduce(
    (acc, t) => acc + (t.type === 'income' ? Number(t.amount) : -Number(t.amount)),
    0
  )
}

// ── Monthly view ─────────────────────────────────────────────

/** All transactions for a given month, in chronological order. */
export async function fetchMonthTransactions(
  householdId: string,
  year: number,
  month: number
): Promise<Transaction[]> {
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const end = new Date(year, month, 0) // last day of month
  const endStr = `${year}-${String(month).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`

  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('household_id', householdId)
    .eq('is_pending', false)
    .gte('date', start)
    .lte('date', endStr)
    .order('date', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as Transaction[]
}

/** Opening/closing balance and totals for a month. */
export async function fetchMonthlyBalance(
  householdId: string,
  year: number,
  month: number
): Promise<MonthlyBalance> {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  const [openingBalance, monthData] = await Promise.all([
    sumBefore(householdId, startDate),
    supabase
      .from('transactions')
      .select('type, amount')
      .eq('household_id', householdId)
      .eq('is_pending', false)
      .gte('date', startDate)
      .lte('date', endDate),
  ])

  if (monthData.error) throw monthData.error

  let income = 0
  let expenses = 0
  for (const t of monthData.data ?? []) {
    if (t.type === 'income') income += Number(t.amount)
    else expenses += Number(t.amount)
  }

  return {
    openingBalance,
    income,
    expenses,
    netMovement: income - expenses,
    closingBalance: openingBalance + income - expenses,
  }
}

/** Expense totals grouped by category for a given month. */
export function computeCategoryBreakdown(transactions: Transaction[]): CategoryTotal[] {
  const map = new Map<string, number>()
  for (const t of transactions) {
    if (t.type === 'expense') {
      map.set(t.category, (map.get(t.category) ?? 0) + Number(t.amount))
    }
  }
  return Array.from(map.entries())
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount)
}

// ── YTD view ─────────────────────────────────────────────────

const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/** YTD summary rows for a given year. Returns months up to currentMonth for the current year. */
export async function fetchYTDRows(
  householdId: string,
  year: number,
  currentYear: number,
  currentMonth: number
): Promise<YTDMonthRow[]> {
  const maxMonth = year === currentYear ? currentMonth : 12
  const yearStart = `${year}-01-01`
  const yearEndMonth = String(maxMonth).padStart(2, '0')
  const lastDay = new Date(year, maxMonth, 0).getDate()
  const yearEnd = `${year}-${yearEndMonth}-${String(lastDay).padStart(2, '0')}`

  // Opening balance at start of year
  const openingYear = await sumBefore(householdId, yearStart)

  // All transactions in the year up to maxMonth
  const { data, error } = await supabase
    .from('transactions')
    .select('type, amount, date')
    .eq('household_id', householdId)
    .eq('is_pending', false)
    .gte('date', yearStart)
    .lte('date', yearEnd)
    .order('date', { ascending: true })

  if (error) throw new Error(error.message)

  // Build per-month aggregates
  const rows: YTDMonthRow[] = []
  let runningBalance = openingYear

  for (let m = 1; m <= maxMonth; m++) {
    let income = 0
    let expenses = 0
    for (const t of data ?? []) {
      const tMonth = new Date(t.date).getMonth() + 1
      const tYear = new Date(t.date).getFullYear()
      if (tYear === year && tMonth === m) {
        if (t.type === 'income') income += Number(t.amount)
        else expenses += Number(t.amount)
      }
    }
    runningBalance += income - expenses
    rows.push({
      month: m,
      label: MONTH_LABELS[m - 1],
      expenses,
      balance: runningBalance,
    })
  }

  return rows
}

// ── Transaction CRUD ─────────────────────────────────────────

export interface AddTransactionInput {
  household_id: string
  user_id: string
  type: TransactionType
  amount: number
  category: string
  description: string
  date: string
  notes?: string | null
  is_recurring?: boolean
  recurring_group_id?: string
  is_pending?: boolean
}

export async function addTransaction(input: AddTransactionInput): Promise<Transaction> {
  const { data, error } = await supabase
    .from('transactions')
    .insert(input)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as Transaction
}

export interface UpdateTransactionInput {
  type?: TransactionType
  amount?: number
  category?: string
  description?: string
  date?: string
  notes?: string | null
}

export async function updateTransaction(
  id: string,
  input: UpdateTransactionInput
): Promise<Transaction> {
  const { data, error } = await supabase
    .from('transactions')
    .update(input)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as Transaction
}

export async function deleteTransaction(id: string): Promise<void> {
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id)

  if (error) throw new Error(error.message)
}

// ── Low balance check ─────────────────────────────────────────

export async function isBalanceBelowThreshold(
  householdId: string
): Promise<{ below: boolean; balance: number; threshold: number }> {
  const [balance, settingsResult] = await Promise.all([
    fetchRunningBalance(householdId),
    supabase
      .from('household_settings')
      .select('low_balance_threshold, low_balance_notification_enabled')
      .eq('household_id', householdId)
      .single(),
  ])

  const settings = settingsResult.data
  if (!settings?.low_balance_notification_enabled) {
    return { below: false, balance, threshold: settings?.low_balance_threshold ?? 5000 }
  }

  return {
    below: balance < settings.low_balance_threshold,
    balance,
    threshold: settings.low_balance_threshold,
  }
}

// ── Formatting ───────────────────────────────────────────────

/** Format a string for display in amount inputs with comma separators. */
export function formatAmountInput(text: string): string {
  // Strip everything except digits and a single decimal point
  const cleaned = text.replace(/[^0-9.]/g, '')
  const parts = cleaned.split('.')
  // Only keep first decimal point
  const intPart = parts[0] || ''
  const decPart = parts.length > 1 ? `.${parts[1].slice(0, 2)}` : ''
  // Add comma separators to integer part
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return withCommas + decPart
}

/** Strip commas from a formatted amount string to get a raw number string. */
export function parseAmountInput(text: string): string {
  return text.replace(/,/g, '')
}

export function formatAmount(amount: number): string {
  const abs = Math.abs(amount)
  const formatted = abs.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `₱${formatted}`
}

/** Format a balance preserving the negative sign (e.g. -₱1,200.00). */
export function formatBalance(amount: number): string {
  const abs = Math.abs(amount)
  const formatted = abs.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return amount < 0 ? `-₱${formatted}` : `₱${formatted}`
}
