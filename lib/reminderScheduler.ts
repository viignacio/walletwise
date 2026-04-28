/**
 * Reminder scheduler (Phase 5).
 *
 * Schedules local notifications for:
 *   - Card due date reminders (lead_days before each card's upcoming due date)
 *   - Borrower payment reminders (lead_days before each upcoming payment's due date)
 *
 * Call scheduleReminders() on app startup and after notification settings change.
 * Local notifications work even when the app is in the background.
 */

import Constants from 'expo-constants'
import { db } from './db'
import { cards, payments, lendingRecords, installments } from './schema'
import { eq, and, inArray, gte, lte, asc } from 'drizzle-orm'
import { formatAmount } from './wallet'
import { getAllReminderSettings } from './notificationSettings'

// Use lazy require() — a top-level import of expo-notifications throws at module
// evaluation time in Expo Go (SDK 53+), even before any function is called.
const IS_EXPO_GO = Constants.appOwnership === 'expo'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const notifs = () => require('expo-notifications') as typeof import('expo-notifications')

// Stable identifier prefixes so we can cancel/replace without duplicates
const PREFIX_CARD    = 'wr_card_'
const PREFIX_PAYMENT = 'wr_pay_'

// Notification fire time: 9 AM in device local time
const NOTIF_HOUR = 9

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Cancels all existing WalletWise reminders and re-schedules fresh ones.
 * Safe to call multiple times (idempotent via cancel-then-schedule).
 * Errors are swallowed — never crashes the app.
 */
export async function scheduleReminders(userId: string): Promise<void> {
  if (IS_EXPO_GO) return // Local notifications not supported in Expo Go (SDK 53+)
  if (!userId) return

  try {
    // Check permission first — only proceed if granted
    const { status } = await notifs().getPermissionsAsync()
    if (status !== 'granted') return

    const [settings] = await Promise.all([getAllReminderSettings(userId)])

    // Cancel all existing WalletWise-scheduled reminders
    await cancelAllReminders()

    const today = startOfDay(new Date())

    if (settings.card_due.enabled) {
      await scheduleCardDueReminders(userId, settings.card_due.lead_days, today)
    }

    if (settings.borrower_payment.enabled) {
      await schedulePaymentReminders(userId, settings.borrower_payment.lead_days, today)
    }
  } catch (e) {
    console.warn('[reminderScheduler] Failed to schedule reminders:', e)
  }
}

/** Cancel all WalletWise-owned scheduled reminders. */
export async function cancelAllReminders(): Promise<void> {
  if (IS_EXPO_GO) return
  try {
    const N = notifs()
    const scheduled = await N.getAllScheduledNotificationsAsync()
    await Promise.all(
      scheduled
        .filter((n) => n.identifier.startsWith(PREFIX_CARD) || n.identifier.startsWith(PREFIX_PAYMENT))
        .map((n) => N.cancelScheduledNotificationAsync(n.identifier)),
    )
  } catch (e) {
    console.warn('[reminderScheduler] Failed to cancel reminders:', e)
  }
}

// ── Card due reminders ────────────────────────────────────────────────────────

async function scheduleCardDueReminders(userId: string, leadDays: number, today: Date): Promise<void> {
  const userCards = await db
    .select()
    .from(cards)
    .where(eq(cards.userId, userId))

  if (!userCards?.length) return

  for (const card of userCards) {
    // Find next due date for this card (based on due_date_day)
    const nextDue = nextDueDate(card.dueDateDay, today)
    const notifDate = daysBeforeDate(nextDue, leadDays)

    // Only schedule if the notification date is today or in the future
    if (notifDate < today) continue

    // Collect expected payments for this card on this due date
    const collections = await getCardCollections(card.id, nextDue)
    const daysAway = daysBetween(today, nextDue)

    const title = `Card ${card.name} is due in ${daysAway} day${daysAway !== 1 ? 's' : ''}.`
    const body = collections.length
      ? `Expected: ${collections.map((c) => `${c.name} ${formatAmount(c.amount)}`).join(' + ')} = ${formatAmount(collections.reduce((s, c) => s + c.amount, 0))}`
      : 'No active collections on record.'

    await scheduleAt(
      `${PREFIX_CARD}${card.id}`,
      title,
      body,
      notifDate,
    )
  }
}

/** Returns upcoming payment totals per borrower for a card, for a given due date. */
async function getCardCollections(
  cardId: string,
  dueDate: Date,
): Promise<Array<{ name: string; amount: number }>> {
  const dueDateStr = toISODate(dueDate)

  const data = await db
    .select({
      expectedAmount: payments.expectedAmount,
      installmentName: installments.name,
    })
    .from(payments)
    .innerJoin(lendingRecords, eq(payments.lendingRecordId, lendingRecords.id))
    .leftJoin(installments, eq(lendingRecords.installmentId, installments.id))
    .where(
      and(
        eq(payments.status, 'upcoming'),
        eq(payments.dueDate, dueDateStr),
        eq(lendingRecords.cardId, cardId)
      )
    )

  if (!data?.length) return []

  // Filter by card and group by installment name
  const map = new Map<string, number>()
  for (const row of data) {
    const name = row.installmentName ?? 'Unknown'
    map.set(name, (map.get(name) ?? 0) + Number(row.expectedAmount))
  }

  return Array.from(map.entries()).map(([name, amount]) => ({ name, amount }))
}

// ── Borrower payment reminders ────────────────────────────────────────────────

async function schedulePaymentReminders(userId: string, leadDays: number, today: Date): Promise<void> {
  // Fetch all upcoming/underpaid payments within the next 90 days
  const windowEnd = new Date(today)
  windowEnd.setDate(windowEnd.getDate() + 90)

  const data = await db
    .select({
      id: payments.id,
      dueDate: payments.dueDate,
      expectedAmount: payments.expectedAmount,
      description: lendingRecords.description,
      installmentName: installments.name,
    })
    .from(payments)
    .innerJoin(lendingRecords, eq(payments.lendingRecordId, lendingRecords.id))
    .leftJoin(installments, eq(lendingRecords.installmentId, installments.id))
    .where(
      and(
        eq(payments.userId, userId),
        inArray(payments.status, ['upcoming', 'underpaid']),
        gte(payments.dueDate, toISODate(today)),
        lte(payments.dueDate, toISODate(windowEnd))
      )
    )
    .orderBy(asc(payments.dueDate))

  if (!data?.length) return

  for (const row of data) {
    const dueDate   = startOfDay(new Date(row.dueDate))
    const notifDate = daysBeforeDate(dueDate, leadDays)
    if (notifDate < today) continue

    const daysAway   = daysBetween(today, dueDate)
    const name       = row.installmentName ?? 'Borrower'
    const amount     = formatAmount(Number(row.expectedAmount))
    const desc       = row.description

    const body = `${name}'s payment of ${amount} for ${desc} is due in ${daysAway} day${daysAway !== 1 ? 's' : ''}.`

    await scheduleAt(
      `${PREFIX_PAYMENT}${row.id}`,
      'Payment Due',
      body,
      notifDate,
    )
  }
}

// ── Scheduling helper ─────────────────────────────────────────────────────────

async function scheduleAt(
  identifier: string,
  title: string,
  body: string,
  date: Date,
): Promise<void> {
  const trigger = new Date(date)
  trigger.setHours(NOTIF_HOUR, 0, 0, 0)

  // If the trigger time has already passed today, skip
  if (trigger <= new Date()) return

  const N = notifs()
  await N.scheduleNotificationAsync({
    identifier,
    content: { title, body, sound: true },
    trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: trigger },
  })
}

// ── Date utilities ────────────────────────────────────────────────────────────

function startOfDay(d: Date): Date {
  const copy = new Date(d)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Returns the next occurrence of dueDateDay on or after today. */
function nextDueDate(dueDateDay: number, today: Date): Date {
  const y = today.getFullYear()
  const m = today.getMonth()
  // Clamp day to last day of month
  const daysInMonth = new Date(y, m + 1, 0).getDate()
  const day = Math.min(dueDateDay, daysInMonth)

  const candidate = new Date(y, m, day)
  if (candidate >= today) return candidate

  // Move to next month
  const nextMonth = m + 1
  const nextYear  = nextMonth > 11 ? y + 1 : y
  const nm        = nextMonth % 12
  const daysInNextMonth = new Date(nextYear, nm + 1, 0).getDate()
  return new Date(nextYear, nm, Math.min(dueDateDay, daysInNextMonth))
}

/** Returns (date - days) as a new Date. */
function daysBeforeDate(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() - days)
  return startOfDay(result)
}

/** Whole days from `from` to `to` (positive). */
function daysBetween(from: Date, to: Date): number {
  const ms = startOfDay(to).getTime() - startOfDay(from).getTime()
  return Math.max(0, Math.round(ms / 86_400_000))
}
