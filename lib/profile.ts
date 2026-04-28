import { db } from './db'
import { profiles, households } from './schema'
import { eq } from 'drizzle-orm'

export interface UserProfile {
  id: string
  name: string
  household_id: string
}

export async function getProfile(userId: string, fullName: string | null): Promise<UserProfile> {
  if (!userId) throw new Error('Not authenticated')

  // Fast path: profile already exists
  const [profile] = await db
    .select({
      id: profiles.id,
      name: profiles.name,
      household_id: profiles.householdId
    })
    .from(profiles)
    .where(eq(profiles.id, userId))

  if (profile?.household_id) return profile

  // Recovery path: create new profile & household
  const [newHousehold] = await db
    .insert(households)
    .values({ name: `${fullName || 'My'} Household` })
    .returning({ id: households.id })
    
  if (!newHousehold?.id) throw new Error('Household could not be created')

  const [newProfile] = await db
    .insert(profiles)
    .values({
      id: userId,
      name: fullName || 'User',
      householdId: newHousehold.id
    })
    .returning({
      id: profiles.id,
      name: profiles.name,
      household_id: profiles.householdId
    })

  if (!newProfile?.household_id) throw new Error('Profile could not be created')

  return newProfile
}
