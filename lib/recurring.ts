import { supabase } from './supabase'
import { Transaction } from '../types/database'

/**
 * Given a date string (YYYY-MM-DD), return the 1st of the following month.
 * Recurring expenses always activate on the 1st of the month regardless of
 * what day the original expense was created.
 */
function nextMonthDate(dateStr: string): string {
  const [year, month] = dateStr.split('-').map(Number)
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`
}

/**
 * Called on app open (when session becomes active).
 *
 * 1. Finds all pending transactions for this user whose date has arrived (date <= today).
 * 2. Activates them (sets is_pending = false).
 * 3. For each activated transaction, generates the next month's pending copy.
 *
 * Designed to be lightweight and idempotent — safe to call on every app open.
 */
export async function activatePendingTransactions(userId: string): Promise<void> {
  const today = new Date().toISOString().split('T')[0]

  const { data: due, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .eq('is_pending', true)
    .lte('date', today)

  if (error || !due || due.length === 0) return

  const transactions = due as Transaction[]

  // Activate all due pending transactions in one batch update
  const ids = transactions.map(t => t.id)
  await supabase
    .from('transactions')
    .update({ is_pending: false })
    .in('id', ids)

  // Generate next month's pending for each activated transaction
  const nextPending = transactions.map(tx => ({
    household_id: tx.household_id,
    user_id: tx.user_id,
    type: tx.type,
    amount: tx.amount,
    category: tx.category,
    description: tx.description,
    date: nextMonthDate(tx.date),
    notes: tx.notes,
    is_recurring: true,
    recurring_group_id: tx.recurring_group_id,
    is_pending: true,
  }))

  await supabase.from('transactions').insert(nextPending)
}

/**
 * Deletes all future (still-pending) recurrences for a given recurring_group_id.
 * Past occurrences (is_pending = false) are preserved.
 */
export async function deleteFutureRecurrences(recurringGroupId: string): Promise<void> {
  await supabase
    .from('transactions')
    .delete()
    .eq('recurring_group_id', recurringGroupId)
    .eq('is_pending', true)
}
