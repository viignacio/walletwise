/**
 * Notification settings library (Phase 5).
 *
 * Manages per-user reminder preferences for card due dates and borrower
 * payment due dates. Settings are stored in the notification_settings table.
 *
 * Only "global" settings are supported in Phase 5 (reference_id = null).
 */

import { supabase } from './supabase'

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
export async function getReminderSetting(type: ReminderType): Promise<ReminderSetting> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return DEFAULTS[type]

  const { data } = await supabase
    .from('notification_settings')
    .select('lead_days, enabled')
    .eq('user_id', user.id)
    .eq('type', type)
    .single()

  if (!data) return DEFAULTS[type]
  return {
    lead_days: data.lead_days ?? DEFAULTS[type].lead_days,
    enabled:   data.enabled,
  }
}

/** Persists a global setting for a reminder type. Creates or updates the row. */
export async function setReminderSetting(
  type: ReminderType,
  lead_days: number,
  enabled: boolean,
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { error } = await supabase
    .from('notification_settings')
    .upsert(
      { user_id: user.id, type, reference_id: null, lead_days, enabled },
      { onConflict: 'user_id,type' },
    )

  if (error) throw error
}

/** Loads both reminder settings in one round-trip. */
export async function getAllReminderSettings(): Promise<Record<ReminderType, ReminderSetting>> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ...DEFAULTS }

  const { data } = await supabase
    .from('notification_settings')
    .select('type, lead_days, enabled')
    .eq('user_id', user.id)
    .in('type', ['card_due', 'borrower_payment'] as ReminderType[])

  const result = { ...DEFAULTS }
  for (const row of data ?? []) {
    const t = row.type as ReminderType
    if (t === 'card_due' || t === 'borrower_payment') {
      result[t] = {
        lead_days: row.lead_days ?? DEFAULTS[t].lead_days,
        enabled:   row.enabled,
      }
    }
  }
  return result
}
