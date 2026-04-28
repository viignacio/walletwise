/**
 * Notification settings library (Phase 5).
 *
 * Manages per-user reminder preferences for card due dates and borrower
 * payment due dates. Settings are stored in the notification_settings table.
 *
 * Only "global" settings are supported in Phase 5 (reference_id = null).
 */

import { db } from './db'
import { notificationSettings } from './schema'
import { eq, and, isNull, inArray } from 'drizzle-orm'

export type ReminderType = 'card_due' | 'borrower_payment'

export interface ReminderSetting {
  lead_days: number
  enabled: boolean
}

const DEFAULTS: Record<ReminderType, ReminderSetting> = {
  card_due:          { lead_days: 3, enabled: true },
  borrower_payment:  { lead_days: 3, enabled: true },
}

/** Returns the current global setting for a reminder type.
 *  Falls back to the built-in default if no row exists yet. */
export async function getReminderSetting(userId: string, type: ReminderType): Promise<ReminderSetting> {
  if (!userId) return DEFAULTS[type]

  const [data] = await db
    .select({ leadDays: notificationSettings.leadDays, enabled: notificationSettings.enabled })
    .from(notificationSettings)
    .where(
      and(
        eq(notificationSettings.userId, userId),
        eq(notificationSettings.type, type),
        isNull(notificationSettings.referenceId)
      )
    )

  if (!data) return DEFAULTS[type]
  return {
    lead_days: data.leadDays ?? DEFAULTS[type].lead_days,
    enabled:   data.enabled,
  }
}

/** Persists a global setting for a reminder type. Creates or updates the row. */
export async function setReminderSetting(
  userId: string,
  type: ReminderType,
  lead_days: number,
  enabled: boolean,
): Promise<void> {
  if (!userId) return

  await db
    .insert(notificationSettings)
    .values({
      userId,
      type,
      referenceId: null,
      leadDays: lead_days,
      enabled,
    })
    .onConflictDoUpdate({
      target: [notificationSettings.userId, notificationSettings.type, notificationSettings.referenceId],
      set: {
        leadDays: lead_days,
        enabled,
      }
    })
}

/** Loads both reminder settings in one round-trip. */
export async function getAllReminderSettings(userId: string): Promise<Record<ReminderType, ReminderSetting>> {
  if (!userId) return { ...DEFAULTS }

  const data = await db
    .select({ type: notificationSettings.type, leadDays: notificationSettings.leadDays, enabled: notificationSettings.enabled })
    .from(notificationSettings)
    .where(
      and(
        eq(notificationSettings.userId, userId),
        inArray(notificationSettings.type, ['card_due', 'borrower_payment']),
        isNull(notificationSettings.referenceId)
      )
    )

  const result = { ...DEFAULTS }
  for (const row of data) {
    const t = row.type as ReminderType
    if (t === 'card_due' || t === 'borrower_payment') {
      result[t] = {
        lead_days: row.leadDays ?? DEFAULTS[t].lead_days,
        enabled:   row.enabled,
      }
    }
  }
  return result
}
