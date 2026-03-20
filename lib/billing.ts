/**
 * Billing cycle derivation utility (Phase 3 / Credit Tracker).
 *
 * Rules (from CLAUDE.md / business-logic.md):
 *   txDay ≤ billingCutoffDay  →  current month's statement  →  due dueDateDay of NEXT month
 *   txDay  > billingCutoffDay  →  next month's statement    →  due dueDateDay of MONTH AFTER
 */

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const

export interface BillingInfo {
  /** ISO month string (YYYY-MM) — stored as expected_card_charge_month on LendingRecord */
  statementMonth: string
  /** ISO date string (YYYY-MM-DD) of the payment due date */
  dueDate: string
  /** Human-readable disclosure for display on the record creation screen */
  description: string
}

/**
 * Derives billing cycle information for a credit record.
 *
 * @param transactionDate  The date the charge was made to the borrower
 * @param billingCutoffDay Card.billing_cutoff_day (1–31)
 * @param dueDateDay       Card.due_date_day (1–31)
 */
export function deriveBillingInfo(
  transactionDate: Date,
  billingCutoffDay: number,
  dueDateDay: number,
): BillingInfo {
  const txDay   = transactionDate.getDate()
  const txYear  = transactionDate.getFullYear()
  const txMonth = transactionDate.getMonth() // 0-indexed

  // Step 1: determine which month's statement this falls on
  let stmtYear: number
  let stmtMonth: number // 0-indexed
  if (txDay <= billingCutoffDay) {
    stmtYear  = txYear
    stmtMonth = txMonth
  } else {
    stmtYear  = txMonth === 11 ? txYear + 1 : txYear
    stmtMonth = txMonth === 11 ? 0 : txMonth + 1
  }

  // Step 2: due date is dueDateDay of the month AFTER the statement month
  const dueYear  = stmtMonth === 11 ? stmtYear + 1 : stmtYear
  const dueMonth = stmtMonth === 11 ? 0 : stmtMonth + 1 // 0-indexed

  // Clamp dueDateDay to the actual number of days in the due month
  const daysInDueMonth = new Date(dueYear, dueMonth + 1, 0).getDate()
  const actualDueDay   = Math.min(dueDateDay, daysInDueMonth)

  // Build ISO strings
  const statementMonth = `${stmtYear}-${String(stmtMonth + 1).padStart(2, '0')}`
  const dueDate = [
    dueYear,
    String(dueMonth + 1).padStart(2, '0'),
    String(actualDueDay).padStart(2, '0'),
  ].join('-')

  const description =
    `This charge will first appear on your ${MONTH_NAMES[stmtMonth]} statement, ` +
    `due ${MONTH_NAMES[dueMonth]} ${actualDueDay}, ${dueYear}.`

  return { statementMonth, dueDate, description }
}

/** Returns "1st", "2nd", "3rd", "25th" etc. */
export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0])
}
