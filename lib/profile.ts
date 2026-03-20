import { supabase } from './supabase'

export interface UserProfile {
  id: string
  name: string
  household_id: string
}

/**
 * Fetches the current user's profile. If no profile exists (e.g. user signed up
 * before the handle_new_user trigger was applied), calls ensure_user_profile RPC
 * to create the household + profile automatically.
 */
export async function getProfile(): Promise<UserProfile> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Fast path: profile already exists
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, name, household_id')
    .eq('id', user.id)
    .single()

  if (profile?.household_id) return profile as UserProfile

  // Recovery path: trigger didn't run for this user — create profile via RPC
  const { data: rows, error } = await supabase.rpc('ensure_user_profile', {
    p_display_name: user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? null,
  })

  if (error) throw new Error(`Could not load profile: ${error.message}`)
  const row = Array.isArray(rows) ? rows[0] : rows
  if (!row?.household_id) throw new Error('Profile could not be created')

  return row as UserProfile
}
